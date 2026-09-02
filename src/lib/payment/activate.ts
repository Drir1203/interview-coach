import prisma from "@/lib/db"
import { PLANS, computeExpiry, type PlanId } from "./types"

// 支付回调与 mock/approve 共用的激活逻辑（幂等）：
// - 订单已是 paid → 直接返回成功，不重复激活
// - kind=subscription → 按套餐时长续费叠加：proExpiresAt = max(现有, now) + duration
// - kind=voice → 充值语音点数：user.voiceCredits += plan.credits，记 VoiceCreditLog(purchase)
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

  if (plan.kind === "voice") {
    const credits = plan.credits ?? 0
    if (credits <= 0) return { ok: false, error: "套餐点数无效" }
    await prisma.$transaction([
      prisma.subscriptionOrder.update({
        where: { id: orderId },
        data: { status: "paid", paidAt: now },
      }),
      prisma.user.update({
        where: { id: order.userId },
        data: { voiceCredits: { increment: credits } },
      }),
      prisma.voiceCreditLog.create({
        data: { userId: order.userId, delta: credits, reason: "purchase", orderId },
      }),
    ])
    return { ok: true }
  }

  const expiresAt = computeExpiry(order.user?.proExpiresAt ?? null, now, plan.durationDays ?? 0)

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
