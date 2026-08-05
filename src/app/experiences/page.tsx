"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BookOpen,
  ShieldCheck,
  Search,
  Loader2,
  PlusCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUND_TYPES, ROUND_TYPE_LABELS } from "@/types"
import { formatDate } from "@/lib/utils"
import { toast } from "@/components/ui/toast"

interface Experience {
  id: string
  company: string
  position: string
  round: string
  question: string
  answer: string | null
  createdAt: string
}

export default function ExperiencesPage() {
  // 搜索
  const [searchCompany, setSearchCompany] = useState("")
  const [searchPosition, setSearchPosition] = useState("")
  // 列表
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // 贡献表单
  const [dialogOpen, setDialogOpen] = useState(false)
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [round, setRound] = useState("first")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchExperiences = useCallback(
    async (companyParam = "", positionParam = "") => {
      setLoading(true)
      setLoadError(null)
      try {
        const params = new URLSearchParams()
        if (companyParam) params.set("company", companyParam)
        if (positionParam) params.set("position", positionParam)
        const qs = params.toString()
        const res = await fetch(`/interview/api/experiences${qs ? `?${qs}` : ""}`)
        if (!res.ok) throw new Error("加载失败")
        const data = await res.json()
        setExperiences(data)
      } catch {
        setLoadError("加载面经失败，请稍后重试")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchExperiences()
  }, [fetchExperiences])

  const handleSearch = () => {
    fetchExperiences(searchCompany.trim(), searchPosition.trim())
  }

  const handleSubmit = async () => {
    if (!company.trim() || !position.trim() || !question.trim()) {
      setFormError("公司、岗位、题目为必填项")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch("/interview/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          position: position.trim(),
          round,
          question: question.trim(),
          answer: answer.trim() || undefined,
        }),
      })
      if (!res.ok) {
        let msg = "提交失败"
        try {
          const err = await res.json()
          msg = err.error || msg
        } catch { /* 非 JSON 响应 */ }
        throw new Error(msg)
      }
      setDialogOpen(false)
      setCompany("")
      setPosition("")
      setRound("first")
      setQuestion("")
      setAnswer("")
      toast.add({
        title: "贡献成功",
        description: "感谢分享，面经已收录并展示在面经库",
        type: "success",
      })
      // 刷新列表，若当前有搜索条件则一并带上
      fetchExperiences(searchCompany.trim(), searchPosition.trim())
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "提交失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  const hasSearch = Boolean(searchCompany.trim() || searchPosition.trim())

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BookOpen className="size-6 text-primary" />
            面经库
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-green-600" />
            匿名贡献，脱敏后帮助更多候选人
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <PlusCircle className="size-4" />
          贡献真实面经
        </Button>
      </div>

      {/* 搜索 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-primary" />
            搜索面经
          </CardTitle>
          <CardDescription>输入公司或岗位关键词，查询候选人的真实面试题</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="公司名，如：字节跳动"
              value={searchCompany}
              onChange={(e) => setSearchCompany(e.target.value)}
              className="sm:max-w-56"
            />
            <Input
              placeholder="岗位，如：前端开发"
              value={searchPosition}
              onChange={(e) => setSearchPosition(e.target.value)}
              className="sm:max-w-56"
            />
            <Button onClick={handleSearch} className="gap-2">
              <Search className="size-4" />
              查询
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      {loadError && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchExperiences(searchCompany.trim(), searchPosition.trim())}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !loadError && experiences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BookOpen className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {hasSearch ? "没有找到相关面经，换个关键词试试" : "还没有面经，来贡献第一条吧"}
            </p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
              <PlusCircle className="size-4" />
              贡献第一条面经
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {experiences.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{exp.company}</Badge>
                  <Badge variant="secondary">{exp.position}</Badge>
                  <Badge variant="outline">{ROUND_TYPE_LABELS[exp.round] || exp.round}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDate(exp.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium">{exp.question}</p>
                {exp.answer && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <span className="text-xs font-medium text-muted-foreground">参考答案</span>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{exp.answer}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 贡献 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>贡献真实面经</DialogTitle>
            <DialogDescription>
              匿名提交，平台会脱敏后展示，帮助更多候选人备考
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">公司 *</label>
                <Input
                  placeholder="如：字节跳动"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">岗位 *</label>
                <Input
                  placeholder="如：后端开发工程师"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">轮次</label>
              <Select value={round} onValueChange={(v) => v && setRound(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUND_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">题目 *</label>
              <Textarea
                placeholder="面试官问了什么问题？"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">你的回答（可选）</label>
              <Textarea
                placeholder="你是如何回答的？（可选，帮助其他人参考）"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
