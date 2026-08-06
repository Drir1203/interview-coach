"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  PlusCircle,
  Briefcase,
  TrendingUp,
  Target,
  BarChart3,
  Loader2,
  Bot,
  LineChart,
  Calendar,
  Sparkles,
  ChevronRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { InterviewCalendar } from "@/components/InterviewCalendar"
import { ROUND_TYPE_LABELS } from "@/types"
import { SkillRadar } from "@/components/SkillRadar"
import { ScoreTrend } from "@/components/ScoreTrend"
import { useAuth } from "@/hooks/useAuth"
import { LandingPage } from "@/components/landing/LandingPage"

interface InterviewSummary {
  id: string
  date: string
  position: string
  roundType: string
  status: string
  overallScore: number | null
  result: string | null
  company: { name: string }
  _count: { questions: number }
  tags: { tag: { name: string; color: string } }[]
}

interface AnalysisData {
  stats: {
    total: number
    reviewed: number
    passRate: number
    avgScore: number
  }
  skillProfile: { category: string; score: number; count: number }[]
  scoreTrend: { date: string; score: number; company: string; position: string }[]
}

interface AiEntry {
  href: string
  label: string
  desc: string
  icon: LucideIcon
}

const aiEntries: AiEntry[] = [
  { href: "/coach", label: "AI 教练", desc: "与 AI 对话，随时请教面试问题", icon: Bot },
  { href: "/prep", label: "押题", desc: "输入公司与岗位，生成押题清单", icon: Target },
  { href: "/report", label: "成长报告", desc: "基于面试趋势，生成阶段成长总结", icon: LineChart },
  { href: "/analysis", label: "深入分析", desc: "多维数据看透你的面试表现", icon: BarChart3 },
  { href: "/applications", label: "求职进度", desc: "管理投递、面试与 Offer 进度", icon: TrendingUp },
  { href: "/interviews", label: "日历", desc: "面试日历，规划你的求职节奏", icon: Calendar },
]

