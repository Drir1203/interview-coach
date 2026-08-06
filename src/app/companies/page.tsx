"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, Briefcase, TrendingUp, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"

interface CompanySummary {
  id: string
  name: string
  industry: string | null
  interviews: {
    id: string
    position: string
    date: string
    overallScore: number | null
    status: string
  }[]
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/interview/api/interviews")
      .then((r) => r.json())
      .then((interviews: any[]) => {
        const grouped: Record<string, CompanySummary> = {}
        for (const iv of interviews) {
          const c = iv.company
          if (!grouped[c.id]) {
            grouped[c.id] = { ...c, interviews: [] }
          }
          grouped[c.id].interviews.push({
            id: iv.id,
            position: iv.position,
            date: iv.date,
            overallScore: iv.overallScore,
            status: iv.status,
          })
        }
        setCompanies(Object.values(grouped))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <PageHeader icon={Building2} title="公司看板" description="按公司维度查看你的面试表现" />
      </div>

      {loading ? (
        <div className="animate-fade-up flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : companies.length === 0 ? (
        <Card className="animate-fade-up py-16" style={{ animationDelay: "60ms" }}>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Building2 className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">还没有面试记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="animate-fade-up grid gap-4 md:grid-cols-2" style={{ animationDelay: "60ms" }}>
          {companies.map((company) => {
            const reviewed = company.interviews.filter((i) => i.overallScore)
            const avgScore = reviewed.length
              ? reviewed.reduce((s, i) => s + (i.overallScore || 0), 0) / reviewed.length
              : 0

            return (
              <Card key={company.id} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      <CardTitle className="text-base">{company.name}</CardTitle>
                    </div>
                    <Badge variant="outline">{company.interviews.length} 场</Badge>
                  </div>
                  {company.industry && (
                    <p className="text-xs text-muted-foreground">{company.industry}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {avgScore > 0 && (
                    <div className="mb-3 flex items-center gap-2 text-sm">
                      <TrendingUp className="size-3 text-primary" />
                      <span>平均评分 <strong>{avgScore.toFixed(1)}</strong></span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {company.interviews.slice(0, 3).map((iv) => (
                      <Link
                        key={iv.id}
                        href={`/interviews/${iv.id}`}
                        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-muted"
                      >
                        <div className="flex items-center gap-2">
                          <Briefcase className="size-3 text-muted-foreground" />
                          <span>{iv.position}</span>
                        </div>
                        {iv.overallScore && (
                          <span className="font-medium text-primary">
                            {iv.overallScore.toFixed(1)}
                          </span>
                        )}
                      </Link>
                    ))}
                    {company.interviews.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        还有 {company.interviews.length - 3} 场面试
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
