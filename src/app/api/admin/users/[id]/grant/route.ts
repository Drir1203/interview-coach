import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"
import { resolvePlan, buildAdminGrant } from "@/lib/payment/admin-helpers"
import { computeExpiry } from "@/lib/payment/types"

// 管理端：手动给用户开通 Pro（选套餐，到期时间按现有剩余时长叠加）
// 落一条 source=admin 的已支付订单留痕；事务保证订单 + 用户到期时间一致
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const plan = resolvePlan(typeof body.plan === "string" ? body.plan : "")
  if (!plan.ok) {
    return Response.json({ error: plan.error }, { status: 400 })
  }
  if (plan.plan.kind !== "subscription") {
    return Response.json({ error: "点数包不走开通 Pro 流程（请走订单 mock/approve）" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return Response.json({ error: "用户不存在" }, { status: 404 })
  }

  const now = new Date()
  const expiresAt = computeExpiry(user.proExpiresAt, now, plan.plan.durationDays ?? 0)
  const grant = buildAdminGrant(plan.plan, expiresAt, now)
  if (!grant.ok) {
    return Response.json({ error: grant.error }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.subscriptionOrder.create({
      data: { userId: id, ...grant.data },
    }),
    prisma.user.update({ where: { id }, data: { proExpiresAt: expiresAt } }),
  ])

  return Response.json({ ok: true, proExpiresAt: expiresAt })
}
