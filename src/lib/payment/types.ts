// 支付渠道适配器：业务层（会员/订单/限额/试用）与渠道无关。
// v1 只有 MockProvider；域名+资质就绪后各写一个 Provider 文件（wechat/alipay），业务层零改动。
// 与项目 AI 多模型链（DeepSeek→Qwen→Claude→Mock）同一套模式。

export type PlanId = "month" | "quarter" | "year" | "voice10" | "voice30" | "voice100"
export type PlanKind = "subscription" | "voice" // 订阅=续会员时长；voice=充值语音点数

export interface PlanInfo {
  id: PlanId
  label: string
  priceYuan: number
  amount: number // 分
  status: "available" | "soon" // v1 只开月卡 + 三档点数包
  kind: PlanKind
  durationDays?: number // kind=subscription：续费叠加时长
  credits?: number // kind=voice：充值场数（每场 1 点）
}

export const PLANS: Record<PlanId, PlanInfo> = {
  // Pro 订阅（文字 AI 全解锁 + 语音月度额度见 VOICE_MONTHLY_PRO_QUOTA）
  month: {
    id: "month", label: "月度 Pro", priceYuan: 29, amount: 2900,
    durationDays: 30, status: "available", kind: "subscription",
  },
  quarter: {
    id: "quarter", label: "季度 Pro", priceYuan: 79, amount: 7900,
    durationDays: 90, status: "soon", kind: "subscription",
  },
  year: {
    id: "year", label: "年度 Pro", priceYuan: 249, amount: 24900,
    durationDays: 365, status: "soon", kind: "subscription",
  },
  // AI 语音点数包（超额语音 / 免费用户按量用，每场 1 点）
  voice10: {
    id: "voice10", label: "语音 10 场", priceYuan: 29, amount: 2900,
    status: "available", kind: "voice", credits: 10,
  },
  voice30: {
    id: "voice30", label: "语音 30 场", priceYuan: 69, amount: 6900,
    status: "available", kind: "voice", credits: 30,
  },
  voice100: {
    id: "voice100", label: "语音 100 场", priceYuan: 199, amount: 19900,
    status: "available", kind: "voice", credits: 100,
  },
}

export interface CreatePaymentResult {
  payUrl?: string
  mockAction?: "auto" | "manual" // auto=测试模式可自助模拟支付；manual=仅管理员手动开通
  mockToken?: string // mock 渠道：订单方签名（回调用）
}

export interface PaymentProvider {
  name: "mock" | "wechat" | "alipay"
  createPayment(order: { id: string; amount: number; plan: string }): Promise<CreatePaymentResult>
  verifyCallback(rawBody: string, headers: Record<string, string>): Promise<{ orderId: string; success: boolean }>
}

// 续费叠加：base = max(现有到期, now)，再加时长。现有到期已过期则从 now 重新起算。
export function computeExpiry(current: Date | null, now: Date, durationDays: number): Date {
  const base = current && current > now ? current : now
  return new Date(base.getTime() + durationDays * 86400000)
}

// 金额校验：回调/查询里的金额不得直接信，须与 DB 订单 amount 比对（严格相等 + 安全整数）。
export function amountMatches(orderAmount: number, paidAmount: number): boolean {
  return Number.isSafeInteger(orderAmount) && Number.isSafeInteger(paidAmount) && orderAmount === paidAmount
}
