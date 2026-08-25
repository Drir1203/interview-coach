import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveProvider } from "@/lib/ai-interview/service"

// GET /api/video-interview/status?sessionId=xxx —— 查询 AI 面试会话状态
// P1（未开通阿里云）→ 返回 error，前端据此提示；P0 后透传真实 provider 状态。
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId")
  if (!sessionId) {
    return Response.json({ error: "缺少 sessionId" }, { status: 400 })
  }

  const provider = resolveProvider()
  if (!provider) {
    return Response.json({ status: "error", error: "AI 面试服务未开通" })
  }

  return Response.json(await provider.status(sessionId))
}
