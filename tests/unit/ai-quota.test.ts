import { describe, it, expect } from "vitest"
import {
  estimateTokens,
  estimateMessagesTokens,
  checkDailyQuota,
  checkSingleQuota,
  FixedWindowRateLimiter,
  normalizeUsage,
  estimateAiCost,
  type QuotaMessage,
} from "@/lib/payment/ai-quota"

// P0-1 AI 成本计量：限额判定 / 限流窗口 / usage 归一化（纯函数）。
// 输入为估算或聚合后的数值，不碰 DB；DB 读写由集成层负责。

describe("estimateTokens / estimateMessagesTokens（token 估算）", () => {
  it("空串为 0", () => {
    expect(estimateTokens("")).toBe(0)
  })

  it("ASCII 按 4 字符/token 向上取整", () => {
    expect(estimateTokens("abc")).toBe(1)
    expect(estimateTokens("abcdef")).toBe(2)
  })

  it("CJK 按 ~1 token/字", () => {
    expect(estimateTokens("你好世界")).toBe(4)
  })

  it("多轮消息求和（含 system，CJK+ASCII 混合）", () => {
    const messages: QuotaMessage[] = [
      { role: "user", content: "你好" }, // 2 CJK → 2
      { role: "assistant", content: "hello world" }, // 11 ASCII → ceil(11/4)=3
    ]
    expect(estimateMessagesTokens(messages, "system")).toBe(2 + 2 + 3) // system="system" 6 ASCII → 2
  })
})

describe("checkDailyQuota（每日 token 限额判定）", () => {
  it("未超限 → ok", () => {
    expect(checkDailyQuota(100, 30_000)).toEqual({ ok: true })
  })

  it("恰好等于限额 → 拒绝（>=，防 off-by-one 多调一次）", () => {
    const r = checkDailyQuota(30_000, 30_000)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe("DAILY_LIMIT")
    }
  })

  it("超限 → 拒绝 + DAILY_LIMIT + 中文提示", () => {
    const r = checkDailyQuota(30_001, 30_000)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe("DAILY_LIMIT")
      expect(r.error).toContain("今日")
    }
  })
})

describe("checkSingleQuota（单次请求限额判定）", () => {
  it("未超限 → ok", () => {
    expect(checkSingleQuota(1000, 8_000)).toEqual({ ok: true })
  })

  it("超限 → 拒绝 + SINGLE_LIMIT", () => {
    const r = checkSingleQuota(8_001, 8_000)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe("SINGLE_LIMIT")
      expect(r.error).toContain("单次")
    }
  })
})

describe("FixedWindowRateLimiter（每分钟次数限流，固定窗口）", () => {
  it("窗口内未超限放行", () => {
    const rl = new FixedWindowRateLimiter(2, 60_000)
    expect(rl.tryAcquire("u1", 0)).toBe(true)
    expect(rl.tryAcquire("u1", 1_000)).toBe(true)
  })

  it("窗口内超限拒绝", () => {
    const rl = new FixedWindowRateLimiter(2, 60_000)
    expect(rl.tryAcquire("u1", 0)).toBe(true)
    expect(rl.tryAcquire("u1", 1_000)).toBe(true)
    expect(rl.tryAcquire("u1", 2_000)).toBe(false)
  })

  it("跨窗口自动重置", () => {
    const rl = new FixedWindowRateLimiter(1, 60_000)
    expect(rl.tryAcquire("u1", 0)).toBe(true)
    expect(rl.tryAcquire("u1", 1_000)).toBe(false)
    expect(rl.tryAcquire("u1", 61_000)).toBe(true)
  })

  it("不同 key 互不影响", () => {
    const rl = new FixedWindowRateLimiter(1, 60_000)
    expect(rl.tryAcquire("u1", 0)).toBe(true)
    expect(rl.tryAcquire("u2", 0)).toBe(true)
  })

  it("过期 key 周期性被清除（防内存泄漏，M2）", () => {
    const rl = new FixedWindowRateLimiter(10, 60_000)
    // 前 63 次 acquire 建立 63 个 t=0 的过期键（此时窗口未到）
    for (let i = 0; i < 63; i++) {
      rl.tryAcquire(`stale-${i}`, 0)
    }
    // 第 64 次触发 sweep：t=0 与 now=0 差距 < 窗口，过期键全部保留
    rl.tryAcquire("u1", 0)
    expect(rl.size).toBe(64)
    // 时间跳到 61s（所有 t=0 键过期），继续 acquire 到第 128 次再次 sweep
    for (let i = 0; i < 63; i++) {
      rl.tryAcquire(`fresh-${i}`, 61_000)
    }
    rl.tryAcquire("x", 61_000) // 第 128 次 → sweep：64 个 t=0 键全清
    // 剩余 = 63 个 fresh（61s 窗口内）+ x = 64；stale 全部被清
    expect(rl.size).toBe(64)
    expect(rl.tryAcquire("stale-0", 61_000)).toBe(true) // 旧记录已清，视为全新窗口
  })
})

describe("estimateAiCost（AI 成本估算，看板用）", () => {
  it("空 → 0", () => {
    expect(estimateAiCost([])).toEqual({ tokens: 0, costYuan: 0 })
  })

  it("mock 免费 → 0 成本但计入 token", () => {
    expect(
      estimateAiCost([{ model: "mock", inputTokens: 5000, outputTokens: 3000 }])
    ).toEqual({ tokens: 8000, costYuan: 0 })
  })

  it("deepseek 百万 input ≈ ¥1.0（0.001 元/1K）", () => {
    expect(
      estimateAiCost([{ model: "deepseek", inputTokens: 1_000_000, outputTokens: 0 }])
    ).toEqual({ tokens: 1_000_000, costYuan: 1 })
  })

  it("未知 model 按 0 价（不崩）", () => {
    expect(
      estimateAiCost([{ model: "unknown-future", inputTokens: 999, outputTokens: 999 }])
    ).toEqual({ tokens: 1998, costYuan: 0 })
  })

  it("多 model 混合成本相加", () => {
    const r = estimateAiCost([
      { model: "deepseek", inputTokens: 1000, outputTokens: 0 }, // ¥0.001
      { model: "anthropic", inputTokens: 0, outputTokens: 1000 }, // ¥0.11
    ])
    expect(r.tokens).toBe(2000)
    expect(r.costYuan).toBeCloseTo(0.11, 2)
  })
})

describe("normalizeUsage（provider usage 归一化）", () => {
  it("OpenAI 兼容：prompt/completion_tokens", () => {
    expect(normalizeUsage("openai", { prompt_tokens: 10, completion_tokens: 5 })).toEqual({
      inputTokens: 10,
      outputTokens: 5,
    })
  })

  it("Anthropic：input/output_tokens", () => {
    expect(normalizeUsage("anthropic", { input_tokens: 10, output_tokens: 5 })).toEqual({
      inputTokens: 10,
      outputTokens: 5,
    })
  })

  it("缺字段 → null（不记录）", () => {
    expect(normalizeUsage("openai", {})).toBeNull()
    expect(normalizeUsage("anthropic", { input_tokens: 10 })).toBeNull()
  })
})
