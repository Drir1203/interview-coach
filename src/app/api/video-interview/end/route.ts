import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveProvider } from "@/lib/ai-interview/service"
import { persistVideoInterview } from "@/lib/video-persist"

// 通话时长（秒）防伪上限：阿里云单次智能体最长约 10 分钟，两小时封顶足够真实场景。
const MAX_DURATION_SEC = 7200

function clampDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.min(MAX_DURATION_SEC, Math.max(0, Math.round(value)))
}

// POST /api/video-interview/end —— 结束 AI 面试并取转写归档
// P3 落库：provider.end 取回转写 → persistVideoInterview 写入 Interview(type="video", status="draft")，
// 打通「面试记录 → 复盘 → 能力画像」闭环。company/position/roundType/durationSec 由前端回传
// （与手动录入面试同信任级别）；属主 = 登录用户，type/status 服务端写死不可伪造。
// 未配置阿里云 → 503，前端降级文字模式走 /api/mock 的 end。
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json().catch(() => ({}))
  const { sessionId, imsSessionId, company, position, roundType, durationSec } = body
  if (!sessionId || !imsSessionId) {
    return Response.json({ error: "缺少 sessionId 或 imsSessionId" }, { status: 400 })
  }

  const provider = resolveProvider()
  if (!provider) {
    return Response.json({ error: "AI 面试服务未开通" }, { status: 503 })
  }

  const result = await provider.end(sessionId, imsSessionId)

  // 转写落库；空转写（通话失败/异常）→ persist 返回 null，不消耗场次，用户可重开
  let interviewId: string | null = null
  if (company && position) {
    interviewId = await persistVideoInterview(userId, {
      company,
      position,
      roundType: roundType || "first",
      transcript: result.transcript ?? "",
      durationSec: clampDuration(durationSec),
    })
  }

  return Response.json({ sessionId: result.sessionId, transcript: result.transcript, interviewId })
}
