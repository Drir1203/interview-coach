// AI 语音面试 · 视觉状态纯函数。
// 阿里云 AICallAgentState 常量与「agentState → 动画状态」映射，供面试官形象/字幕驱动。
// 不依赖 SDK 类型（数值来自 aliyun-auikit-aicall 运行时常量：1 聆听 / 2 思考 / 3 讲话）。

export const AGENT_LISTENING = 1
export const AGENT_THINKING = 2
export const AGENT_TALKING = 3

export interface InterviewVisualState {
  /** 面试官正在讲话 → 口型/声波动画 */
  talking: boolean
  /** 面试官思考中 → 思考动效 */
  thinking: boolean
  /** 面试官聆听中 → 呼吸动画 */
  listening: boolean
  /** 已建立通话（agentState ∈ {1,2,3}） */
  connected: boolean
}

/** agentState → 视觉状态；未知/未连接一律 idle（connected=false） */
export function visualStateFromAgentState(agentState?: number): InterviewVisualState {
  if (agentState === AGENT_TALKING)
    return { talking: true, thinking: false, listening: false, connected: true }
  if (agentState === AGENT_THINKING)
    return { talking: false, thinking: true, listening: false, connected: true }
  if (agentState === AGENT_LISTENING)
    return { talking: false, thinking: false, listening: true, connected: true }
  return { talking: false, thinking: false, listening: false, connected: false }
}
