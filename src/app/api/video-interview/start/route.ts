import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { buildUserContext } from "@/lib/ai-coach"
import { buildInterviewerPrompt } from "@/lib/ai-interview/prompt"
import { resolveProvider, startInterview } from "@/lib/ai-interview/service"
import type { StartInterviewParams } from "@/lib/ai-interview/types"
import type { BankQuestion } from "@/lib/question-bank"
import { assertVideoQuota } from "@/lib/tier"
import { consumeVoiceCredit } from "@/lib/voice-credit"

// POST /api/video-interview/start —— 启动 AI 视频面试
// 后端组装面试官提示词（人设 + 岗位 + 候选人背景/能力画像），交给阿里云 AI 面试。
// 未配置阿里云 → 返回 { mode: "text" }，前端降级为现有文字模拟面试（C4 优雅降级）。
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json().catch(() => ({}))
  const { company, position, roundType, grill, questionBankId } = body
  if (!company || !position) {
    return Response.json({ error: "缺少公司/岗位" }, { status: 400 })
  }

  // P3 成本护栏：阿里云按分钟计费，先配额后创建实例。
  // 判定：Pro 月度额度（试用 1 场/付费 15 场/自然月）→ pro_monthly；超额度/非 Pro 有语音点数 → credit（实例建成功后再扣点）；
  // 都无 → 402 VOICE_NEEDS_CREDITS（前端引导购买点数包/升级）。
  // 门禁只在 provider 可用（真的会创建计费实例）时拦截；未配置/不可用 → 交给 startInterview 降级文字（C4/S6，不消耗视频配额）。
  const providerReady = !!resolveProvider()
  const quota = await assertVideoQuota(userId)
  if (providerReady && !quota.ok) {
    return Response.json({ error: quota.error, code: quota.code }, { status: 402 })
  }

  // 自定义题库：用户指定本人题库 → 面试官按题库顺序提问（不属主 404 / 空题库 400）
  let customQuestions: BankQuestion[] | undefined
  if (questionBankId) {
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId } })
    if (!bank || bank.userId !== userId) {
      return Response.json({ error: "题库不存在" }, { status: 404 })
    }
    try {
      const parsed = JSON.parse(bank.questions ?? "[]")
      customQuestions = Array.isArray(parsed) ? parsed : []
    } catch {
      customQuestions = []
    }
    if (customQuestions.length === 0) {
      return Response.json({ error: "题库为空" }, { status: 400 })
    }
  }

  // C6 背景注入：能力画像 + 面试历史作为面试官背景
  const userContext = await buildUserContext(userId)
  const prompt = buildInterviewerPrompt({
    company,
    position,
    roundType,
    grill: !!grill,
    userContext,
    customQuestions,
  })

  const params: StartInterviewParams = {
    userId,
    company,
    position,
    roundType,
    grill: !!grill,
    userContext,
    prompt,
  }
  const result = await startInterview(params)

  // credit 通道：实例已真实创建成功 → 原子扣 1 点（并发防超扣）。
  // 扣点失败 = 配额判定后余额被并发耗尽 → 立即结束实例避免未计费空跑，返回 402 引导补点。
  if (providerReady && quota.ok && quota.channel === "credit" && result.mode === "video") {
    const consumed = await consumeVoiceCredit(userId, result.imsSessionId)
    if (!consumed.ok) {
      const provider = resolveProvider()
      if (provider) {
        try {
          await provider.end(result.sessionId, result.imsSessionId)
        } catch {
          /* 终止失败仅记录，不阻断响应 */
        }
      }
      return Response.json(
        { error: "语音点数不足，请先购买点数包", code: "VOICE_NEEDS_CREDITS" },
        { status: 402 }
      )
    }
  }

  return Response.json(result)
}
