"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BookOpen,
  ShieldCheck,
  Search,
  Loader2,
  PlusCircle,
  FolderOpen,
  RotateCcw,
  History,
  Wand2,
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
import { Checkbox } from "@/components/ui/checkbox"
import { ROUND_TYPES, ROUND_TYPE_LABELS } from "@/types"
import { formatDate } from "@/lib/utils"
import { toast } from "@/components/ui/toast"
import ExperienceDraftEditor, {
  type DraftEntry,
  type ExperienceDraftItem,
} from "@/components/ExperienceDraftEditor"

interface Experience {
  id: string
  company: string
  position: string
  round: string
  question: string
  answer: string | null
  createdAt: string
}

interface MyInterview {
  id: string
  date: string
  position: string
  roundType: string
  company: { id: string; name: string; industry: string | null }
  _count: { questions: number }
}

interface MyInterviewDetail {
  id: string
  position: string
  company: { id: string; name: string; industry: string | null }
  questions: { id: string; questionText: string; userAnswer: string | null }[]
}

type ContributeMode = "manual" | "import"
type ImportStep = "select" | "questions" | "draft"

export default function ExperiencesPage() {
  // 搜索
  const [searchCompany, setSearchCompany] = useState("")
  const [searchPosition, setSearchPosition] = useState("")
  // 列表
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // 手动贡献表单
  const [dialogOpen, setDialogOpen] = useState(false)
  const [contributeMode, setContributeMode] = useState<ContributeMode>("manual")
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [round, setRound] = useState("first")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // 导入贡献（从我的面试）
  const [myInterviews, setMyInterviews] = useState<MyInterview[]>([])
  const [selectedInterviewId, setSelectedInterviewId] = useState("")
  const [selectedInterview, setSelectedInterview] = useState<MyInterviewDetail | null>(null)
  const [importQuestionIds, setImportQuestionIds] = useState<Set<string>>(new Set())
  const [importStep, setImportStep] = useState<ImportStep>("select")
  const [loadingInterview, setLoadingInterview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  // 我的贡献（B）
  const [myContributions, setMyContributions] = useState<Experience[]>([])
  const [loadingMine, setLoadingMine] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

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

  const fetchMyContributions = useCallback(async () => {
    setLoadingMine(true)
    try {
      const res = await fetch("/interview/api/experiences/mine")
      if (res.ok) {
        const data = await res.json()
        setMyContributions(data)
      }
    } catch {
      // 我的贡献加载失败不阻塞主流程
    } finally {
      setLoadingMine(false)
    }
  }, [])

  useEffect(() => {
    fetchExperiences()
    fetchMyContributions()
  }, [fetchExperiences, fetchMyContributions])

  const handleSearch = () => {
    fetchExperiences(searchCompany.trim(), searchPosition.trim())
  }

  // ────────── 手动填写 ──────────

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
      fetchExperiences(searchCompany.trim(), searchPosition.trim())
      fetchMyContributions()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "提交失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  // ────────── 从我的面试导入 ──────────

  const openDialog = (mode: ContributeMode = "manual") => {
    setContributeMode(mode)
    setImportStep("select")
    setImportError(null)
    setSelectedInterview(null)
    setSelectedInterviewId("")
    setImportQuestionIds(new Set())
    setDraftEntries([])
    setDialogOpen(true)
    if (mode === "import" && myInterviews.length === 0) {
      fetch("/interview/api/interviews")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) =>
          setMyInterviews(
            (data as MyInterview[]).filter((iv) => iv._count.questions > 0)
          )
        )
        .catch(() => setMyInterviews([]))
    }
  }

  const switchMode = (mode: ContributeMode) => {
    setContributeMode(mode)
    setImportStep("select")
    setImportError(null)
    setSelectedInterview(null)
    setSelectedInterviewId("")
    setImportQuestionIds(new Set())
    setDraftEntries([])
  }

  const handleNextToQuestions = async () => {
    if (!selectedInterviewId) {
      setImportError("请先选择一场面试")
      return
    }
    setLoadingInterview(true)
    setImportError(null)
    try {
      const res = await fetch(`/interview/api/interviews/${selectedInterviewId}`)
      if (!res.ok) throw new Error("加载面试详情失败")
      const data = (await res.json()) as MyInterviewDetail
      setSelectedInterview(data)
      setImportQuestionIds(new Set())
      setImportStep("questions")
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "加载面试详情失败")
    } finally {
      setLoadingInterview(false)
    }
  }

  const toggleImportQuestion = (questionId: string) => {
    setImportQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  const handleGenerateDraft = async () => {
    if (!selectedInterview || importQuestionIds.size === 0) {
      setImportError("请至少勾选一道题目")
      return
    }
    setGenerating(true)
    setImportError(null)
    try {
      const res = await fetch("/interview/api/experiences/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
          questionIds: [...importQuestionIds],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "生成失败")
      }
      const entries = Array.isArray(data.entries) ? data.entries : []
      if (entries.length === 0) {
        setImportError("没有生成出草稿，请重试")
        return
      }
      setDraftEntries(
        entries.map((e: any, i: number) => ({
          key: `draft-${i}`,
          position: e.position || selectedInterview.position,
          round: e.round || "other",
          question: e.question || "",
          answer: e.answer || "",
          originalQuestion: e.originalQuestion || "",
          originalAnswer: e.originalAnswer || null,
        }))
      )
      setImportStep("draft")
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "生成失败，请稍后重试")
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmitDraft = async (items: ExperienceDraftItem[]) => {
    setSubmitting(true)
    setImportError(null)
    try {
      const res = await fetch("/interview/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
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
      setDraftEntries([])
      toast.add({
        title: "贡献成功",
        description: `已提交 ${items.length} 条脱敏面经，感谢分享！`,
        type: "success",
      })
      fetchExperiences(searchCompany.trim(), searchPosition.trim())
      fetchMyContributions()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "提交失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  // ────────── 我的贡献：撤回（B） ──────────

  const handleWithdraw = async (id: string) => {
    if (!window.confirm("确定撤回这条面经？撤回后将从面经库移除。")) return
    setWithdrawingId(id)
    try {
      const res = await fetch(`/interview/api/experiences/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "撤回失败")
      }
      setMyContributions((prev) => prev.filter((e) => e.id !== id))
      toast.add({ title: "已撤回", description: "该面经已从面经库移除", type: "success" })
      fetchExperiences(searchCompany.trim(), searchPosition.trim())
    } catch (err) {
      toast.add({
        title: "撤回失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setWithdrawingId(null)
    }
  }

  const hasSearch = Boolean(searchCompany.trim() || searchPosition.trim())
  const dialogWidth = contributeMode === "import" ? "sm:max-w-2xl" : "sm:max-w-md"

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
            匿名贡献，AI 脱敏后帮助更多候选人
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openDialog("import")} className="gap-2">
            <FolderOpen className="size-4" />
            从我的面试导入
          </Button>
          <Button onClick={() => openDialog("manual")} className="gap-2">
            <PlusCircle className="size-4" />
            手动贡献
          </Button>
        </div>
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

      {/* 我的贡献（B） */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" />
            我的贡献
          </CardTitle>
          <CardDescription>你贡献过的面经，可随时撤回</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMine ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : myContributions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              还没有贡献过面经，来分享第一份吧
            </p>
          ) : (
            <div className="space-y-2">
              {myContributions.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default">{exp.company}</Badge>
                      <Badge variant="secondary">{exp.position}</Badge>
                      <Badge variant="outline">
                        {ROUND_TYPE_LABELS[exp.round] || exp.round}
                      </Badge>
                    </div>
                    <p className="mt-1.5 truncate text-sm">{exp.question}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(exp.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive"
                    disabled={withdrawingId === exp.id}
                    onClick={() => handleWithdraw(exp.id)}
                  >
                    {withdrawingId === exp.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    撤回
                  </Button>
                </div>
              ))}
            </div>
          )}
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openDialog("import")} className="gap-2">
                <FolderOpen className="size-4" />
                从我的面试导入
              </Button>
              <Button variant="outline" size="sm" onClick={() => openDialog("manual")} className="gap-2">
                <PlusCircle className="size-4" />
                手动填写
              </Button>
            </div>
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

      {/* 贡献 Dialog（手动 / 导入双模式） */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={dialogWidth}>
          <DialogHeader>
            <DialogTitle>
              {contributeMode === "import" && importStep === "draft"
                ? "确认脱敏面经草稿"
                : "贡献真实面经"}
            </DialogTitle>
            <DialogDescription>
              {contributeMode === "import"
                ? "从已记录的面试中勾选题目，AI 自动脱敏抽象成通用面经"
                : "匿名提交，平台会脱敏后展示，帮助更多候选人备考"}
            </DialogDescription>
          </DialogHeader>

          {importStep !== "draft" && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
              <Button
                size="sm"
                variant={contributeMode === "manual" ? "default" : "ghost"}
                onClick={() => switchMode("manual")}
              >
                手动填写
              </Button>
              <Button
                size="sm"
                variant={contributeMode === "import" ? "default" : "ghost"}
                onClick={() => switchMode("import")}
              >
                从我的面试导入
              </Button>
            </div>
          )}

          {contributeMode === "manual" && importStep !== "draft" ? (
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
          ) : contributeMode === "import" && importStep === "select" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择一场已记录的面试</label>
                {myInterviews.length === 0 ? (
                  <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                    没有可导入的面试记录（需要有题目）。请先到「面试记录」里录入面试。
                  </p>
                ) : (
                  <Select
                    value={selectedInterviewId}
                    onValueChange={(v) => v && setSelectedInterviewId(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择面试" />
                    </SelectTrigger>
                    <SelectContent>
                      {myInterviews.map((iv) => (
                        <SelectItem key={iv.id} value={iv.id}>
                          {iv.company.name} · {iv.position} · {formatDate(iv.date)}（
                          {iv._count.questions} 题）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {importError && <p className="text-sm text-destructive">{importError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleNextToQuestions}
                  disabled={!selectedInterviewId || loadingInterview}
                >
                  {loadingInterview && <Loader2 className="mr-2 size-4 animate-spin" />}
                  下一步：勾选题目
                </Button>
              </DialogFooter>
            </div>
          ) : contributeMode === "import" && importStep === "questions" ? (
            <div className="space-y-4">
              {selectedInterview && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="default">{selectedInterview.company.name}</Badge>
                  <Badge variant="secondary">{selectedInterview.position}</Badge>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">勾选要贡献的题目</label>
                {selectedInterview && selectedInterview.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">这场面试还没有录入问题</p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-3">
                    {selectedInterview?.questions.map((q, i) => (
                      <label
                        key={q.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={importQuestionIds.has(q.id)}
                          onCheckedChange={() => toggleImportQuestion(q.id)}
                          className="mt-0.5"
                        />
                        <span className="text-sm">
                          <span className="font-medium text-muted-foreground">Q{i + 1}</span>{" "}
                          {q.questionText}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-green-600" />
                AI 将把勾选的题目抽象脱敏成通用面经，你确认后再提交
              </p>

              {importError && <p className="text-sm text-destructive">{importError}</p>}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setImportStep("select")}
                  disabled={generating}
                >
                  返回
                </Button>
                <Button onClick={handleGenerateDraft} disabled={importQuestionIds.size === 0 || generating}>
                  {generating && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {generating ? "AI 正在抽象脱敏…" : (
                    <>
                      <Wand2 className="mr-2 size-4" />
                      AI 生成脱敏草稿
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : contributeMode === "import" && importStep === "draft" ? (
            <div className="space-y-3">
              <ExperienceDraftEditor
                company={selectedInterview?.company.name || ""}
                industry={selectedInterview?.company.industry || null}
                sourceInterviewId={selectedInterview?.id || null}
                entries={draftEntries}
                submitting={submitting}
                onChange={setDraftEntries}
                onSubmit={handleSubmitDraft}
                onCancel={() => {
                  setDraftEntries([])
                  setImportStep("questions")
                }}
              />
              {importError && <p className="text-sm text-destructive">{importError}</p>}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
