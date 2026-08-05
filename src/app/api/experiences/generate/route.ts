import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { auth } from "@/auth"
import { abstractExperiences } from "@/lib/ai-experience"

function getUserId(session: any): string {
  return session?.user?.id || "default"
}

// POST /api/experiences/generate - 从用户的面试记录抽象生成面经草稿
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserId(session)
    const body = await req.json()
    const interviewId = typeof body.interviewId === "string" ? body.interviewId : ""

    if (!interviewId) {
      return Response.json({ error: "缺少面试记录" }, { status: 400 })
    }

    // 校验归属：只能从自己的面试导入
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, userId },
      include: {
        company: true,
        questions: { orderBy: { order: "asc" } },
      },
    })

    if (!interview) {
      return Response.json({ error: "面试记录不存在或无权限" }, { status: 404 })
    }

    let questions = interview.questions
      .filter((q) => q.questionText && q.questionText.trim())
      .map((q) => ({
        id: q.id,
        questionText: q.questionText,
        userAnswer: q.userAnswer,
      }))

    // 仅抽象勾选的题目
    if (Array.isArray(body.questionIds) && body.questionIds.length > 0) {
      const idSet = new Set(body.questionIds as string[])
      questions = questions.filter((q) => idSet.has(q.id))
    }

    if (questions.length === 0) {
      return Response.json({ error: "该面试没有可贡献的题目" }, { status: 400 })
    }

    const entries = await abstractExperiences(
      interview.company.name,
      interview.position,
      interview.roundType,
      questions
    )

    return Response.json({ entries })
  } catch (err) {
    console.error("生成面经草稿失败:", err)
    return Response.json({ error: "生成失败" }, { status: 500 })
  }
}
