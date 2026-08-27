// 用户「我已转账」声明的前置合法性判定（纯函数，不碰 DB）。
// 路由层先查订单（含 userId/status/userNotifiedAt），传入本函数做判定；
// ok 才允许写 userNotifiedAt。仅声明，不改变订单状态，更不自动开通会员。

export interface NotifyOrderState {
  userId: string
  status: string
  userNotifiedAt: Date | null
}

export type NotifyVerdict =
  | { ok: true }
  | { ok: false; code: "no_order" | "not_owner" | "not_pending" | "already_notified"; error: string }

export function evaluateNotify(order: NotifyOrderState | null, userId: string): NotifyVerdict {
  if (!order) return { ok: false, code: "no_order", error: "订单不存在" }
  if (order.userId !== userId) return { ok: false, code: "not_owner", error: "无权操作该订单" }
  if (order.status !== "pending") return { ok: false, code: "not_pending", error: "订单不是待支付状态" }
  if (order.userNotifiedAt) {
    return { ok: false, code: "already_notified", error: "该订单已标记「我已转账」，请勿重复提交" }
  }
  return { ok: true }
}
