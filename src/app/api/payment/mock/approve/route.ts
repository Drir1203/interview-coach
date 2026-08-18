import { NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { activateSubscription } from "@/lib/payment/activate"

// Mock 手动开通/模拟支付成功：
// - 生产环境：仅管理员（X-Admin-Key = PAYMENT_ADMIN_KEY）可激活任意订单
// - 本地/测试：本人 pending 订单自助激活（前端「模拟支付成功」按钮）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const orderId = typeof body.orderId === "string" ? body.orderId : ""
  if (!orderId) {
    return Response.json({ error: "orderId 必填" }, { status: 400 })
  }

  const isProduction = process.env.NODE_ENV === "production"

  if (isProduction) {
    const adminKey = process.env.PAYMENT_ADMIN_KEY || ""
    if (!adminKey) {
      return Response.json({ error: "管理员密钥未配置" }, { status: 500 })
    }
    const provided = req.headers.get("x-admin-key") || ""
    const ok =
      provided.length === adminKey.length && timingSafeEqual(Buffer.from(provided), Buffer.from(adminKey))
    if (!ok) {
      return Response.json({ error: "未授权" }, { status: 401 })
    }
  } else {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "请先登录" }, { status: 401 })
    }
    const order = await prisma.subscriptionOrder.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== session.user.id) {
      return Response.json({ error: "订单不存在" }, { status: 404 })
    }
  }

  const result = await activateSubscription(orderId)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json({ ok: true, orderId })
}
