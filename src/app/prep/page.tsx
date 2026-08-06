"use client"

import { useState } from "react"
import { Target, Loader2, Sparkles, Building2, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/PageHeader"
import { ROUND_TYPES } from "@/types"

export default function PrepPage() {
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [roundType, setRoundType] = useState("first")
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState("")
  const [error, setError] = useState("")

  const handleGenerate = async () => {
    if (!company.trim() || !position.trim() || loading) return
    setError("")
    setLoading(true)
    setPlan("")
    try {
      const res = await fetch("/interview/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), position: position.trim(), roundType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "生成失败")
      setPlan(data.plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败,请稍后再试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="animate-fade-up">
        <PageHeader
          icon={Target}
          title="面试前准备"
          description="输入目标公司和岗位，AI 基于你的薄弱项生成押题清单和练习计划"
        />
      </div>

      <Card className="animate-fade-up" style={{ animationDelay: "50ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            生成面试准备方案
          </CardTitle>
          <CardDescription>填得越具体,方案越精准</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <Building2 className="size-3.5 text-muted-foreground" />目标公司
              </label>
              <Input
                placeholder="如:字节跳动"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <Briefcase className="size-3.5 text-muted-foreground" />目标岗位
              </label>
              <Input
                placeholder="如:后端开发工程师"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">面试轮次</label>
            <div className="flex flex-wrap gap-2">
              {ROUND_TYPES.map((r) => (
                <Button
                  key={r.value}
                  type="button"
                  variant={roundType === r.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoundType(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleGenerate} disabled={loading || !company.trim() || !position.trim()}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {loading ? "AI 生成中…(约 20-40 秒)" : "生成准备方案"}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <CardContent className="p-5">
            <div className="prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {plan}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
