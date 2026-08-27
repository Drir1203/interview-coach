import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { evaluateNotify } from "@/lib/payment/notify"

// 用户「我已转账」声明：转账完成后标记订单，供管理员后台确认收款。
// - 条件更新原子完成「本人 + 待支付 + 未声明」校验，杜绝并发竞态（幂等不受并发破坏）
// - 只写 userNotifiedAt，不改订单状态、不自动开通会员（会员仍由管理员确认到账后开通）
// - no_order / not_owner 统一 404，避免泄露订单是否存在（与订单详情路由口径一致）
// 注：与 /api/payment/order/[id]（订单详情）共用 [id] slug，避免 Next.js 动态路径参数名冲突
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }
  const { id } = await params
  if (!id) {
    return Response.json({ error: "orderId 必填" }, { status: 400 })
  }

  const updated = await prisma.subscriptionOrder.updateMany({
    where: { id, userId: session.user.id, status: "pending", userNotifiedAt: null },
    data: { userNotifiedAt: new Date() },
  })
  if (updated.count === 1) {
    return Response.json({ ok: true })
  }

  // 更新未命中 → 回读订单区分失败原因（仅用于错误提示；存在性相关统一 404）
  const order = await prisma.subscriptionOrder.findUnique({
    where: { id },
    select: { userId: true, status: true, userNotifiedAt: true },
  })
  const verdict = evaluateNotify(order, session.user.id)
  if (!verdict.ok) {
    const status = verdict.code === "no_order" || verdict.code === "not_owner" ? 404 : 400
    return Response.json({ error: verdict.error }, { status })
  }
  // 理论不可达：updateMany 未命中但校验通过（异常并发窗口），按失败处理
  return Response.json({ error: "请稍后重试" }, { status: 400 })
}
