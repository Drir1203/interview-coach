import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveProvider } from "@/lib/ai-interview/service"

// POST /api/video-interview/end —— 结束 AI 面试并取转写归档
// P1（未开通阿里云）→ 503，前端降级文字模式走 /api/mock 的 end；P0 后透传真实 provider。
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { sessionId, imsSessionId } = body
  if (!sessionId || !imsSessionId) {
    return Response.json({ error: "缺少 sessionId 或 imsSessionId" }, { status: 400 })
  }

  const provider = resolveProvider()
  if (!provider) {
    return Response.json({ error: "AI 面试服务未开通" }, { status: 503 })
  }

  return Response.json(await provider.end(sessionId, imsSessionId))
}
