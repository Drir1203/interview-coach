import { auth } from "@/auth"

// 返回当前登录用户信息
// 与服务端 auth()（/api/interviews 等）走同一条已验证路径，
// 不依赖 /api/auth/session 的 baseUrl 检测（nginx 反代下会误识别为 localhost）
export async function GET() {
  const session = await auth()
  return Response.json({ user: session?.user ?? null })
}
