import prisma from "@/lib/db"
import type { PrismaClient } from "@/generated/prisma"

// 从用户所有已复盘面试的逐题分类评分,重算各维度平均分,写入 UserSkillProfile
export async function updateSkillProfile(
  userId: string,
  db: PrismaClient = prisma
): Promise<void> {
  const interviews = await db.interview.findMany({
    where: { userId, status: "ai_reviewed" },
    select: {
      questions: {
        where: { aiCategory: { not: null }, aiScore: { not: null } },
        select: { aiCategory: true, aiScore: true },
      },
    },
  })

  const catScores: Record<string, number[]> = {}
  for (const iv of interviews) {
    for (const q of iv.questions) {
      const cat = q.aiCategory || "other"
      if (!catScores[cat]) catScores[cat] = []
      catScores[cat].push(q.aiScore!)
    }
  }

  for (const [category, scores] of Object.entries(catScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const last = await db.interviewQuestion.findFirst({
      where: { interview: { userId, status: "ai_reviewed" }, aiCategory: category, aiScore: { not: null } },
      orderBy: { interview: { date: "desc" } },
      select: { aiScore: true, interview: { select: { date: true } } },
    })

    await db.userSkillProfile.upsert({
      where: { userId_category: { userId, category } },
      update: {
        averageScore: Math.round(avg * 10) / 10,
        interviewCount: scores.length,
        lastScore: last?.aiScore ?? null,
        lastDate: last?.interview.date ?? null,
      },
      create: {
        userId,
        category,
        averageScore: Math.round(avg * 10) / 10,
        interviewCount: scores.length,
        lastScore: last?.aiScore ?? null,
        lastDate: last?.interview.date ?? null,
      },
    })
  }
}
