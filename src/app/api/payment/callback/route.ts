import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { getProvider } from "@/lib/payment/mock"
import { amountMatches } from "@/lib/payment/types"
import { activateSubscription } from "@/lib/payment/activate"

// 支付回调（webhook）：验签 → 幂等 → 金额校验 → 激活会员。
// mock 渠道验签 = X-Mock-Secret 头 或 body.mockToken（订单方签名）。
export async function POST(req: NextRequest) {
  const raw = await req.text()
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    headers[key] = value
  })

  const verified = await getProvider().verifyCallback(raw, headers)
  if (!verified.success) {
    return Response.json({ error: "验签失败" }, { status: 400 })
  }

  const order = await prisma.subscriptionOrder.findUnique({ where: { id: verified.orderId } })
  if (!order) {
    return Response.json({ error: "订单不存在" }, { status: 404 })
  }

  // 金额校验：回调携带的金额须与 DB 订单一致（回调不可信，只认 DB）
  const body = JSON.parse(raw) as { amount?: number }
  if (typeof body.amount === "number" && !amountMatches(order.amount, body.amount)) {
    return Response.json({ error: "金额不符" }, { status: 400 })
  }

  const result = await activateSubscription(order.id)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }

  return Response.json({ ok: true, orderId: order.id })
}
