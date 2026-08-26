import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"

// 管理端：立即取消用户 Pro（清空到期时间，不处理订单历史）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }
  const { id } = await params

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return Response.json({ error: "用户不存在" }, { status: 404 })
  }

  await prisma.user.update({ where: { id }, data: { proExpiresAt: null } })
  return Response.json({ ok: true })
}
