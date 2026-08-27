import { describe, it, expect } from "vitest"
import { buildProviderChain } from "@/lib/payment/ai-model-tier"

// P0-1 模型分层：按 tier 选择 provider 链（纯函数）。
// Pro = Claude 优先 + 廉价兜底；免费 = 仅廉价链（永不触 Claude）。

describe("buildProviderChain（按 tier 构建 provider 链）", () => {
  const allKeys = { deepseek: true, qwen: true, anthropic: true }

  it("免费层：仅廉价链 deepseek→qwen，不含 anthropic", () => {
    expect(buildProviderChain("free", allKeys)).toEqual(["deepseek", "qwen"])
  })

  it("Pro：anthropic 优先，廉价链兜底", () => {
    expect(buildProviderChain("pro", allKeys)).toEqual(["anthropic", "deepseek", "qwen"])
  })

  it("免费层即使配了 anthropic key 也不用 → 空链（落 mock）", () => {
    expect(buildProviderChain("free", { deepseek: false, qwen: false, anthropic: true })).toEqual([])
  })

  it("Pro 只配 deepseek → 只走 deepseek", () => {
    expect(buildProviderChain("pro", { deepseek: true, qwen: false, anthropic: false })).toEqual([
      "deepseek",
    ])
  })

  it("按可用 key 过滤（Pro + anthropic+deepseek）", () => {
    expect(buildProviderChain("pro", { deepseek: true, qwen: false, anthropic: true })).toEqual([
      "anthropic",
      "deepseek",
    ])
  })

  it("全无 key → 空链（落 mock）", () => {
    expect(buildProviderChain("pro", { deepseek: false, qwen: false, anthropic: false })).toEqual([])
  })
})
