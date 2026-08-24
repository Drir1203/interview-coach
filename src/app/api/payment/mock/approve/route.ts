import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { activateSubscription } from "@/lib/payment/activate"
import { requireAdmin } from "@/lib/payment/admin-session"

// Mock 手动开通/模拟支付成功：
// - 管理员（admin_session 登录）任意订单可激活（生产/本地均可用）
// - 本地/测试：本人 pending 订单自助激活（前端「模拟支付成功」按钮）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const orderId = typeof body.orderId === "string" ? body.orderId : ""
  if (!orderId) {
    return Response.json({ error: "orderId 必填" }, { status: 400 })
  }

  const isProduction = process.env.NODE_ENV === "production"
  const adminAuth = await requireAdmin(req)

  if (adminAuth.ok) {
    // 管理员放行，可激活任意订单
  } else if (!isProduction) {
    // 非生产：本人 pending 订单自助激活（模拟支付）
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "请先登录" }, { status: 401 })
    }
    const order = await prisma.subscriptionOrder.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== session.user.id) {
      return Response.json({ error: "订单不存在" }, { status: 404 })
    }
  } else {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const result = await activateSubscription(orderId)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json({ ok: true, orderId })
}
