import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"

// 管理端：订单列表（pending + 近期 paid，供审批/审计）
// 鉴权：admin_session cookie（管理员登录）；未登录或失效 → 401
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const orders = await prisma.subscriptionOrder.findMany({
    where: { status: { in: ["pending", "paid"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  })

  return Response.json({
    orders: orders.map((o) => ({
      id: o.id,
      plan: o.plan,
      amount: o.amount,
      status: o.status,
      source: o.source,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      expiresAt: o.expiresAt,
      user: o.user,
    })),
  })
}
