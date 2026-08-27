import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

// 查询订单状态（前端轮询用）：仅本人可查
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.subscriptionOrder.findUnique({ where: { id } })
  if (!order || order.userId !== session.user.id) {
    return Response.json({ error: "订单不存在" }, { status: 404 })
  }

  return Response.json({
    id: order.id,
    status: order.status,
    plan: order.plan,
    amount: order.amount,
    createdAt: order.createdAt,
    userNotifiedAt: order.userNotifiedAt,
  })
}
