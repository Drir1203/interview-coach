import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { PLANS, type PlanId } from "@/lib/payment/types"
import { getProvider } from "@/lib/payment/mock"

// 创建订阅订单：落 pending 订单 + 渠道下单（mock 返回 mockAction/mockToken）
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
    },
    { status: 201 }
  )
}
