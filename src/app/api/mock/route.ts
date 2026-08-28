import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { chatWithFallback } from "@/lib/ai-coach"
import { AiQuotaError } from "@/lib/payment/ai-quota"
import { ANON_USER_IDS, assertInterviewQuota } from "@/lib/tier"
import { pairHistoryForMock, persistMockInterview } from "@/lib/mock-persist"
import {
  createMockSession,
  mockRespond,
  generateMockSummary,
  buildMockStartPrompt,
  buildMockRespondPrompt,
  buildMockSummaryPrompt,
  type MockSummary,
} from "@/lib/ai-mock"

// 内存会话存储（有状态会话，结束落库后保留）
const sessions = new Map<string, any>()

// 会话 TTL：超时清理，防长时间运行下 Map 无界增长（与 FixedWindowRateLimiter 的 sweep 同理）
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function sweepExpiredSessions(now: number) {
  for (const [key, s] of sessions) {
    if (now - new Date(s.startedAt).getTime() > SESSION_TTL_MS) sessions.delete(key)
  }
}

// 统一 AI 链的系统提示词（prompt builder 已含完整面试规则，这里仅作 persona）
const MOCK_SYSTEM_PROMPT =
  "你是一位资深的技术面试官，正在主持一场模拟面试。保持专业、友好，围绕候选人的技术栈和项目经验展开。"

// 全链失败时的续问兜底（真实模式中途无可用模型时，不让面试中断）
const GENERIC_FOLLOW_UP =
  "【反馈】AI 暂时不可用。请继续：简单总结一下你的核心优势和最有代表性的项目亮点。"

// 从 AI 返回文本中提取 JSON 总结（健壮降级：剥离 markdown 围栏/前后杂质）
function parseSummaryJson(raw: string): MockSummary | null {
  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const s = (fence ? fence[1] : raw).trim()
    const start = s.indexOf("{")
    const end = s.lastIndexOf("}")
    if (start === -1 || end <= start) return null
    const obj = JSON.parse(s.slice(start, end + 1))
    if (typeof obj.overallScore !== "number") return null
    return {
      overallScore: obj.overallScore,
      totalQuestions: typeof obj.totalQuestions === "number" ? obj.totalQuestions : 0,
      strengths: Array.isArray(obj.strengths) ? obj.strengths : [],
      improvementAreas: Array.isArray(obj.improvementAreas) ? obj.improvementAreas : [],
      questionScores: Array.isArray(obj.questionScores) ? obj.questionScores : [],
    }
  } catch {
    return null
  }
}

// 属主校验：匿名会话（__anon__）允许任意调用；登录用户的会话要求 caller 匹配
function assertSessionOwner(session: any, callerId: string): boolean {
  return ANON_USER_IDS.has(session.userId) || session.userId === callerId
}

// real-AI 会话只有 history：从配对推导 questions（规则兜底/降级/落库需要）
function ensureQuestions(session: any) {
  if (!session.questions || session.questions.length === 0) {
    session.questions = pairHistoryForMock(session.history ?? []).map((p, i) => ({
      question: p.question,
      answer: p.answer ?? undefined,
      category: "other",
      round: i + 1,
    }))
  }
}

// 幂等落库：匿名不落库（无 User 行）；已落库不重复写
async function persistOnce(session: any) {
  if (session.persisted || session.persisting) return
  if (ANON_USER_IDS.has(session.userId)) return
  session.persisting = true // 并发 end/重试的 in-flight 锁，防重复落库
  try {
    ensureQuestions(session)
    const id = await persistMockInterview(session.userId, session, prisma)
    if (id) session.persisted = true
  } finally {
    session.persisting = false
  }
}

// 收尾：生成总结（real 走统一 AI 链 + 规则兜底；mock 用规则总结）+ 落库 + 返回
async function finalizeSession(session: any): Promise<Response> {
  ensureQuestions(session)
  if (!session.summary) {
    const ruleSummary = generateMockSummary(session)
    let summary = ruleSummary
    if (session.mode === "real") {
      try {
        const prompt = buildMockSummaryPrompt(session.history, session.grillMode)
        const text = await chatWithFallback(
          MOCK_SYSTEM_PROMPT,
          [{ role: "user", content: prompt }],
          () => JSON.stringify(ruleSummary),
          { userId: session.userId, feature: "mock" }
        )
        summary = parseSummaryJson(text) ?? ruleSummary
      } catch (err) {
        if (err instanceof AiQuotaError) {
          // D3：配额耗尽 → 规则总结收尾，不硬中断
        } else {
          console.error("模拟面试总结失败，使用规则总结:", err)
        }
      }
    }
    session.summary = summary
    session.endedAt = new Date().toISOString()
  }
  await persistOnce(session)
  // isComplete: true —— 前端 respond 路径据此进入 finished 态（否则只有 summary 会卡在 waiting）
  return Response.json({ summary: session.summary, isComplete: true })
}

