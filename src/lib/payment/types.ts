// 支付渠道适配器：业务层（会员/订单/限额/试用）与渠道无关。
// v1 只有 MockProvider；域名+资质就绪后各写一个 Provider 文件（wechat/alipay），业务层零改动。
// 与项目 AI 多模型链（DeepSeek→Qwen→Claude→Mock）同一套模式。

export type PlanId = "month" | "quarter" | "year"

export interface PlanInfo {
  id: PlanId
  label: string
  priceYuan: number
  amount: number // 分
  durationDays: number
  status: "available" | "soon" // v1 只开月卡
}

export const PLANS: Record<PlanId, PlanInfo> = {
  month: { id: "month", label: "月卡", priceYuan: 29, amount: 2900, durationDays: 30, status: "available" },
  quarter: { id: "quarter", label: "季卡", priceYuan: 79, amount: 7900, durationDays: 90, status: "soon" },
  year: { id: "year", label: "年卡", priceYuan: 249, amount: 24900, durationDays: 365, status: "soon" },
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
