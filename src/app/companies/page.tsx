"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, Briefcase, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CompanySummary {
  id: string
  name: string
  industry: string | null
  _count: { interviews: number }
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
      <h1 className="text-2xl font-bold tracking-tight">公司看板</h1>
      <p className="text-sm text-muted-foreground">按公司维度查看你的面试表现</p>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-4 w-24 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Building2 className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">还没有面试记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company) => {
            const reviewed = company.interviews.filter((i) => i.overallScore)
            const avgScore = reviewed.length
              ? reviewed.reduce((s, i) => s + (i.overallScore || 0), 0) / reviewed.length
              : 0

            return (
              <Card key={company.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      <CardTitle className="text-base">{company.name}</CardTitle>
                    </div>
                    <Badge variant="outline">{company._count.interviews} 场</Badge>
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