// 规则 mock 应答：驱动 session.questions 轮转，结束则收尾
function ruleRespond(session: any, answer: string): Promise<Response> {
  ensureQuestions(session)
  const result = mockRespond(session, answer)
  if (result.isComplete) {
    return finalizeSession(session)
  }
  const lastQA = session.questions[session.questions.length - 1]
  return Promise.resolve(
    Response.json({
      feedback: result.feedback,
      question: lastQA?.question,
      round: session.currentRound,
      isComplete: false,
      isFollowUp: result.isFollowUp,
    })
  )
}

async function handleStart(
  company: string,
  position: string,
  roundType: string,
  userId: string,
  resumeMode?: boolean
) {
  // 简历深挖模式：读取用户简历
  let resume: string | undefined
  if (resumeMode) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { resumeText: true } })
    if (user?.resumeText) resume = user.resumeText
  }
  const grill = resumeMode && !!resume

  // 付费墙：已登录用户受免费场次限额（mock 与真实面试同表同计数，D2），fail-fast
  if (!ANON_USER_IDS.has(userId)) {
    const quota = await assertInterviewQuota(userId)
    if (!quota.ok) {
      return Response.json({ error: quota.error, code: quota.code }, { status: 402 })
    }
  }

  // 规则 mock 作兜底基线（题库/轮次/首题）
  const rule = createMockSession(company, position, roundType)
  const firstQuestion = rule.questions[0].question

  let question = firstQuestion
  let mode: "mock" | "real" = "mock"
  try {
    const prompt = buildMockStartPrompt(company, position, roundType, resume, grill)
    const content = await chatWithFallback(
      MOCK_SYSTEM_PROMPT,
      [{ role: "user", content: prompt }],
      () => firstQuestion,
      { userId, feature: "mock" }
    )
    if (content !== firstQuestion) {
      question = content
      mode = "real"
    }
  } catch (err) {
    if (err instanceof AiQuotaError) {
      // D3：开场阶段配额拦截（与 coach/prep/report 一致的 429 fail-fast）
      return Response.json({ error: err.message, code: err.code }, { status: 429 })
    }
    console.error("模拟面试开场 AI 失败，使用规则首题:", err)
  }

  const sessionId = mode === "real" ? `real_${Date.now()}` : rule.id
  sweepExpiredSessions(Date.now())
  sessions.set(sessionId, {
    id: sessionId,
    company,
    position,
    roundType,
    userId,
    mode,
    grillMode: grill,
    // real 模式不预置题目：finalize/降级时从 history 配对（否则 ensureQuestions 为 no-op，只落库首题）；
    // mock 模式 seed 首题供规则 mockRespond 轮转
    questions: mode === "real" ? [] : [{ question, category: rule.questions[0].category, round: 1 }],
    history: [{ role: "assistant", content: question }],
    currentRound: 1,
    startedAt: new Date().toISOString(),
  })

  return Response.json({
    sessionId,
    question,
    round: 1,
    totalRounds: 0,
    isComplete: false,
    grillMode: grill,
  })
}

async function handleRespond(sessionId: string, answer: string, callerId: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    return Response.json({ error: "面试会话不存在或已过期" }, { status: 404 })
  }
  if (!assertSessionOwner(session, callerId)) {
    return Response.json({ error: "无权操作该面试会话" }, { status: 403 })
  }

  // 真实 AI 模式：由 history + 统一 AI 链驱动
  if (session.mode === "real") {
    session.history.push({ role: "user", content: answer })

    let content: string
    try {
      const prompt = buildMockRespondPrompt(session.history, answer, session.grillMode)
      content = await chatWithFallback(
        MOCK_SYSTEM_PROMPT,
        [{ role: "user", content: prompt }],
        () => GENERIC_FOLLOW_UP,
        { userId: session.userId, feature: "mock" }
      )
    } catch (err) {
      if (err instanceof AiQuotaError) {
        // D3：中途配额耗尽/限流 → 降级规则 mock 继续，不硬中断
        return ruleRespond(session, answer)
      }
      console.error("模拟面试应答 AI 失败，降级规则 mock:", err)
      return ruleRespond(session, answer)
    }

    if (content.includes("[END]")) {
      return finalizeSession(session)
    }

    session.history.push({ role: "assistant", content })
    return Response.json({
      feedback: "",
      question: content,
      isComplete: false,
    })
  }

  // 规则 mock 模式
  return ruleRespond(session, answer)
}

async function handleEnd(sessionId: string, callerId: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    return Response.json({ error: "面试会话不存在" }, { status: 404 })
  }
  if (!assertSessionOwner(session, callerId)) {
    return Response.json({ error: "无权操作该面试会话" }, { status: 403 })
  }
  return finalizeSession(session)
}

// POST /api/mock - 开始 / 继续 / 结束模拟面试
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, sessionId, company, position, roundType, answer, resumeMode } = body

  if (action === "start") {
    const session = await auth()
    const userId = session?.user?.id || "__anon__"
    return handleStart(company, position, roundType, userId, resumeMode)
  }

  if (action === "respond" || action === "end") {
    // 属主校验：respond/end 也要带 caller，防他人用分享的 sessionId 越权收尾/落库
    const session = await auth()
    const callerId = session?.user?.id || "__anon__"
    return action === "respond" ? handleRespond(sessionId, answer, callerId) : handleEnd(sessionId, callerId)
  }

  return Response.json({ error: "未知操作" }, { status: 400 })
}
