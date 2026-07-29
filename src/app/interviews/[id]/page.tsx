"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatDate, formatDateTime } from "@/lib/utils"
import { ROUND_TYPE_LABELS, INTERVIEW_STATUS_CONFIG, INTERVIEW_RESULTS } from "@/types"
import Link from "next/link"

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
  company: { name: string; industry: string | null }
  questions: Question[]
  tags: { tag: { name: string; color: string } }[]
}

export default function InterviewDetail() {
  const params = useParams()
  const router = useRouter()
  const [interview, setInterview] = useState<InterviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [reviewResult, setReviewResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showImproved, setShowImproved] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/interviews/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setInterview(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  const handleAIReview = async () => {
    setReviewing(true)
    setError(null)
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: params.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "AI 复盘失败")
      }
      const result = await res.json()
      setReviewResult(result)

      // 刷新页面数据
      const updated = await fetch(`/api/interviews/${params.id}`).then((r) => r.json())
      setInterview(updated)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setReviewing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("确定删除这条面试记录？")) return
    await fetch(`/api/interviews/${params.id}`, { method: "DELETE" })
    router.push("/interviews")
  }

  const updateResult = async (result: string) => {
    await fetch(`/api/interviews/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    })
    setInterview((prev) => prev ? { ...prev, result } : prev)
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
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/interviews">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
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
            <div className="mt-3 flex items-center gap-2">
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
        <div className="flex items-center gap-2">
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
            ) : (
              <Button onClick={handleAIReview} disabled={reviewing} className="gap-2">
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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="size-4 text-primary" />
                  AI 复盘结果
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleAIReview} disabled={reviewing}>
                  {reviewing ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : null}
                  重新分析
                </Button>
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
                      {weaknessAreas.map((w: any, i: number) => (
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
                    {q.aiImprovedAnswer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          setShowImproved(showImproved === q.id ? null : q.id)
                        }
                      >
                        {showImproved === q.id ? "收起" : "查看优化回答"}
                      </Button>
                    )}
                  </div>

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

      {/* 备注 */}
      {interview.userNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">备注</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {interview.userNotes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 元信息 */}
      <div className="text-xs text-muted-foreground">
        创建于 {formatDateTime(interview.createdAt)}
      </div>
    </div>
  )
}
