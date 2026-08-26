import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"
import { buildUserFilter, parsePage, parsePageSize } from "@/lib/payment/admin-helpers"

// 管理端用户列表：?q= 邮箱/昵称模糊搜索 + ?page=&pageSize= 分页
// 每行带订单数（供运营查看活跃度）；鉴权：admin_session cookie
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get("q") ?? undefined
  const page = parsePage(req.nextUrl.searchParams.get("page"))
  const pageSize = parsePageSize(req.nextUrl.searchParams.get("pageSize"))
  const where = buildUserFilter({ q })

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        proExpiresAt: true,
        trialClaimedAt: true,
        _count: { select: { subscriptionOrders: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const rows = users.map(({ _count, ...u }) => ({ ...u, orderCount: _count.subscriptionOrders }))
  return Response.json({ users: rows, total, page, pageSize })
}
