// AI 面试编排：启动/查询/结束的统一入口。
// C4 优雅降级：未配置阿里云（或 provider 不可用）→ 返回 { mode: "text" }，前端切回现有文字模拟面试。

import { getAiInterviewConfig } from "./config"
import { getAiInterviewProvider, type AiInterviewProvider } from "./provider"
import type { StartInterviewParams, StartInterviewResult } from "./types"

export { buildInterviewerPrompt } from "./prompt"
export { isAiInterviewEnabled } from "./config"

/**
 * 启动一场 AI 面试。
 * - 阿里云已配置且 provider 就绪 → 走真实 AI 面试（video）
 * - 否则 → 返回 text 模式，由前端降级现有文字模拟面试
 */
export async function startInterview(params: StartInterviewParams): Promise<StartInterviewResult> {
  const provider = resolveProvider()
  if (!provider) return { mode: "text", reason: "阿里云 AI 面试未开通" }
  try {
    return await provider.start(params)
  } catch (err) {
    // C4 优雅降级：阿里云调用失败也不阻断用户，切回文字模拟面试
    console.error("[ai-interview] startInterview 调用失败，降级文字模式", err)
    return { mode: "text", reason: "阿里云 AI 面试暂时不可用，已切换到文字模拟面试" }
  }
}

/**
 * 解析当前可用的 provider；未配置阿里云 → null。
 * 拆成独立函数便于路由与测试复用。
 */
export function resolveProvider(): AiInterviewProvider | null {
  const config = getAiInterviewConfig()
  if (!config) return null
  return getAiInterviewProvider(config)
}
