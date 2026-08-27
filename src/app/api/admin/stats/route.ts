import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"

// 管理端运营看板：核心指标聚合（一次性并行查询，无分页）
// 鉴权：admin_session cookie；未登录或失效 → 401
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const now = new Date()
  const [totalUsers, proUsers, trialClaimed, paidAgg, paidOrders, pendingOrders, notifiedPendingOrders] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { proExpiresAt: { gt: now } } }),
      prisma.user.count({ where: { trialClaimedAt: { not: null } } }),
      prisma.subscriptionOrder.aggregate({
        where: { status: "paid" },
        _sum: { amount: true },
      }),
      prisma.subscriptionOrder.count({ where: { status: "paid" } }),
      prisma.subscriptionOrder.count({ where: { status: "pending" } }),
      prisma.subscriptionOrder.count({
        where: { status: "pending", userNotifiedAt: { not: null } },
      }),
    ])

  return Response.json({
    stats: {
      totalUsers,
      proUsers,
      trialClaimed,
      totalRevenueCents: paidAgg._sum.amount ?? 0,
      paidOrders,
      pendingOrders,
      notifiedPendingOrders,
    },
  })
}
