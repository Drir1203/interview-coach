import type { AiInterviewConfig } from "./types"

// AI 面试（阿里云 IMS）配置读取 + 降级判定。
// 未配置 IMS_* 环境变量 → 自动降级为现有文字模拟面试（C4 优雅降级），线上不受影响。
// 环境变量见 docs/aliyun-ai-interview-setup.md。

export function getAiInterviewConfig(): AiInterviewConfig | null {
  const accessKeyId = process.env.IMS_ACCESS_KEY_ID
  const accessKeySecret = process.env.IMS_ACCESS_KEY_SECRET
  const agentId = process.env.IMS_AGENT_ID
  const appId = process.env.IMS_APP_ID
  // 四项齐全才算启用；region 有默认值
  if (!accessKeyId || !accessKeySecret || !agentId || !appId) return null
  return {
    accessKeyId,
    accessKeySecret,
    agentId,
    appId,
    region: process.env.IMS_REGION || "cn-shanghai",
  }
}

export function isAiInterviewEnabled(): boolean {
  return getAiInterviewConfig() !== null
}
