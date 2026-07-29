import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || "default"

  // 获取所有已复盘面试（含问题）
  const interviews = await prisma.interview.findMany({
    where: { userId, status: "ai_reviewed" },
    include: {
      company: true,
      questions: {
        where: { aiCategory: { not: null }, aiScore: { not: null } },
        select: { aiCategory: true, aiScore: true },
      },
    },
    orderBy: { date: "asc" },
  })

  // ── 1. 跨公司对比 ──
  const companyMap = new Map<string, { scores: number[]; categoryScores: Record<string, number[]>; count: number; name: string }>()
  for (const iv of interviews) {
    const key = iv.company.name
    if (!companyMap.has(key)) {
      companyMap.set(key, { scores: [], categoryScores: {}, count: 0, name: key })
    }
    const entry = companyMap.get(key)!
    if (iv.overallScore) entry.scores.push(iv.overallScore)
    entry.count++
    for (const q of iv.questions) {
      const cat = q.aiCategory || "other"
      if (!entry.categoryScores[cat]) entry.categoryScores[cat] = []
      if (q.aiScore) entry.categoryScores[cat].push(q.aiScore)
    }
  }

  const companyComparison = Array.from(companyMap.values())
    .filter((c) => c.scores.length > 0)
    .map((c) => ({
      company: c.name,
      avgScore: Math.round((c.scores.reduce((a, b) => a + b, 0) / c.scores.length) * 10) / 10,
      interviewCount: c.count,
      skillProfile: Object.entries(c.categoryScores).map(([cat, scores]) => ({
        category: cat,
        score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      })),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)

  // ── 2. 薄弱项追踪 ──
  const categoryMap = new Map<string, { scores: { score: number; date: Date }[] }>()
  for (const iv of interviews) {
    for (const q of iv.questions) {
      const cat = q.aiCategory || "other"
      if (!categoryMap.has(cat)) categoryMap.set(cat, { scores: [] })
      if (q.aiScore) categoryMap.get(cat)!.scores.push({ score: q.aiScore, date: iv.date })
    }
  }

  const CATEGORY_LABELS: Record<string, string> = {
    technical: "技术基础",
    behavioral: "行为面试",
    project_deep_dive: "项目深挖",
    system_design: "系统设计",
    hr: "HR 面试",
  }

  const weaknessTracking = Array.from(categoryMap.entries())
    .map(([category, data]) => {
      const avgScore = Math.round((data.scores.reduce((s, d) => s + d.score, 0) / data.scores.length) * 10) / 10
      const sortedByDate = data.scores.sort((a, b) => a.date.getTime() - b.date.getTime())
      const recent = sortedByDate.slice(-3)
      const trend = recent.map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        score: s.score,
      }))
      return {
        category,
        label: CATEGORY_LABELS[category] || category,
        avgScore,
        count: data.scores.length,
        trend,
        direction: trend.length >= 2 ? (trend[trend.length - 1].score > trend[0].score ? "up" : "down") : "stable",
      }
    })
    .sort((a, b) => a.avgScore - b.avgScore)

  // ── 3. 趋势下钻数据 ──
  const trendData = []
  for (const iv of interviews) {
    if (iv.overallScore) {
      trendData.push({
        date: iv.date.toISOString().slice(0, 10),
        score: iv.overallScore,
        company: iv.company.name,
        position: iv.position,
      })
    }
  }

  // 所有公司列表（用于筛选）
  const companies = Array.from(new Set(interviews.map((i) => i.company.name)))

  return Response.json({
    companyComparison,
    weaknessTracking,
    trendData,
    companies,
  })
}
