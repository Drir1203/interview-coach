import { auth } from "@/auth"
import { getTier } from "@/lib/tier"

// 返回当前登录用户信息（含实时会员状态）
// 与服务端 auth()（/api/interviews 等）走同一条已验证路径，
// 不依赖 /api/auth/session 的 baseUrl 检测（nginx 反代下会误识别为 localhost）
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ user: null })
  }
  // 会员状态实时查 DB（非 JWT 缓存），付费判定权威仍在服务端 requirePro()
  const info = await getTier(session.user.id)
  return Response.json({ user: { ...session.user, ...info } })
}
