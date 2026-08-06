"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PlusCircle, Briefcase, Search, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/PageHeader"
import { formatDate } from "@/lib/utils"
import { ROUND_TYPE_LABELS, INTERVIEW_STATUS_CONFIG } from "@/types"
import { exportSummaryPdf } from "@/lib/pdf-export"

interface InterviewSummary {
  id: string
  date: string
  position: string
  roundType: string
  status: string
  overallScore: number | null
  result: string | null
  company: { name: string; industry: string | null }
  _count: { questions: number }
}

export default function InterviewList() {
  const [interviews, setInterviews] = useState<InterviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    fetch("/interview/api/interviews")
      .then((r) => r.json())
      .then((data) => {
        setInterviews(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = interviews.filter((i) => {
    const matchSearch =
      !search ||
      i.company.name.toLowerCase().includes(search.toLowerCase()) ||
      i.position.toLowerCase().includes(search.toLowerCase())
    const matchTab = tab === "all" || i.status === tab
    return matchSearch && matchTab
  })

  const handleExportPdf = async () => {
    setPdfLoading(true)
    try {
      await exportSummaryPdf(
        filtered.map((i) => ({
          company: i.company,
          position: i.position,
          roundType: i.roundType,
          date: i.date,
          overallScore: i.overallScore,
          result: i.result,
        }))
      )
    } catch (err) {
      alert("PDF 导出失败：" + (err instanceof Error ? err.message : "未知错误"))
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          icon={Briefcase}
          title="面试记录"
          description="查看、检索所有已记录的面试与 AI 复盘"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={pdfLoading} className="gap-2">
            {pdfLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            导出 PDF
          </Button>
          <a href="/interview/api/export?format=csv">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="size-4" />
              导出 CSV
            </Button>
          </a>
          <Link href="/interviews/new">
            <Button className="gap-2">
              <PlusCircle className="size-4" />
              记录新面试
            </Button>
          </Link>
        </div>
      </div>

      <div className="animate-fade-up flex flex-wrap items-center gap-4" style={{ animationDelay: "60ms" }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索公司或岗位..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="draft">草稿</TabsTrigger>
            <TabsTrigger value="recorded">已记录</TabsTrigger>
            <TabsTrigger value="ai_reviewed">已复盘</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="animate-fade-up flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="animate-fade-up py-16" style={{ animationDelay: "80ms" }}>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Briefcase className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {search ? "没有匹配的面试记录" : "还没有面试记录"}
            </p>
            {!search && (
              <Link href="/interviews/new">
                <Button variant="outline" className="gap-2">
                  <PlusCircle className="size-4" />
                  记录第一场面试
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="animate-fade-up space-y-3" style={{ animationDelay: "100ms" }}>
          {filtered.map((interview) => (
            <Link key={interview.id} href={`/interviews/${interview.id}`}>
              <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <Briefcase className="size-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{interview.company.name}</span>
                        {interview.company.industry && (
                          <span className="text-xs text-muted-foreground">
                            {interview.company.industry}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{interview.position}</span>
                        <span>·</span>
                        <span>{ROUND_TYPE_LABELS[interview.roundType] || interview.roundType}</span>
                        <span>·</span>
                        <span>{formatDate(interview.date)}</span>
                        <span>·</span>
                        <span>{interview._count.questions} 个问题</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {interview.overallScore && (
                      <span className="text-lg font-bold text-primary">
                        {interview.overallScore.toFixed(1)}
                      </span>
                    )}
                    <Badge variant={interview.status === "ai_reviewed" ? "default" : "secondary"}>
                      {INTERVIEW_STATUS_CONFIG[interview.status]?.label || interview.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
