"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState, useRef, useEffect } from "react"
import {
  Send,
  Loader2,
  LogOut,
  Brain,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Summary {
  overallScore: number
  totalQuestions: number
  strengths: string[]
  improvementAreas: string[]
  questionScores: { question: string; score: number; feedback: string }[]
}

type SessionPhase = "answering" | "waiting" | "finished" | "error"

function SessionInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get("id") || ""
  const company = searchParams.get("company") || "未知公司"
  const position = searchParams.get("position") || "未知岗位"

  const [messages, setMessages] = useState<
    { role: "assistant" | "user"; content: string }[]
  >([])
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [phase, setPhase] = useState<SessionPhase>("answering")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 初始化：获取第一个问题
  useEffect(() => {
    const load = async () => {
      try {
        const apiKey = localStorage.getItem("anthropic_api_key") || ""
        const res = await fetch("/api/mock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            company,
            position,
            roundType: "first",
            apiKey,
          }),
        })

        if (!res.ok) throw new Error("启动失败")
        const data = await res.json()

        // 更新 sessionId
        if (data.sessionId) {
          window.history.replaceState(
            null,
            "",
            `/practice/session?id=${data.sessionId}&company=${encodeURIComponent(company)}&position=${encodeURIComponent(position)}`
          )
        }

        setMessages([{ role: "assistant", content: data.question }])
        setPhase("answering")
      } catch (err: any) {
        setError(err.message)
        setPhase("error")
      }
    }

    load()
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 提交回答
  const handleSubmit = async () => {
    if (!currentAnswer.trim() || phase !== "answering") return

    const answer = currentAnswer.trim()
    setCurrentAnswer("")
    setPhase("waiting")
    setMessages((prev) => [...prev, { role: "user", content: answer }])

    try {
      const apiKey = localStorage.getItem("anthropic_api_key") || ""
      const res = await fetch("/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          sessionId,
          answer,
          apiKey,
        }),
      })

      if (!res.ok) throw new Error("请求失败")
      const data = await res.json()

      if (data.isComplete) {
        setSummary(data.summary)
        setPhase("finished")
        if (data.feedback) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.feedback },
          ])
        }
      } else if (data.question) {
        setMessages((prev) => [
          ...prev,
          ...(data.feedback
            ? [
                {
                  role: "assistant" as const,
                  content: `**反馈：** ${data.feedback}`,
                },
              ]
            : []),
          { role: "assistant", content: data.question },
        ])
        setPhase("answering")
      }
    } catch (err: any) {
      setError(err.message)
      setPhase("error")
    }
  }

  // 提前结束
  const handleEnd = async () => {
    setPhase("waiting")
    try {
      const apiKey = localStorage.getItem("anthropic_api_key") || ""
      const res = await fetch("/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId, apiKey }),
      })

      if (!res.ok) throw new Error("请求失败")
      const data = await res.json()
      setSummary(data.summary)
      setPhase("finished")
    } catch {
      setPhase("error")
    }
  }

  // Ctrl+Enter 提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (error && messages.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-16 text-center">
        <AlertCircle className="mx-auto size-10 text-destructive" />
        <p className="text-muted-foreground">启动面试失败：{error}</p>
        <Link href="/practice">
          <Button variant="outline">返回</Button>
        </Link>
      </div>
    )
  }

  // 完成页面
  if (phase === "finished" && summary) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/practice">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">模拟面试结束</h1>
            <p className="text-sm text-muted-foreground">
              {company} · {position}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
              <span className="text-3xl font-bold text-primary">
                {summary.overallScore.toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              共回答 {summary.totalQuestions} 个问题
            </p>
          </CardContent>
        </Card>

        {summary.strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-green-600" />
                优点
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {summary.improvementAreas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-amber-600" />
                改进方向
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {summary.improvementAreas.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">逐题评分</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.questionScores.map((qs, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">Q{i + 1}: {qs.question}</p>
                  <Badge variant={qs.score >= 7 ? "default" : "secondary"}>
                    {qs.score}/10
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{qs.feedback}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-3">
          <Link href="/practice">
            <Button variant="outline">再来一场</Button>
          </Link>
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
      {/* 顶部信息 */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/practice">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <span className="font-medium">模拟面试</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {company} · {position}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEnd}
          disabled={phase === "waiting"}
          className="gap-2"
        >
          <LogOut className="size-3" />
          结束面试
        </Button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t pt-4">
        <div className="flex gap-3">
          <Textarea
            ref={textareaRef}
            placeholder="输入你的回答... (Ctrl+Enter 发送)"
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={phase !== "answering"}
            rows={3}
            className="resize-none"
          />
          <Button
            className="shrink-0 self-end"
            onClick={handleSubmit}
            disabled={
              !currentAnswer.trim() || phase !== "answering"
            }
          >
            {phase === "waiting" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" />
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SessionInner />
    </Suspense>
  )
}
