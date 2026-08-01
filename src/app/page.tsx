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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/utils"
import { InterviewCalendar } from "@/components/InterviewCalendar"
import { ROUND_TYPE_LABELS } from "@/types"
import { SkillRadar } from "@/components/SkillRadar"
import { ScoreTrend } from "@/components/ScoreTrend"

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

export default function Dashboard() {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">面试总览</h1>
          <p className="text-sm text-muted-foreground">
            记录面试 → AI 复盘 → 提升自己
          </p>
        </div>
        <Link href="/interviews/new">
          <Button className="gap-2">
            <PlusCircle className="size-4" />
            记录新面试
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : interviews.length === 0 ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <Briefcase className="size-12 text-muted-foreground/40" />
            <div>
              <CardTitle className="text-lg">还没有面试记录</CardTitle>
              <CardDescription className="mt-1">
                点击下方按钮，记录你的第一场面试
              </CardDescription>
            </div>
            <Link href="/interviews/new">
              <Button className="gap-2">
                <PlusCircle className="size-4" />
                记录第一场面试
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  总面试
                </CardTitle>
                <Briefcase className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.total || interviews.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  已完成复盘
                </CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.reviewed || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  通过率
                </CardTitle>
                <Target className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats ? Math.round(stats.passRate * 100) : 0}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  平均评分
                </CardTitle>
                <BarChart3 className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.avgScore ? stats.avgScore.toFixed(1) : "-"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 图表区域 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 能力雷达图 */}
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

            {/* 评分趋势 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">评分趋势</CardTitle>
                <CardDescription>
                  各场面试评分的走势变化
                </CardDescription>
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
          </div>

          {/* 面试日历 */}
          <div className="grid gap-6 lg:grid-cols-3">
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

            {/* 近期面试 */}
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
                              {ROUND_TYPE_LABELS[interview.roundType] || interview.roundType}
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
          </div>
        </>
      )}
    </div>
  )
}
