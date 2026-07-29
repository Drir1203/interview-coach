"use client"

import { useEffect, useState } from "react"
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Building2,
  ArrowUp,
  ArrowDown,
  Minus,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SkillRadar } from "@/components/SkillRadar"
import { ScoreTrend } from "@/components/ScoreTrend"

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

export default function AnalysisPage() {
  const [data, setData] = useState<DeepAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState("all")
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/analysis/deep")
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">深入分析</h1>
        <p className="text-sm text-muted-foreground">跨公司对比、薄弱项追踪、趋势下钻</p>
      </div>

      <Tabs defaultValue="companies" className="space-y-6">
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
                          <span className="text-muted-foreground">{s.category}</span>
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
                    <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <div className="flex items-center gap-3">
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
    </div>
  )
}
