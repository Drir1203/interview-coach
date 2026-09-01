import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { buildUserContext } from "@/lib/ai-coach"
import { buildInterviewerPrompt } from "@/lib/ai-interview/prompt"
import { resolveProvider, startInterview } from "@/lib/ai-interview/service"
import type { StartInterviewParams } from "@/lib/ai-interview/types"
import type { BankQuestion } from "@/lib/question-bank"
import { assertVideoQuota } from "@/lib/tier"

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

  // P3 成本护栏：阿里云按分钟计费，先配额后创建实例（免费 5 场总限 / Pro 每日 3 场视频）。
  // 门禁只在 provider 可用（真的会创建计费实例）时拦截；未配置/不可用 → 交给 startInterview 降级文字（C4/S6，不消耗视频配额）。
  const providerReady = !!resolveProvider()
  const quota = await assertVideoQuota(userId)
  if (providerReady && !quota.ok) {
    const status = quota.code === "VIDEO_DAILY_LIMIT" ? 429 : 402
    return Response.json({ error: quota.error, code: quota.code }, { status })
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

  return Response.json(result)
}
