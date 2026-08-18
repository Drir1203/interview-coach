import prisma from "@/lib/db"
import { PLANS, computeExpiry, type PlanId } from "./types"

// 支付回调与 mock/approve 共用的激活逻辑（幂等）：
// - 订单已是 paid → 直接返回成功，不重复激活
// - 否则按套餐时长续费叠加：proExpiresAt = max(现有, now) + duration
export async function activateSubscription(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.subscriptionOrder.findUnique({
    where: { id: orderId },
    include: { user: { select: { proExpiresAt: true } } },
  })
  if (!order) return { ok: false, error: "订单不存在" }
  if (order.status === "paid") return { ok: true }

  const plan = PLANS[order.plan as PlanId]
  if (!plan) return { ok: false, error: "未知套餐" }

  const now = new Date()
  const expiresAt = computeExpiry(order.user?.proExpiresAt ?? null, now, plan.durationDays)

  await prisma.$transaction([
    prisma.subscriptionOrder.update({
      where: { id: orderId },
      data: { status: "paid", paidAt: now, expiresAt },
    }),
    prisma.user.update({
      where: { id: order.userId },
      data: { proExpiresAt: expiresAt },
    }),
  ])

  return { ok: true }
}
