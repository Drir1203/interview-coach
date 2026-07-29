import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { aiReview } from "@/lib/ai-review"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { interviewId } = body

  if (!interviewId) {
    return Response.json({ error: "interviewId 必填" }, { status: 400 })
  }

  // 加载面试数据
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      company: true,
      questions: { orderBy: { order: "asc" } },
    },
  })

  if (!interview) {
    return Response.json({ error: "面试记录不存在" }, { status: 404 })
  }

  if (!interview.questions.length) {
    return Response.json({ error: "没有面试问题，请先录入问题" }, { status: 400 })
  }

  // 调用 AI 复盘（无 API Key 时自动走 Mock）
  const result = await aiReview({
    company: interview.company.name,
    position: interview.position,
    roundType: interview.roundType,
    questions: interview.questions.map((q) => ({
      questionText: q.questionText,
      userAnswer: q.userAnswer || undefined,
    })),
  })

  // 保存 AI 复盘结果到数据库
  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      overallScore: result.overallScore,
      overallFeedback: result.overallFeedback,
      strengths: JSON.stringify(result.strengths),
      improvementAreas: JSON.stringify(result.improvementAreas),
      weaknessAreas: JSON.stringify(result.weaknessAreas),
      status: "ai_reviewed",
    },
  })

  // 逐题更新 AI 评分
  for (const qa of result.questions) {
    const question = interview.questions[qa.index]
    if (question) {
      await prisma.interviewQuestion.update({
        where: { id: question.id },
        data: {
          aiScore: qa.score,
          aiFeedback: qa.feedback,
          aiImprovedAnswer: qa.improvedAnswer || null,
          aiCategory: qa.category,
          aiKeyMistake: qa.keyMistake || null,
        },
      })
    }
  }

  return Response.json(result)
}
