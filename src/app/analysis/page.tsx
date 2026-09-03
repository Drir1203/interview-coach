"use client"

import { useEffect, useRef, useState } from "react"
import {
  TrendingUp,
  AlertTriangle,
  Building2,
  ArrowUp,
  ArrowDown,
  Minus,
  Loader2,
  GraduationCap,
  Download,
  BarChart3,
} from "lucide-react"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/PageHeader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SkillRadar } from "@/components/SkillRadar"
import { ScoreTrend } from "@/components/ScoreTrend"
import { useAuth } from "@/hooks/useAuth"

interface CompanyComp {
  company: string
  avgScore: number
  interviewCount: number
  skillProfile: { category: string; score: number }[]
}

interface WeaknessItem {
  category: string
  label: string
  avgScore: number
  count: number
  trend: { date: string; score: number }[]
  direction: "up" | "down" | "stable"
}

interface DeepAnalysis {
  companyComparison: CompanyComp[]
  weaknessTracking: WeaknessItem[]
  trendData: { date: string; score: number; company: string; position: string }[]
  companies: string[]
}

interface OverallAnalysis {
  skillProfile: { category: string; score: number; count?: number }[]
  stats: { total: number }
}

// 能力维度中文标签（与 SkillRadar 保持一致）
const CATEGORY_LABELS: Record<string, string> = {
  technical: "技术基础",
  behavioral: "行为面试",
  project_deep_dive: "项目深挖",
  system_design: "系统设计",
  hr: "HR 面试",
}

const CERT_FONT_FAMILY =
  '-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'

