// AI 面试 Provider —— 阿里云「AI 实时互动」(ICE) 真实实现。
// 流程：start 用 GenerateAIAgentCall 创建通话（返回 ARTC channel/token 给前端入会），
//       结束用 StopAIAgentInstance 停实例 + ListAIAgentDialogues 取完整转写。
// 未配置 IMS_* → getAiInterviewProvider 返回 null，service 层降级文字模式（C4）。

import { Config } from "@alicloud/openapi-client"
import IceClient, {
  AIAgentConfig,
  AIAgentConfigAsrConfig,
  AIAgentConfigLlmConfig,
  DescribeAIAgentInstanceRequest,
  GenerateAIAgentCallRequest,
  ListAIAgentDialoguesRequest,
  StopAIAgentInstanceRequest,
} from "@alicloud/ice20201109"
import type {
  AiInterviewConfig,
  EndInterviewResult,
  InterviewStatusResult,
  StartInterviewParams,
  StartInterviewResult,
} from "./types"

// 查询对话记录的时间窗：通话前后各 2 小时
const DIALOGUE_WINDOW_MS = 2 * 60 * 60 * 1000

export interface AiInterviewProvider {
  /** 创建一场 AI 面试会话，返回客户端通话所需参数 */
  start(params: StartInterviewParams): Promise<StartInterviewResult>
  /** 查询进行中的会话状态（sessionId = instanceId） */
  status(sessionId: string): Promise<InterviewStatusResult>
  /** 结束会话并取转写归档 */
  end(sessionId: string, imsSessionId: string): Promise<EndInterviewResult>
}

/** 返回可用的 provider；未配置阿里云 → null（C4 降级） */
export function getAiInterviewProvider(config: AiInterviewConfig | null): AiInterviewProvider | null {
  if (!config) return null
  return new IceAiInterviewProvider(config)
}

class IceAiInterviewProvider implements AiInterviewProvider {
  private client: IceClient

  constructor(private config: AiInterviewConfig) {
    this.client = new IceClient(
      new Config({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        endpoint: `ice.${config.region}.aliyuncs.com`,
      })
    )
  }

  async start(params: StartInterviewParams): Promise<StartInterviewResult> {
    // 自生成对话 sessionId：ListAIAgentDialogues 需要它来取转写（≤64 字符）
    const imsSessionId = `iv_${params.userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}_${Date.now()}`

    const req = new GenerateAIAgentCallRequest({
      AIAgentId: this.config.agentId,
      expire: 3600, // token 1 小时有效
      sessionId: imsSessionId,
      agentConfig: new AIAgentConfig({
        // C6 背景注入：岗位/候选人画像 → 面试官 system prompt
        llmConfig: new AIAgentConfigLlmConfig({
          llmSystemPrompt: params.prompt,
        }),
        asrConfig: new AIAgentConfigAsrConfig({ asrLanguageId: "zh_en" }),
        // 成本护栏：无人入会 60s 自动结束；全程静默 5 分钟自动结束
        userOnlineTimeout: 60,
        maxIdleTime: 300,
      }),
    })

    const res = await this.client.generateAIAgentCall(req)
    const body = res.body
    if (!body?.instanceId || !body?.channelId || !body?.token) {
      throw new Error("阿里云未返回通话参数（instanceId/channelId/token）")
    }

    return {
      mode: "video",
      sessionId: body.instanceId,
      imsSessionId,
      appId: this.config.appId,
      rtcParams: {
        channelId: body.channelId,
        token: body.token,
        AIAgentUserId: body.AIAgentUserId,
        userId: body.userId,
      },
    }
  }

  async status(sessionId: string): Promise<InterviewStatusResult> {
    const res = await this.client.describeAIAgentInstance(
      new DescribeAIAgentInstanceRequest({ instanceId: sessionId })
    )
    const status = res.body?.instance?.status
    if (status === "Executing") return { status: "ongoing" }
    if (status === "Finished") return { status: "completed" }
    return { status: "error", error: `未知会话状态：${status ?? "无"}` }
  }

  async end(sessionId: string, imsSessionId: string): Promise<EndInterviewResult> {
    // 先停实例（会话可能已自动结束，stop 失败不阻断）
    try {
      await this.client.stopAIAgentInstance(new StopAIAgentInstanceRequest({ instanceId: sessionId }))
    } catch {
      // 忽略：可能已被 userOnlineTimeout/maxIdleTime 自动终止
    }

    const now = Date.now()
    const res = await this.client.listAIAgentDialogues(
      new ListAIAgentDialoguesRequest({
        sessionId: imsSessionId,
        startTime: now - DIALOGUE_WINDOW_MS,
        endTime: now + DIALOGUE_WINDOW_MS,
      })
    )

    const dialogues = res.body?.dialogues ?? []
    const transcript = dialogues
      .filter((d) => d.producer === "user" || d.producer === "agent")
      .map((d) => `${d.producer === "user" ? "候选人" : "面试官"}：${d.text ?? ""}`)
      .join("\n")

    return { sessionId, transcript }
  }
}
