// P0-1 AI 成本计量：限额判定 / 限流窗口 / usage 归一化（纯函数，不碰 DB）。
// DB 读写由集成层（ai-coach 的 quota guard）负责；本模块只做纯判断与估算。

export interface QuotaMessage {
  role: string
  content: string
}

// 限额档位（决策 D1，2026-08-27 确认）
export const AI_DAILY_TOKEN_LIMIT = {
  free: 30_000,
  pro: 300_000,
} as const

export const AI_SINGLE_REQUEST_TOKEN_LIMIT = {
  free: 8_000,
  pro: 64_000,
} as const

export const AI_RATE_LIMIT = {
  perMinute: 10,
  windowMs: 60_000,
} as const

// CJK 正则（含全角标点/片假名）：按 ~1 token/字；其余按 ASCII 4 字符/token。
// 用于单次限额的事前估算（成本护栏，非计费）。
const CJK_RE = /[぀-ヿ㐀-鿿가-힯　-〿＀-￯]/g

export function estimateTokens(text: string): number {
  const cjk = (text.match(CJK_RE) || []).length
  const ascii = text.length - cjk
  return cjk + Math.ceil(ascii / 4)
}

export function estimateMessagesTokens(messages: QuotaMessage[], system: string): number {
  return estimateTokens(system) + messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
}

export type DailyQuotaVerdict =
  | { ok: true }
  | { ok: false; code: "DAILY_LIMIT"; error: string }

export function checkDailyQuota(totalToday: number, limit: number): DailyQuotaVerdict {
  if (totalToday >= limit) {
    return {
      ok: false,
      code: "DAILY_LIMIT",
      error: "今日 AI 额度已用完，请升级 Pro 或明日再来",
    }
  }
  return { ok: true }
}

export type SingleQuotaVerdict =
  | { ok: true }
  | { ok: false; code: "SINGLE_LIMIT"; error: string }

export function checkSingleQuota(estimated: number, limit: number): SingleQuotaVerdict {
  if (estimated > limit) {
    return {
      ok: false,
      code: "SINGLE_LIMIT",
      error: "本次内容超出单次 AI 额度上限，请精简后重试",
    }
  }
  return { ok: true }
}

// 估算单价（元 / 1K token；2026-08 参考公开价，仅看板估算展示，非计费）：
// deepseek-chat ¥1/M input ¥2/M output；qwen-max ¥20/M / ¥60/M；claude-sonnet-4 ≈ ¥22/M / ¥110/M；mock 免费。
export const AI_MODEL_COST_PER_1K = {
  deepseek: { input: 0.001, output: 0.002 },
  qwen: { input: 0.02, output: 0.06 },
  anthropic: { input: 0.022, output: 0.11 },
  mock: { input: 0, output: 0 },
} as const

export interface AiCostRow {
  model: string
  inputTokens: number
  outputTokens: number
}

// 按 model 单价估算总 token 与成本（元，保留 2 位）。未知 model 按 0 价，避免看板崩溃。
export function estimateAiCost(rows: AiCostRow[]): { tokens: number; costYuan: number } {
  let tokens = 0
  let cost = 0
  for (const r of rows) {
    const price =
      AI_MODEL_COST_PER_1K[r.model as keyof typeof AI_MODEL_COST_PER_1K] ?? { input: 0, output: 0 }
    tokens += r.inputTokens + r.outputTokens
    cost += (r.inputTokens * price.input + r.outputTokens * price.output) / 1000
  }
  return { tokens, costYuan: Math.round(cost * 100) / 100 }
}

export type AiQuotaErrorCode = "DAILY_LIMIT" | "SINGLE_LIMIT" | "RATE_LIMITED"

// 集成层抛出的限额错误：API 路由据此返回 429 + 中文提示。
export class AiQuotaError extends Error {
  constructor(
    public readonly code: AiQuotaErrorCode,
    message: string
  ) {
    super(message)
    this.name = "AiQuotaError"
  }
}

// 固定窗口限流：key → 窗口起点；同一窗口内计数超限拒绝。注入 now 便于测试。
// 内存态（同 admin/login 既有模式），单实例 PM2 fork 下有效。
export class FixedWindowRateLimiter {
  private readonly counts = new Map<string, { windowStart: number; count: number }>()
  // 每 N 次 acquire 顺带清除过期条目，防 Map 随活跃 key 数线性增长（安全评审 M2）。
  private static readonly SWEEP_EVERY = 64
  private acquireCount = 0

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  tryAcquire(key: string, now: number): boolean {
    if (++this.acquireCount % FixedWindowRateLimiter.SWEEP_EVERY === 0) {
      this.sweepExpired(now)
    }
    const rec = this.counts.get(key)
    if (!rec || now - rec.windowStart >= this.windowMs) {
      this.counts.set(key, { windowStart: now, count: 1 })
      return true
    }
    if (rec.count >= this.limit) return false
    rec.count += 1
    return true
  }

  /** 测试用：当前在窗口内的活跃 key 数 */
  get size(): number {
    return this.counts.size
  }

  private sweepExpired(now: number): void {
    for (const [k, rec] of this.counts) {
      if (now - rec.windowStart >= this.windowMs) this.counts.delete(k)
    }
  }
}

export interface ProviderUsage {
  inputTokens: number
  outputTokens: number
}

// 归一化各 provider 的 usage 字段：
// OpenAI 兼容 prompt_tokens/completion_tokens；Anthropic input_tokens/output_tokens。
export function normalizeUsage(
  provider: "openai" | "anthropic",
  raw: unknown
): ProviderUsage | null {
  if (!raw || typeof raw !== "object") return null
  const u = raw as Record<string, unknown>
  const input = provider === "anthropic" ? u.input_tokens : u.prompt_tokens
  const output = provider === "anthropic" ? u.output_tokens : u.completion_tokens
  if (typeof input !== "number" || typeof output !== "number") return null
  return { inputTokens: input, outputTokens: output }
}
