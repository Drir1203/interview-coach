"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Brain,
  Loader2,
  Download,
  Sparkles,
  RefreshCw,
  Send,
  Wand2,
  ShieldCheck,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/toast"
import { formatDate, formatDateTime } from "@/lib/utils"
import { useSubscription } from "@/hooks/useSubscription"
import { redirectToPricing } from "@/lib/api"
import {
  ROUND_TYPE_LABELS,
  INTERVIEW_STATUS_CONFIG,
  INTERVIEW_RESULTS,
  type AIReviewOutput,
} from "@/types"
import Link from "next/link"
import { exportInterviewPdf } from "@/lib/pdf-export"
import ExperienceDraftEditor, {
  type DraftEntry,
  type ExperienceDraftItem,
} from "@/components/ExperienceDraftEditor"

interface Question {
  id: string
  order: number
  questionText: string
  userAnswer: string | null
  userScore: number | null
  aiScore: number | null
  aiFeedback: string | null
  aiImprovedAnswer: string | null
  aiCategory: string | null
  aiKeyMistake: string | null
}

interface InterviewDetail {
  id: string
  date: string
  createdAt: string
  position: string
  roundType: string
  status: string
  overallScore: number | null
  overallFeedback: string | null
  strengths: string | null
  improvementAreas: string | null
  weaknessAreas: string | null
  userNotes: string | null
  result: string | null
  transcript?: string | null // AI 语音面试原始转写
  durationSec?: number | null // AI 语音面试通话时长（秒）
  company: { name: string; industry: string | null }
  questions: Question[]
  tags: { tag: { name: string; color: string } }[]
}

