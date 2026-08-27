import prisma from "@/lib/db"
import { chatWithFallback, type CoachMessage } from "@/lib/ai-coach"

const REPORT_SYSTEM_PROMPT = `你是一位资深的面试成长教练。请基于用户真实的面试数据,生成一份客观、有洞察的成长报告。

## 输出要求(用 Markdown 输出)
# 我的成长报告
## 一、总体表现
- 概述:面试场数、平均分、通过率、整体趋势(上升/持平/波动)

## 二、能力维度变化
- 基于【数据】中各能力维度的分数,指出哪些维度是强项、哪些是短板
- 若能看出变化(如某维度分数提高/降低),明确说出来

## 三、亮点与问题
- 2-3 个做得好的地方
- 2-3 个需要改进的地方

## 四、下一步重点(最重要)
- 基于当前最薄弱维度,给出 2-3 条具体、可执行的提升建议
- 建议要具体(练什么、怎么练、练多久)

要求:诚实客观,基于真实数据,不要套模板;数据不足时如实说明。`

interface ReportData {
  total: number
  reviewed: number
  avgScore: number | null
  passRate: number
  skillProfile: { category: string; score: number; count: number }[]
  scoreTrend: { date: string; score: number; company: string; position: string }[]
}

async function loadReportData(userId: string): Promise<ReportData> {
  const interviews = await prisma.interview.findMany({
    where: { userId, status: "ai_reviewed" },
    include: {
      company: true,
      questions: { where: { aiCategory: { not: null }, aiScore: { not: null } }, select: { aiCategory: true, aiScore: true } },
    },
    orderBy: { date: "asc" },
  })

  const catScores: Record<string, number[]> = {}
  for (const iv of interviews) {
    for (const q of iv.questions) {
      const cat = q.aiCategory || "other"
      if (!catScores[cat]) catScores[cat] = []
      catScores[cat].push(q.aiScore!)
    }
  }

  const skillProfile = Object.entries(catScores).map(([category, scores]) => ({
    category,
    score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
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

  const total = await prisma.interview.count({ where: { userId } })
  const passed = await prisma.interview.count({ where: { userId, result: "pass" } })
  const failed = await prisma.interview.count({ where: { userId, result: "fail" } })

  return {
    total,
    reviewed: interviews.length,
    avgScore: interviews.length > 0
      ? Math.round((interviews.reduce((s, i) => s + (i.overallScore || 0), 0) / interviews.length) * 10) / 10
      : null,
    passRate: passed + failed > 0 ? Math.round((passed / (passed + failed)) * 100) : 0,
    skillProfile,
    scoreTrend,
  }
}

function buildReportPrompt(data: ReportData): string {
  const parts: string[] = []
  parts.push(`## 用户数据`)
  parts.push(`- 总面试 ${data.total} 场,已复盘 ${data.reviewed} 场,平均分 ${data.avgScore ?? "暂无"},通过率 ${data.passRate}%`)

  if (data.skillProfile.length > 0) {
    parts.push(`\n### 能力维度分数`)
    for (const p of data.skillProfile) {
      parts.push(`- ${p.category}: ${p.score} (${p.count}场)`)
    }
  }

  if (data.scoreTrend.length > 0) {
    parts.push(`\n### 各场评分走势(按时间)`)
    for (const t of data.scoreTrend) {
      parts.push(`- ${t.date} ${t.company}/${t.position}: ${t.score}分`)
    }
  }

  if (data.reviewed === 0) {
    parts.push("\n(用户还没有已复盘的面试,请引导先完成一次 AI 复盘)")
  }

  return parts.join("\n")
}

function mockReportReply(data: ReportData): string {
  if (data.reviewed === 0) {
    return `# 我的成长报告\n\n你还没有完成 AI 复盘的面试。\n\n先做一次复盘吧:在「面试记录」里给一场面试点「AI 复盘」,之后这里就能生成你的成长报告。`
  }
  const weak = data.skillProfile.length
    ? [...data.skillProfile].sort((a, b) => a.score - b.score)[0]
    : null
  return `# 我的成长报告

## 一、总体表现
- 共 ${data.total} 场面试,已复盘 ${data.reviewed} 场,平均分 ${data.avgScore ?? "-"},通过率 ${data.passRate}%

## 二、能力维度变化
- ${data.skillProfile.map((p) => `${p.category} ${p.score}分`).join("、") || "暂无维度数据"}

## 三、亮点与问题
- 能坚持记录和复盘,这个习惯本身就是最大的优势
- ${weak ? `目前最薄弱的是「${weak.category}」(${weak.score}分),需要重点强化` : "建议尽快完成更多复盘以看清短板"}

## 四、下一步重点
1. 针对薄弱维度,每天练 1-2 道相关面试题并口述录音
2. 把每个项目的亮点整理成可量化的案例(STAR 法则)
3. 每周复盘一次,盯住分数变化

> (当前为基础模式,配置 AI Key 后生成更精准的分析)`
}

export async function generateGrowthReport(userId: string): Promise<{ report: string; data: ReportData }> {
  const data = await loadReportData(userId)
  const prompt = buildReportPrompt(data)
  const messages: CoachMessage[] = [{ role: "user", content: prompt }]
  const report = await chatWithFallback(REPORT_SYSTEM_PROMPT, messages, () => mockReportReply(data), {
    userId,
    feature: "report",
  })
  return { report, data }
}
