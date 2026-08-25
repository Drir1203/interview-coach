// AI 面试（阿里云 IMS 智能体）类型定义
// 设计：面试官 LLM 由阿里云托管，我们负责「提示词组装 + 会话编排 + 转写报告」。
// 未配置/未接线 → StartInterviewResult 返回 { mode: "text" }，前端降级现有文字模拟面试（C4）。

export type InterviewMode = "text" | "video"

export interface AiInterviewConfig {
  accessKeyId: string
  accessKeySecret: string
  agentId: string
  appId: string
  region: string
}

/** 启动一场 AI 面试的入参 */
export interface StartInterviewParams {
  userId: string
  company: string
  position: string
  roundType?: string
  grill?: boolean
  userContext?: string
  prompt: string
}

/** 启动结果：video = 进入阿里云通话；text = 降级现有文字面试（reason 给前端提示） */
export type StartInterviewResult =
  | { mode: "text"; reason?: string }
  | {
      mode: "video"
      /** 智能体实例 ID（阿里云返回，status/end 用它作为会话句柄） */
      sessionId: string
      /** ARTC AppId（前端 AICallKit 初始化用） */
      appId: string
      /** 我们生成并传给阿里云的对话 sessionId（结束取转写 ListAIAgentDialogues 用它） */
      imsSessionId: string
      rtcParams: Record<string, unknown>
    }

/** 面试进行中的状态查询 */
export interface InterviewStatusResult {
  status: "ongoing" | "completed" | "error"
  transcript?: string
  error?: string
}

/** 结束面试，拿转写归档 */
export interface EndInterviewResult {
  sessionId: string
  transcript: string
}
