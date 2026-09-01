import prisma from "@/lib/db"
import type { PrismaClient } from "@/generated/prisma"
import { updateSkillProfile } from "@/lib/skill-profile"
import type { MockSession } from "@/lib/ai-mock"

// 模拟面试结果落库：把一场 mock 会话写入 Interview 表，打通
// 「面试记录 → 复盘 → 能力画像 → 教练建议」闭环。纯函数部分可单测。

// ── real-AI 会话 history（assistant/user 交替）→ 配对成 question/answer ──
// 悬挂的尾巴（无回答的追问）丢弃；追问消息会合并反馈+问题文本，如实保留。
export function pairHistoryForMock(
  history: { role: "assistant" | "user"; content: string }[]
): { question: string; answer: string | null }[] {
  const pairs: { question: string; answer: string | null }[] = []
  let pendingQuestion: string | null = null
  for (const m of history) {
    if (m.role === "assistant") {
      pendingQuestion = m.content
    } else if (pendingQuestion !== null) {
      pairs.push({ question: pendingQuestion, answer: m.content })
      pendingQuestion = null
    }
  }
  return pairs
}

export interface MockInterviewInput {
  companyName: string
  position: string
  roundType: string
  status: "ai_reviewed"
  type: "mock"
  overallScore: number | null
  overallFeedback: string | null
  strengths: string | null
  improvementAreas: string | null
  weaknessAreas: string | null
  questions: {
    order: number
    questionText: string
    userAnswer: string | null
    referenceAnswer: string | null // 自定义题库文档自带的参考答案（≠ userAnswer）
    aiScore: number | null
    aiFeedback: string | null
    aiCategory: string | null
  }[]
}

// MockSession → 可落库的 Interview create 数据（纯函数）。
// 模拟模式题目在 session.questions；real-AI 模式在 session.history（配对生成）。
// 分数按题目文本从 summary.questionScores 回查：未作答/未覆盖 → null（不入画像统计）。
// 无任何题目 → 返回 null（不入库）。
export function buildMockInterviewInput(session: MockSession): MockInterviewInput | null {
  const summary = session.summary
  if (!summary) return null

  const scoreByQ = new Map<string, number>()
  const fbByQ = new Map<string, string>()
  for (const qs of summary.questionScores) {
    if (!scoreByQ.has(qs.question)) scoreByQ.set(qs.question, qs.score)
    if (!fbByQ.has(qs.question)) fbByQ.set(qs.question, qs.feedback)
  }

  let qas: { question: string; answer: string | null; referenceAnswer: string | null; category: string }[]
  if (session.questions && session.questions.length > 0) {
    qas = session.questions.map((q) => ({
      question: q.question,
      answer: q.answer ?? null,
      referenceAnswer: q.referenceAnswer ?? null,
      category: q.category,
    }))
  } else {
    qas = pairHistoryForMock(session.history ?? []).map((p, i) => ({
      question: p.question,
      answer: p.answer,
      referenceAnswer: null,
      category: "other",
    }))
  }
  if (qas.length === 0) return null

  return {
    companyName: session.company,
    position: session.position,
    roundType: session.roundType,
    status: "ai_reviewed",
    type: "mock",
    overallScore: summary.overallScore,
    overallFeedback: `模拟面试完成，共 ${summary.totalQuestions} 题，综合评分 ${summary.overallScore}/10。`,
    strengths: JSON.stringify(summary.strengths),
    improvementAreas: JSON.stringify(summary.improvementAreas),
    weaknessAreas: null,
    questions: qas.map((q, i) => ({
      order: i + 1,
      questionText: q.question,
      userAnswer: q.answer,
      referenceAnswer: q.referenceAnswer,
      aiScore: scoreByQ.get(q.question) ?? null,
      aiFeedback: fbByQ.get(q.question) ?? null,
      aiCategory: q.category,
    })),
  }
}

// 落库：find-or-create Company（按 name，同 /api/interviews 模式）→ create Interview + questions → 更新画像。
// 返回 interviewId；无题会话返回 null。db 可注入便于单测。
export async function persistMockInterview(
  userId: string,
  session: MockSession,
  db: PrismaClient = prisma
): Promise<string | null> {
  const input = buildMockInterviewInput(session)
  if (!input) return null

  let company = await db.company.findFirst({ where: { name: input.companyName } })
  if (!company) {
    company = await db.company.create({ data: { name: input.companyName } })
  }

  const interview = await db.interview.create({
    data: {
      userId,
      companyId: company.id,
      position: input.position,
      roundType: input.roundType,
      status: input.status,
      type: input.type,
      overallScore: input.overallScore,
      overallFeedback: input.overallFeedback,
      strengths: input.strengths,
      improvementAreas: input.improvementAreas,
      weaknessAreas: input.weaknessAreas,
      questions: {
        create: input.questions.map((q) => ({
          order: q.order,
          questionText: q.questionText,
          userAnswer: q.userAnswer,
          referenceAnswer: q.referenceAnswer,
          aiScore: q.aiScore,
          aiFeedback: q.aiFeedback,
          aiCategory: q.aiCategory,
        })),
      },
    },
  })

  await updateSkillProfile(userId, db)
  return interview.id
}