export default function AnalysisPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DeepAnalysis | null>(null)
  const [overall, setOverall] = useState<OverallAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState("all")
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [certOpen, setCertOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const certRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/interview/api/analysis/deep")
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        if (d.companyComparison.length > 0) {
          setSelectedCompanies(d.companyComparison.slice(0, 3).map((c: CompanyComp) => c.company))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // 认证卡需要整体能力画像 + 面试总场次（/api/analysis 返回 skillProfile + stats）
  useEffect(() => {
    fetch("/interview/api/analysis")
      .then((r) => r.json())
      .then((d) => setOverall(d))
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        加载失败
      </div>
    )
  }

  const filteredTrend = companyFilter === "all"
    ? data.trendData
    : data.trendData.filter((t) => t.company === companyFilter)

  // ── 认证卡数据 ──
  const certSkillProfile = overall?.skillProfile || []
  const hasCertData = certSkillProfile.length > 0
  const certChartData = certSkillProfile.map((s) => ({
    category: CATEGORY_LABELS[s.category] || s.category,
    score: s.score,
    fullMark: 10,
  }))
  const certName = user?.name || "面试者"
  const certTotal = overall?.stats.total ?? 0

  const downloadCert = async () => {
    if (!certRef.current) return
    setExporting(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      const canvas = await html2canvas(certRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const url = canvas.toDataURL("image/png")
      const a = document.createElement("a")
      a.href = url
      a.download = "ai-mianshi-cert.png"
      a.click()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <PageHeader
          icon={BarChart3}
          title="深入分析"
          description="跨公司对比、薄弱项追踪、趋势下钻"
        />
      </div>

      {/* 能力画像（整体）+ 认证卡入口 */}
      <Card className="animate-fade-up" style={{ animationDelay: "50ms" }}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">能力画像</CardTitle>
            <CardDescription>
              {hasCertData
                ? "基于全部 AI 复盘的综合能力评估"
                : "完成 AI 复盘后生成能力认证卡"}
            </CardDescription>
          </div>
          <Button size="sm" disabled={!hasCertData} onClick={() => setCertOpen(true)}>
            <GraduationCap className="size-4" />
            生成能力认证卡
          </Button>
        </CardHeader>
        <CardContent>
          {hasCertData ? (
            <SkillRadar data={certSkillProfile} />
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              暂无能力画像数据，完成 AI 复盘后生成
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="companies" className="animate-fade-up space-y-6" style={{ animationDelay: "100ms" }}>
        <TabsList>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="size-4" />
            跨公司对比
          </TabsTrigger>
          <TabsTrigger value="weakness" className="gap-2">
            <AlertTriangle className="size-4" />
            薄弱项追踪
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-2">
            <TrendingUp className="size-4" />
            趋势下钻
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 跨公司对比 */}
        <TabsContent value="companies" className="space-y-4">
          {data.companyComparison.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center text-sm text-muted-foreground">
                完成 AI 复盘后即可查看跨公司对比
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.companyComparison.map((comp) => (
                <Card key={comp.company}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{comp.company}</CardTitle>
                      <Badge variant="outline">{comp.interviewCount} 场</Badge>
                    </div>
                    <CardDescription>
                      平均评分：<span className="font-medium text-primary">{comp.avgScore.toFixed(1)}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comp.skillProfile.length > 0 ? (
                      <SkillRadar data={comp.skillProfile} />
                    ) : (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        暂无维度数据
                      </div>
                    )}
                    <div className="mt-2 space-y-1">
                      {comp.skillProfile.map((s) => (
                        <div key={s.category} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{CATEGORY_LABELS[s.category] || s.category}</span>
                          <span>{s.score.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: 薄弱项追踪 */}
        <TabsContent value="weakness" className="space-y-4">
          {data.weaknessTracking.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center text-sm text-muted-foreground">
                完成 AI 复盘后即可查看薄弱项
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.weaknessTracking.map((item) => (
                <Card key={item.category}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.label}</span>
                          <Badge variant={item.avgScore < 5 ? "destructive" : item.avgScore < 7 ? "secondary" : "outline"}>
                            {item.avgScore.toFixed(1)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.count} 题
                          </span>
                        </div>
                        <div className="mt-1">
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${(item.avgScore / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                        {item.trend.length >= 2 && (
                          <div className="mt-2 flex items-center gap-1 text-xs">
                            {item.direction === "up" ? (
                              <ArrowUp className="size-3 text-green-600" />
                            ) : item.direction === "down" ? (
                              <ArrowDown className="size-3 text-red-600" />
                            ) : (
                              <Minus className="size-3 text-muted-foreground" />
                            )}
                            <span className="text-muted-foreground">
                              最近 {item.trend.length} 场走势：
                              {item.trend.map((t, i) => (
                                <span key={i} className="ml-1">
                                  {t.score.toFixed(0)}{i < item.trend.length - 1 ? " → " : ""}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: 趋势下钻 */}
        <TabsContent value="trend" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">筛选公司：</span>
            <Select value={companyFilter} onValueChange={(v) => v && setCompanyFilter(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部公司</SelectItem>
                {data.companies.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredTrend.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center text-sm text-muted-foreground">
                暂无趋势数据
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                {filteredTrend.length > 1 ? (
                  <ScoreTrend data={filteredTrend} />
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    至少需要 2 场已复盘的面试才能显示趋势
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 数据明细 */}
          {filteredTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">数据明细</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredTrend.slice().reverse().map((t, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-muted-foreground">{t.date}</span>
                        <span className="font-medium">{t.company}</span>
                        <span className="text-muted-foreground">{t.position}</span>
                      </div>
                      <span className="font-bold text-primary">{t.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 能力认证卡弹窗 */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>能力认证卡</DialogTitle>
            <DialogDescription>分享你的 AI 能力认证</DialogDescription>
          </DialogHeader>

          {/* 待导出的认证卡（内联样式，便于 html2canvas 捕获） */}
          <div
            ref={certRef}
            style={{
              width: "min(340px, 86vw)",
              boxSizing: "border-box",
              background: "#ffffff",
              border: "2px solid #6366f1",
              borderRadius: 16,
              padding: "20px 16px",
              textAlign: "center",
              color: "#1f2937",
              fontFamily: CERT_FONT_FAMILY,
              margin: "0 auto",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1" }}>AI 面师 · 能力认证</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginTop: 6 }}>{certName}</div>

            <div style={{ width: "min(260px, 74vw)", height: 220, margin: "12px auto 0" }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={certChartData} outerRadius="72%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="score"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: 12 }}>
              {certChartData.map((d) => (
                <div
                  key={d.category}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  <span>{d.category}</span>
                  <span style={{ fontWeight: 600, color: "#6366f1" }}>{d.score.toFixed(1)}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: "1px solid #e5e7eb",
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              由 AI 面师 AI 评估 · 数据来自 {certTotal} 场真实面试
            </div>
          </div>

          <Button onClick={downloadCert} disabled={exporting} className="w-full">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            保存图片
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
