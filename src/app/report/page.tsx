"use client"

import { useEffect, useState } from "react"
import { LineChart, Loader2, RefreshCw, TrendingUp, Trophy, Target, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/PageHeader"

interface ReportStats {
  total: number
  reviewed: number
  avgScore: number | null
  passRate: number
  skillProfile: { category: string; score: number; count: number }[]
}

export default function ReportPage() {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState("")
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [error, setError] = useState("")

  const loadReport = async () => {
    const res = await fetch("/interview/api/report", { method: "POST" })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "生成失败")
    setReport(data.report)
    setStats(data.data)
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        await loadReport()
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "报告生成失败,请稍后再试")
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [])

  const handleRegenerate = () => {
    setError("")
    setLoading(true)
    ;(async () => {
      try {
        await loadReport()
      } catch (err) {
        setError(err instanceof Error ? err.message : "报告生成失败,请稍后再试")
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="animate-fade-up flex items-center justify-between gap-4">
        <PageHeader
          icon={LineChart}
          title="成长报告"
          description="基于你的面试记录和复盘，AI 生成阶段性成长总结"
        />
        <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          重新生成
        </Button>
      </div>

      {stats && (
        <div className="animate-fade-up grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "50ms" }}>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardList className="size-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">总面试</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Trophy className="size-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.avgScore ?? "-"}</div>
                <div className="text-xs text-muted-foreground">平均分</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.passRate}%</div>
                <div className="text-xs text-muted-foreground">通过率</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Target className="size-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.skillProfile.length}</div>
                <div className="text-xs text-muted-foreground">能力维度</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="animate-fade-up" style={{ animationDelay: "100ms" }}>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm">AI 正在分析你的成长轨迹…(约 20-40 秒)</p>
            </div>
          ) : report ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{report}</div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {error ? "生成失败,请重试" : "暂无数据"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
