import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || "__anon__"

  const interviews = await prisma.interview.findMany({
    where: { userId, status: "ai_reviewed" },
    include: {
      company: true,
      questions: {
        where: { aiCategory: { not: null } },
        select: { aiCategory: true, aiScore: true },
      },
    },
    orderBy: { date: "asc" },
  })

  const categoryScores: Record<string, number[]> = {}
  for (const iv of interviews) {
    for (const q of iv.questions) {
      const cat = q.aiCategory || "other"
      if (!categoryScores[cat]) categoryScores[cat] = []
      if (q.aiScore) categoryScores[cat].push(q.aiScore)
    }
  }

  const skillProfile = Object.entries(categoryScores).map(([category, scores]) => ({
    category,
    score: scores.reduce((a, b) => a + b, 0) / scores.length,
    count: scores.length,
  }))

  const scoreTrend = interviews
    .filter((i) => i.overallScore)
    .map((i) => ({
      date: i.date.toISOString().slice(0, 10),
      score: i.overallScore!,
      company: i.company.name,
      position: i.position,
    }))

  const totalInterviews = await prisma.interview.count({ where: { userId } })
  const reviewedCount = interviews.length
  const passedCount = await prisma.interview.count({
    where: { userId, result: "pass" },
  })
  const failedCount = await prisma.interview.count({
    where: { userId, result: "fail" },
  })
  const avgScore =
    reviewedCount > 0
      ? interviews.reduce((s, i) => s + (i.overallScore || 0), 0) / reviewedCount
      : 0

  return Response.json({
    stats: {
      total: totalInterviews,
      reviewed: reviewedCount,
      passRate: passedCount + failedCount > 0 ? passedCount / (passedCount + failedCount) : 0,
      avgScore: Math.round(avgScore * 10) / 10,
    },
    skillProfile,
    scoreTrend,
  })
}
