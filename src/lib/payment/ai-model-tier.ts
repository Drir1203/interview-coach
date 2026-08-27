// P0-1 模型分层：按 tier 选择 provider 链（纯函数）。
// Pro = Claude 优先 + 廉价兜底；免费 = 仅廉价链（成本天然分层，免费永不触 Claude）。

export type AiProvider = "deepseek" | "qwen" | "anthropic"

export interface ProviderKeys {
  deepseek: boolean
  qwen: boolean
  anthropic: boolean
}

export function buildProviderChain(tier: "free" | "pro", keys: ProviderKeys): AiProvider[] {
  const cheap: AiProvider[] = []
  if (keys.deepseek) cheap.push("deepseek")
  if (keys.qwen) cheap.push("qwen")
  if (tier === "free") return cheap
  const pro: AiProvider[] = []
  if (keys.anthropic) pro.push("anthropic")
  return [...pro, ...cheap]
}
