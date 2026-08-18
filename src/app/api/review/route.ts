import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { aiReview, aiReviewQuestion } from "@/lib/ai-review"
import { updateSkillProfile } from "@/lib/skill-profile"
import { requirePro } from "@/lib/tier"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { interviewId, mode = "full", questionId, instruction } = body

    if (!interviewId) {
      return Response.json({ error: "interviewId 必填" }, { status: 400 })
    }

    // 付费墙：AI 深度复盘仅 Pro 会员可用（未登录豁免，保持门禁匿名链路可用）
    const session = await auth()
    if (session?.user?.id) {
      const pro = await requirePro(session.user.id)
      if (!pro.ok) {
        return Response.json({ error: pro.error, code: pro.code }, { status: 402 })
      }
    }

    // 用户自定义要求（如"更深入分析"），仅当是合法字符串时带入提示词
    const customInstruction =
      typeof instruction === "string" && instruction.trim() ? instruction.trim() : undefined

    // ── 按段重新生成：只重算单题的分析 ──
    if (mode === "question") {
      if (!questionId) {
        return Response.json({ error: "questionId 必填" }, { status: 400 })
      }
      const question = await prisma.interviewQuestion.findUnique({
        where: { id: questionId },
        include: { interview: { include: { company: true } } },
      })
      if (!question) {
        return Response.json({ error: "面试问题不存在" }, { status: 404 })
      }

      // 取该题所属面试的所有者的简历作为分析背景
      const owner = await prisma.user.findUnique({
        where: { id: question.interview.userId },
        select: { resumeText: true },
      })

      const result = await aiReviewQuestion({
        company: question.interview.company.name,
        position: question.interview.position,
        roundType: question.interview.roundType,
        question: {
          questionText: question.questionText,
          userAnswer: question.userAnswer || undefined,
        },
        resumeText: owner?.resumeText || undefined,
        instruction: customInstruction,
      })

      await prisma.interviewQuestion.update({
        where: { id: questionId },
        data: {
          aiScore: result.score,
          aiFeedback: result.feedback,
          aiImprovedAnswer: result.improvedAnswer || null,
          aiCategory: result.category,
          aiKeyMistake: result.keyMistake || null,
        },
      })

      return Response.json({ questionId, ...result })
    }

    // ── 全量 AI 复盘（默认） ──
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

    // 取面试归属者的简历作为分析背景（用 interview.userId 而非 session，规避会话过期边界）
    const owner = await prisma.user.findUnique({
      where: { id: interview.userId },
      select: { resumeText: true },
    })

    // 调用 AI 复盘（无 API Key 时自动走 Mock）
    const result = await aiReview({
      company: interview.company.name,
      position: interview.position,
      roundType: interview.roundType,
      questions: interview.questions.map((q) => ({
        questionText: q.questionText,
        userAnswer: q.userAnswer || undefined,
      })),
      resumeText: owner?.resumeText || undefined,
      instruction: customInstruction,
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
    const reviewedIndices = new Set<number>()
    for (const qa of result.questions) {
      const question = interview.questions[qa.index]
      if (question) {
        reviewedIndices.add(qa.index)
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

    // AI 未覆盖的问题补默认值
    for (let i = 0; i < interview.questions.length; i++) {
      if (!reviewedIndices.has(i)) {
        const q = interview.questions[i]
        await prisma.interviewQuestion.update({
          where: { id: q.id },
          data: {
            aiScore: 5,
            aiFeedback: q.userAnswer
              ? "AI 未能分析该问题，建议补充更多细节后重新分析。"
              : "未记录回答内容，AI 无法分析。",
            aiCategory: "other",
          },
        })
      }
    }

    // 自动更新能力画像(面试后闭环:复盘 → 画像更新)
    await updateSkillProfile(interview.userId)

    return Response.json(result)
  } catch (err) {
    console.error("AI 复盘失败:", err)
    return Response.json(
      { error: err instanceof Error ? err.message : "AI 复盘失败，请稍后重试" },
      { status: 500 }
    )
  }
}