function Dashboard() {
  const { user } = useAuth()
  const [interviews, setInterviews] = useState<InterviewSummary[]>([])
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/interview/api/interviews").then((r) => r.json()),
      fetch("/interview/api/analysis").then((r) => r.json()),
    ])
      .then(([interviewsData, analysisData]) => {
        setInterviews(interviewsData)
        setAnalysis(analysisData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const stats = analysis?.stats
  const name = user?.name || "面试官"

  return (
    <div className="space-y-10">
      {/* 欢迎区：靛蓝渐变卡 */}
      <section className="animate-fade-up overflow-hidden rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#a5b4fc] p-6 text-white shadow-card-hover md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">你好，{name} 👋</h1>
            <p className="mt-2 text-sm text-white/90 md:text-base">
              AI 面师帮你复盘每一场面试，持续拿 Offer
            </p>
          </div>
          <Link href="/interviews/new" className="shrink-0">
            <Button className="gap-2 bg-white px-5 text-primary hover:bg-indigo-50">
              <PlusCircle className="size-4" />
              记录新面试
            </Button>
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 统计卡片：第一个（平均分）突出 */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="animate-fade-up rounded-xl bg-gradient-to-br from-indigo-50 to-card p-7 shadow-card ring-1 ring-primary/20"
              style={{ animationDelay: "30ms" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">平均评分</span>
                <BarChart3 className="size-4 text-primary" />
              </div>
              <div className="mt-3 text-4xl font-bold text-primary">
                {stats?.avgScore ? stats.avgScore.toFixed(1) : "-"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/ 10</span>
              </div>
            </div>
            <div
              className="animate-fade-up rounded-xl bg-card p-6 shadow-card ring-1 ring-foreground/5"
              style={{ animationDelay: "70ms" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">总面试</span>
                <Briefcase className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-3 text-3xl font-bold">{stats?.total || interviews.length}</div>
            </div>
            <div
              className="animate-fade-up rounded-xl bg-card p-6 shadow-card ring-1 ring-foreground/5"
              style={{ animationDelay: "110ms" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">已完成复盘</span>
                <TrendingUp className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-3 text-3xl font-bold">{stats?.reviewed || 0}</div>
            </div>
            <div
              className="animate-fade-up rounded-xl bg-card p-6 shadow-card ring-1 ring-foreground/5"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">通过率</span>
                <Target className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-3 text-3xl font-bold">
                {stats ? Math.round(stats.passRate * 100) : 0}%
              </div>
            </div>
          </section>

          {/* AI 智能入口 */}
          <section className="space-y-5">
            <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
              <h2 className="text-lg font-semibold">AI 智能</h2>
              <p className="text-sm text-muted-foreground">用得越多，AI 越懂你的求职</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aiEntries.map((entry, i) => {
                const Icon = entry.icon
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="animate-fade-up"
                    style={{ animationDelay: `${160 + i * 40}ms` }}
                  >
                    <div className="flex h-full items-start gap-4 rounded-xl bg-card p-6 shadow-card ring-1 ring-foreground/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 font-medium">
                          {entry.label}
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {entry.desc}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          {interviews.length === 0 ? (
            /* 空态：三步引导卡 */
            <section className="animate-fade-up" style={{ animationDelay: "180ms" }}>
              <div className="rounded-xl bg-card p-8 shadow-card ring-1 ring-foreground/5">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="size-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">开始你的 AI 面试之旅</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      三步走，让 AI 面师把每一场面试都变成成长
                    </p>
                  </div>
                  <ol className="flex flex-col gap-3 sm:flex-row sm:gap-8">
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        1
                      </span>
                      记录第一场面试
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        2
                      </span>
                      AI 复盘
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        3
                      </span>
                      生成能力画像
                    </li>
                  </ol>
                  <Link href="/interviews/new">
                    <Button className="gap-2">
                      <PlusCircle className="size-4" />
                      记录第一场面试
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <>
              {/* 图表区域 */}
              <section className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">能力画像</CardTitle>
                    <CardDescription>
                      各维度面试表现评分（基于 AI 复盘数据）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analysis?.skillProfile && analysis.skillProfile.length > 0 ? (
                      <SkillRadar data={analysis.skillProfile} />
                    ) : (
                      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                        完成 AI 复盘后即可查看
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">评分趋势</CardTitle>
                    <CardDescription>各场面试评分的走势变化</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analysis?.scoreTrend && analysis.scoreTrend.length > 1 ? (
                      <ScoreTrend data={analysis.scoreTrend} />
                    ) : (
                      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                        {analysis?.scoreTrend?.length === 1
                          ? "再多一场面试即可查看趋势"
                          : "完成 AI 复盘后即可查看"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* 面试日历 + 近期面试 */}
              <section className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-base">面试日历</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InterviewCalendar
                      events={interviews.map((i) => ({
                        date: i.date.slice(0, 10),
                        company: i.company.name,
                        position: i.position,
                        id: i.id,
                        score: i.overallScore,
                      }))}
                    />
                  </CardContent>
                </Card>

                <div className="lg:col-span-2">
                  <h2 className="mb-4 text-lg font-semibold">近期面试</h2>
                  <div className="space-y-3">
                    {interviews.slice(0, 8).map((interview) => (
                      <Link key={interview.id} href={`/interviews/${interview.id}`}>
                        <Card className="transition-colors hover:bg-muted/50">
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                                <Briefcase className="size-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{interview.company.name}</span>
                                  <span className="text-sm text-muted-foreground">·</span>
                                  <span className="text-sm text-muted-foreground">
                                    {interview.position}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>
                                    {ROUND_TYPE_LABELS[interview.roundType] ||
                                      interview.roundType}
                                  </span>
                                  <span>·</span>
                                  <span>{formatDate(interview.date)}</span>
                                  <span>·</span>
                                  <span>{interview._count.questions} 题</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {interview.overallScore && (
                                <div className="text-lg font-bold text-primary">
                                  {interview.overallScore.toFixed(1)}
                                </div>
                              )}
                              <Badge
                                variant={
                                  interview.status === "ai_reviewed"
                                    ? "default"
                                    : interview.status === "draft"
                                      ? "outline"
                                      : "secondary"
                                }
                              >
                                {interview.status === "ai_reviewed"
                                  ? "已复盘"
                                  : interview.status === "draft"
                                    ? "草稿"
                                    : "已记录"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function HomePage() {
  const { status } = useAuth()

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <LandingPage />
  }

  return <Dashboard />
}
