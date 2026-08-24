import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/payment/admin-session"

// 登录态检测：前端加载时确认是否已登录 + 拿当前管理员用户名
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return Response.json({ error: "未授权" }, { status: 401 })
  return Response.json({ username: auth.admin.username })
}
