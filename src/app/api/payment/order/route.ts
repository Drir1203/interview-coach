import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { PLANS, type PlanId } from "@/lib/payment/types"
import { getProvider } from "@/lib/payment/mock"
import { PAYMENT_CONFIG_ID, toPublicConfig } from "@/lib/payment/payment-config"

// 创建订阅订单：落 pending 订单 + 渠道下单（mock 返回 mockAction/mockToken）
// 手动模式（生产）响应附收款码配置（PaymentConfig 单例），供价格页展示微信/支付宝收款码
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const plan = PLANS[body.plan as PlanId]
  if (!plan || plan.status !== "available") {
    return Response.json({ error: "该套餐暂不可购买" }, { status: 400 })
  }

  // 先读收款配置，再建订单：配置读取失败时不留孤儿订单（避免重试产生重复 pending 单）
  const paymentConfig = await prisma.paymentConfig.findUnique({ where: { id: PAYMENT_CONFIG_ID } })

  const order = await prisma.subscriptionOrder.create({
    data: {
      userId: session.user.id,
      plan: plan.id,
      amount: plan.amount,
      status: "pending",
      source: "mock",
    },
  })

  const payment = await getProvider().createPayment({ id: order.id, amount: order.amount, plan: order.plan })

  return Response.json(
    {
      orderId: order.id,
      amount: order.amount,
      mockAction: payment.mockAction ?? "manual",
      mockToken: payment.mockToken,
      payUrl: payment.payUrl,
      paymentConfig: toPublicConfig(paymentConfig),
    },
    { status: 201 }
  )
}