export default function InterviewDetail() {
  const params = useParams()
  const router = useRouter()
  const { info: subInfo } = useSubscription()
  const isFreeUser = subInfo?.tier === "free"
  const [interview, setInterview] = useState<InterviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [reviewResult, setReviewResult] = useState<AIReviewOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showImproved, setShowImproved] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  // 按题重新生成分析：regenOpen 记录当前展开自定义输入的题目 id
  const [regenOpen, setRegenOpen] = useState<string | null>(null)
  const [regenInstr, setRegenInstr] = useState("")
  const [regenerating, setRegenerating] = useState<string | null>(null)
  // 全局重新分析的自定义输入
  const [globalInstrOpen, setGlobalInstrOpen] = useState(false)
  const [globalInstr, setGlobalInstr] = useState("")
  // 贡献这场面试的真实题目
  const [contributeOpen, setContributeOpen] = useState(false)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [contributing, setContributing] = useState(false)
  const [contributeError, setContributeError] = useState<string | null>(null)
  // 贡献流程：勾选题目 → AI 抽象草稿 → 确认提交
  const [contributeStep, setContributeStep] = useState<"questions" | "draft">("questions")
  const [generating, setGenerating] = useState(false)
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([])
  // AI 语音面试原始转写是否展开（默认收起，转写可能很长）
  const [showTranscript, setShowTranscript] = useState(false)
  // 「我的备注」：复盘后可随手记录自己的想法（如：下次该怎么答）
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesDraft, setNotesDraft] = useState("")
  const [notesSaving, setNotesSaving] = useState(false)

  useEffect(() => {
    fetch(`/interview/api/interviews/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setInterview(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  // Pro 锁定引导：free 用户点击 AI 复盘类操作 → 提示 + 跳价格页
  const goUpgrade = () => {
    toast.add({
      title: "Pro 会员专享",
      description: "AI 深度复盘为 Pro 功能，升级后即可使用",
      type: "info",
    })
    redirectToPricing()
  }

  const handleAIReview = async (instruction?: string) => {
    if (isFreeUser) {
      goUpgrade()
      return
    }
    setReviewing(true)
    setError(null)
    try {
      const res = await fetch("/interview/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: params.id, instruction }),
      })
      if (res.status === 402) {
        goUpgrade()
        return
      }
      if (!res.ok) {
        let msg = "AI 复盘失败"
        try {
          const err = await res.json()
          msg = err.error || msg
        } catch { /* 非 JSON 响应 */ }
        throw new Error(msg)
      }
      const result = await res.json()
      setReviewResult(result)
      setGlobalInstrOpen(false)
      setGlobalInstr("")

      // 刷新页面数据
      const updated = await fetch(`/interview/api/interviews/${params.id}`).then((r) => r.json())
      setInterview(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 复盘失败，请稍后重试")
    } finally {
      setReviewing(false)
    }
  }

  // 展开/收起某题的自定义输入
  const toggleRegen = (questionId: string) => {
    if (regenOpen === questionId) {
      setRegenOpen(null)
      setRegenInstr("")
    } else {
      setRegenOpen(questionId)
      setRegenInstr("")
    }
  }

  // 按题重新生成 AI 分析（支持自定义要求）
  const handleRegenQuestion = async (questionId: string) => {
    if (isFreeUser) {
      goUpgrade()
      return
    }
    if (regenerating) return
    setRegenerating(questionId)
    try {
      const res = await fetch("/interview/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: params.id,
          mode: "question",
          questionId,
          instruction: regenInstr,
        }),
      })
      if (res.status === 402) {
        goUpgrade()
        return
      }
      if (!res.ok) {
        let msg = "重新生成失败"
        try {
          const err = await res.json()
          msg = err.error || msg
        } catch { /* 非 JSON 响应 */ }
        throw new Error(msg)
      }
      // 刷新页面数据以展示该题新分析
      const updated = await fetch(`/interview/api/interviews/${params.id}`).then((r) => r.json())
      setInterview(updated)
      setRegenOpen(null)
      setRegenInstr("")
    } catch (err) {
      alert("重新生成失败：" + (err instanceof Error ? err.message : "未知错误"))
    } finally {
      setRegenerating(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm("确定删除这条面试记录？")) return
    await fetch(`/interview/api/interviews/${params.id}`, { method: "DELETE" })
    router.push("/interviews")
  }

  const updateResult = async (result: string) => {
    await fetch(`/interview/api/interviews/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    })
    setInterview((prev) => prev ? { ...prev, result } : prev)
  }

  // 「我的备注」：进入编辑态（把已有内容带入草稿）
  const startEditNotes = () => {
    if (!interview) return
    setNotesDraft(interview.userNotes || "")
    setNotesEditing(true)
  }

  const cancelEditNotes = () => {
    setNotesEditing(false)
    setNotesDraft("")
  }

  // 保存/清空备注：与后端 PUT 部分更新合并；空串即清空（route 用 ?? 保留 null 语义，故清空发 ""）
  const saveNotes = async () => {
    if (!interview || notesSaving) return
    setNotesSaving(true)
    try {
      const res = await fetch(`/interview/api/interviews/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNotes: notesDraft.trim() }),
      })
      if (!res.ok) throw new Error("保存失败")
      const updated = await res.json()
      setInterview(updated)
      setNotesEditing(false)
      toast.add({ title: "备注已保存" })
    } catch (err) {
      toast.add({
        title: "备注保存失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setNotesSaving(false)
    }
  }

  const clearNotes = async () => {
    if (!interview || !interview.userNotes || notesSaving) return
    if (!confirm("清空这条备注？")) return
    setNotesSaving(true)
    try {
      const res = await fetch(`/interview/api/interviews/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNotes: "" }),
      })
      if (!res.ok) throw new Error("清空失败")
      const updated = await res.json()
      setInterview(updated)
      toast.add({ title: "备注已清空" })
    } catch (err) {
      toast.add({
        title: "清空失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setNotesSaving(false)
    }
  }

  const handleExportPdf = async () => {
    if (!interview) return
    setExporting(true)
    try {
      await exportInterviewPdf(interview)
    } catch (err) {
      alert("PDF 导出失败：" + (err instanceof Error ? err.message : "未知错误"))
    } finally {
      setExporting(false)
    }
  }

  const openContributeDialog = () => {
    if (!interview) return
    setSelectedQuestionIds(new Set())
    setContributeError(null)
    setContributeStep("questions")
    setDraftEntries([])
    setContributeOpen(true)
  }

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  const handleGenerateDraft = async () => {
    if (!interview) return
    if (selectedQuestionIds.size === 0) {
      setContributeError("请至少勾选一道题目")
      return
    }
    setGenerating(true)
    setContributeError(null)
    try {
      const res = await fetch("/interview/api/experiences/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: interview.id,
          questionIds: [...selectedQuestionIds],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "生成失败")
      }
      const entries = Array.isArray(data.entries) ? data.entries : []
      if (entries.length === 0) {
        setContributeError("没有生成出草稿，请重试")
        return
      }
      setDraftEntries(
        entries.map((e: any, i: number) => ({
          key: `draft-${i}`,
          position: e.position || interview.position,
          round: e.round || "other",
          question: e.question || "",
          answer: e.answer || "",
          originalQuestion: e.originalQuestion || "",
          originalAnswer: e.originalAnswer || null,
        }))
      )
      setContributeStep("draft")
    } catch (err) {
      setContributeError(err instanceof Error ? err.message : "生成失败，请稍后重试")
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmitDraft = async (items: ExperienceDraftItem[]) => {
    setContributing(true)
    setContributeError(null)
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
      const count = items.length
      setContributeOpen(false)
      setSelectedQuestionIds(new Set())
      setDraftEntries([])
      setContributeStep("questions")
      toast.add({
        title: "贡献成功",
        description: `已贡献 ${count} 道脱敏面经，感谢！`,
        type: "success",
      })
    } catch (err) {
      setContributeError(err instanceof Error ? err.message : "提交失败，请稍后重试")
    } finally {
      setContributing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">面试记录不存在</p>
        <Link href="/interviews">
          <Button variant="outline">返回列表</Button>
        </Link>
      </div>
    )
  }

  const hasAIReview = interview.status === "ai_reviewed" || reviewResult
  const strengths = hasAIReview
    ? JSON.parse(interview.strengths || "[]") || reviewResult?.strengths || []
    : []
  const improvementAreas = hasAIReview
    ? JSON.parse(interview.improvementAreas || "[]") || reviewResult?.improvementAreas || []
    : []
  const weaknessAreas = hasAIReview
    ? JSON.parse(interview.weaknessAreas || "[]") || reviewResult?.weaknessAreas || []
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/interviews">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {interview.company.name}
              </h1>
              <Badge variant={interview.status === "ai_reviewed" ? "default" : "secondary"}>
                {INTERVIEW_STATUS_CONFIG[interview.status]?.label || interview.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {interview.position}
              {" · "}
              {ROUND_TYPE_LABELS[interview.roundType] || interview.roundType}
              {" · "}
              {formatDate(interview.date)}
            </p>
            {/* 面试结果标注 */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">面试结果：</span>
              {INTERVIEW_RESULTS.map((r) => (
                <Badge
                  key={r.value}
                  variant={interview.result === r.value ? "default" : "outline"}
                  className="cursor-pointer transition-colors hover:opacity-80"
                  onClick={() => updateResult(r.value)}
                >
                  {interview.result === r.value && "✓ "}
                  {r.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <Download className="mr-1 size-3" />
            )}
            导出 PDF
          </Button>
          <Link href={`/interviews/${interview.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit3 className="mr-1 size-3" />
              编辑
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1 size-3" />
            删除
          </Button>
        </div>
      </div>

      {/* AI 复盘区域 */}
      {!hasAIReview ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Brain className="size-10 text-muted-foreground/40" />
            <div>
              <CardTitle className="text-lg">AI 复盘</CardTitle>
              <CardDescription className="mt-1">
                AI 将分析你的面试回答，给出评分和改进建议
              </CardDescription>
            </div>
            {interview.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">请先录入面试问题</p>
            ) : isFreeUser ? (
              <Button onClick={goUpgrade} className="gap-2">
                <Lock className="size-4" />
                Pro 会员专享 · 升级解锁
              </Button>
            ) : (
              <Button onClick={() => handleAIReview()} disabled={reviewing} className="gap-2">
                {reviewing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Brain className="size-4" />
                )}
                {reviewing ? "AI 分析中..." : "开始 AI 复盘"}
              </Button>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        /* AI 复盘结果 */
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="size-4 text-primary" />
                  AI 复盘结果
                </CardTitle>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button variant="outline" size="sm" onClick={openContributeDialog} className="gap-1">
                    <Send className="size-3" />
                    贡献这场面试的真实题目
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewing}
                    onClick={() => {
                      if (globalInstrOpen) {
                        setGlobalInstrOpen(false)
                        setGlobalInstr("")
                      } else {
                        handleAIReview(globalInstr)
                      }
                    }}
                  >
                    {reviewing ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 size-3" />
                    )}
                    {globalInstrOpen ? "取消" : "重新分析"}
                  </Button>
                  {globalInstrOpen && (
                    <div className="w-full space-y-2 sm:w-80">
                      <textarea
                        value={globalInstr}
                        onChange={(e) => setGlobalInstr(e.target.value)}
                        placeholder="自定义要求（可选），如：更深入分析，指出薄弱点并给出针对性练习建议"
                        rows={2}
                        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <Button size="sm" disabled={reviewing} onClick={() => handleAIReview(globalInstr)}>
                        {reviewing ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                        用此要求重新生成
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 总体评分 */}
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-3xl font-bold text-primary">
                    {interview.overallScore?.toFixed(1) || reviewResult?.overallScore?.toFixed(1) || "-"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">总体评分</p>
              </div>

              {/* 总体反馈 */}
              {interview.overallFeedback && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">总体评价</h3>
                  <p className="text-sm text-muted-foreground">{interview.overallFeedback}</p>
                </div>
              )}

              <Separator />

              {/* 优点 */}
              {strengths.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-green-600">✅ 优点</h3>
                  <ul className="space-y-1">
                    {strengths.map((s: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 改进方向 */}
              {improvementAreas.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-amber-600">🔴 改进方向</h3>
                  <ul className="space-y-1">
                    {improvementAreas.map((s: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 薄弱维度 */}
              {weaknessAreas.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-2 text-sm font-medium">薄弱维度</h3>
                    <div className="space-y-2">
                      {weaknessAreas.map((w: { category: string; score: number; description?: string }, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <Badge variant="outline">{w.category}</Badge>
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${w.score * 10}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {w.score.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* AI 教练下一步建议(面试后闭环) */}
              {reviewResult?.nextSteps && (
                <>
                  <Separator />
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-primary">
                      <Sparkles className="size-4" />
                      AI 教练建议 · 接下来练什么
                    </h3>
                    <p className="text-sm leading-relaxed">{reviewResult.nextSteps}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 面试问题列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            面试问题（{interview.questions.length}）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {interview.questions.map((q, i) => (
            <div key={q.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Q{i + 1}
                  </span>
                  <p className="mt-1 text-sm font-medium">{q.questionText}</p>
                </div>
                {q.aiScore && (
                  <div className="ml-4 flex size-8 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-bold text-primary">{q.aiScore.toFixed(0)}</span>
                  </div>
                )}
              </div>

              {q.userAnswer && (
                <div>
                  <span className="text-xs text-muted-foreground">你的回答：</span>
                  <p className="mt-0.5 text-sm text-muted-foreground">{q.userAnswer}</p>
                </div>
              )}

              {/* AI 反馈 */}
              {q.aiFeedback && (
                <div className="mt-2 rounded-lg bg-muted/50 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="text-xs font-medium text-primary">AI 反馈</span>
                      <p className="mt-1 text-sm">{q.aiFeedback}</p>
                      {q.aiKeyMistake && (
                        <p className="mt-1 text-sm text-destructive">
                          关键失误：{q.aiKeyMistake}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {q.aiImprovedAnswer && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1"
                          onClick={() =>
                            setShowImproved(showImproved === q.id ? null : q.id)
                          }
                        >
                          {showImproved === q.id ? "收起" : "查看优化回答"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1"
                        disabled={regenerating !== null}
                        onClick={() => toggleRegen(q.id)}
                      >
                        {regenerating === q.id ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 size-3" />
                        )}
                        {regenOpen === q.id ? "取消" : "重新生成"}
                      </Button>
                    </div>
                  </div>

                  {/* 按题重新生成的自定义输入 */}
                  {regenOpen === q.id && (
                    <div className="mt-3 space-y-2 border-t border-muted-foreground/20 pt-3">
                      <textarea
                        value={regenInstr}
                        onChange={(e) => setRegenInstr(e.target.value)}
                        placeholder="自定义要求（可选），如：更深入分析、结合简历中的项目经历展开"
                        rows={2}
                        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRegenOpen(null)
                            setRegenInstr("")
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          disabled={regenerating !== null}
                          onClick={() => handleRegenQuestion(q.id)}
                        >
                          {regenerating === q.id ? (
                            <Loader2 className="mr-1 size-3 animate-spin" />
                          ) : null}
                          生成
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 优化回答 */}
                  {showImproved === q.id && q.aiImprovedAnswer && (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <span className="text-xs font-medium text-primary">优化回答</span>
                      <p className="mt-1 text-sm">{q.aiImprovedAnswer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 我的备注：复盘后可随手记录自己的想法（如：下次该怎么答） */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            我的备注
            {!notesEditing &&
              (interview.userNotes ? (
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1"
                    onClick={startEditNotes}
                  >
                    <Edit3 className="mr-1 size-3.5" /> 编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-destructive hover:text-destructive"
                    onClick={clearNotes}
                  >
                    <Trash2 className="mr-1 size-3.5" /> 清空
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1"
                  onClick={startEditNotes}
                >
                  <Edit3 className="mr-1 size-3.5" /> 写备注
                </Button>
              ))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notesEditing ? (
            <div className="space-y-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="记下复盘后的新想法，比如：这类问题下次先讲结论，再用 STAR 结构补一个数据例子…"
                rows={4}
                maxLength={2000}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={cancelEditNotes}>
                  取消
                </Button>
                <Button size="sm" disabled={notesSaving} onClick={saveNotes}>
                  {notesSaving && <Loader2 className="mr-1 size-3 animate-spin" />}
                  保存备注
                </Button>
              </div>
            </div>
          ) : interview.userNotes ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {interview.userNotes}
            </p>
          ) : (
            <button
              type="button"
              onClick={startEditNotes}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Edit3 className="size-3.5" />
              复盘后有新想法？点这里随手记下，比如下次该怎么回答
            </button>
          )}
        </CardContent>
      </Card>

      {/* AI 语音面试：原始转写（与逐题问答并存，解析失败也不丢原文） */}
      {interview.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              原始转写
              {interview.durationSec != null && (
                <span className="text-xs font-normal text-muted-foreground">
                  通话时长 {Math.floor(interview.durationSec / 60)} 分{" "}
                  {interview.durationSec % 60} 秒
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscript((s) => !s)}
              >
                {showTranscript ? "收起" : "展开"}
              </Button>
            </CardTitle>
          </CardHeader>
          {showTranscript && (
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-muted-foreground">
                {interview.transcript}
              </pre>
            </CardContent>
          )}
        </Card>
      )}

      {/* 元信息 */}
      <div className="text-xs text-muted-foreground">
        创建于 {formatDateTime(interview.createdAt)}
      </div>

      {/* 贡献这场面试的真实题目 */}
      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {contributeStep === "draft" ? "确认脱敏面经草稿" : "贡献这场面试的真实题目"}
            </DialogTitle>
            <DialogDescription>
              {contributeStep === "draft"
                ? "AI 已把勾选的题目抽象脱敏成通用面经，确认后可一键贡献"
                : "勾选题目，AI 自动脱敏抽象成匿名面经，帮助更多候选人"}
            </DialogDescription>
          </DialogHeader>

          {contributeStep === "questions" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">公司</label>
                  <Input value={interview.company.name} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">岗位</label>
                  <Input value={interview.position} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">轮次</label>
                  <Input
                    value={ROUND_TYPE_LABELS[interview.roundType] || interview.roundType}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">选择要贡献的题目</label>
                {interview.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">这场面试还没有录入问题</p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-3">
                    {interview.questions.map((q, i) => (
                      <label
                        key={q.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedQuestionIds.has(q.id)}
                          onCheckedChange={() => toggleQuestion(q.id)}
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
                AI 会去掉姓名、机密、可识别细节，把题目抽象成通用答题思路，你确认后才提交
              </p>

              {contributeError && <p className="text-sm text-destructive">{contributeError}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <ExperienceDraftEditor
                company={interview.company.name}
                industry={interview.company.industry ?? null}
                sourceInterviewId={interview.id}
                entries={draftEntries}
                submitting={contributing}
                onChange={setDraftEntries}
                onSubmit={handleSubmitDraft}
                onCancel={() => {
                  setDraftEntries([])
                  setContributeStep("questions")
                }}
              />
              {contributeError && <p className="text-sm text-destructive">{contributeError}</p>}
            </div>
          )}

          {contributeStep === "questions" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setContributeOpen(false)} disabled={generating}>
                取消
              </Button>
              <Button onClick={handleGenerateDraft} disabled={selectedQuestionIds.size === 0 || generating}>
                {generating && <Loader2 className="mr-2 size-4 animate-spin" />}
                {generating ? "AI 正在抽象脱敏…" : (
                  <>
                    <Wand2 className="mr-2 size-4" />
                    AI 生成脱敏草稿
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
