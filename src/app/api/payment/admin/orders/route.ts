import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"
import { buildOrderFilter } from "@/lib/payment/admin-helpers"

// 管理端：订单列表（默认 pending + 近期 paid；支持 ?status=&source= 筛选，供审批/审计）
// 鉴权：admin_session cookie（管理员登录）；未登录或失效 → 401
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const filter = buildOrderFilter({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    source: req.nextUrl.searchParams.get("source") ?? undefined,
  })
  if (!filter.ok) {
    return Response.json({ error: filter.error }, { status: 400 })
  }

  const statusFilter = filter.where.status?.in ?? ["pending", "paid"]
  const orders = await prisma.subscriptionOrder.findMany({
    where: {
      status: { in: statusFilter },
      ...(filter.where.source ? { source: filter.where.source } : {}),
    },
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
