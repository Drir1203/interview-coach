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
  Mic,
  MicOff,
} from "lucide-react"
import { analyzeVoiceState, type VoiceState } from "@/lib/voice-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  VideoInterviewCall,
  type VideoSessionInfo,
  type VideoCallEndedBy,
} from "@/components/video-interview-call"

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
  const mode = searchParams.get("mode") || "text"
  const roundTypeParam = searchParams.get("roundType") || "first"

  const [messages, setMessages] = useState<
    { role: "assistant" | "user"; content: string; voiceState?: VoiceState }[]
  >([])
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [phase, setPhase] = useState<SessionPhase>("answering")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordError, setRecordError] = useState("")
  const [degraded, setDegraded] = useState(false)
  const [videoSession, setVideoSession] = useState<VideoSessionInfo | null>(null)
  const [videoResult, setVideoResult] = useState<{
    transcript: string
    endedBy: VideoCallEndedBy
    error?: string
    interviewId?: string
  } | null>(null)
  const loadedRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordMimeTypeRef = useRef("")
  const recordStartTimeRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)

  // 初始化：获取第一个问题
  useEffect(() => {
    const load = async () => {
      // 防 React StrictMode 开发态双执行：避免重复创建阿里云实例（计费）
      if (loadedRef.current) return
      loadedRef.current = true
      try {
        // AI 语音面试模式：先尝试视频面试服务，未开通/未接线 → 降级文字模式（C4）
        if (mode === "video") {
          const vres = await fetch("/interview/api/video-interview/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company,
              position,
              roundType: roundTypeParam,
              grill: searchParams.get("grill") === "1",
            }),
          })
          if (!vres.ok) {
            const vbody = await vres.json().catch(() => null)
            // 配额拦截（402 免费 5 场 / 429 Pro 每日 3 场）→ 直出原因，不静默降级文字 mock
            if (vres.status === 402 || vres.status === 429) {
              throw new Error(vbody?.error || "AI 语音面试次数已用完")
            }
            setDegraded(true) // 401 未登录 / 503 未开通等 → 降级文字模式（C4）
          } else {
            const vdata = await vres.json()
            if (vdata.mode === "video") {
              setVideoSession(vdata)
              return
            }
            setDegraded(true) // 阿里云未开通 → 降级文字模式（C4）
          }
        }

        const res = await fetch("/interview/api/mock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            company,
            position,
            roundType: roundTypeParam,
            resumeMode: searchParams.get("grill") === "1",
          }),
        })

        if (!res.ok) {
          // 透出后端错误文案（如免费场次 402「升级 Pro 解锁无限」）
          let msg = "启动失败"
          try {
            const b = await res.json()
            if (b?.error) msg = b.error
          } catch {
            /* 非 JSON 错误体，用默认文案 */
          }
          throw new Error(msg)
        }
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

  // 发送回答（文字或语音转写共用）
  const sendAnswer = async (rawAnswer: string, voiceState?: VoiceState) => {
    const answer = rawAnswer.trim()
    if (!answer || phase !== "answering") return

    setCurrentAnswer("")
    setPhase("waiting")
    setMessages((prev) => [
      ...prev,
      { role: "user", content: answer, ...(voiceState ? { voiceState } : {}) },
    ])

    try {
      const res = await fetch("/interview/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          sessionId,
          answer,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败")
      setPhase("error")
    }
  }

  // 提交回答（文字输入）
  const handleSubmit = () => {
    if (phase !== "answering" || isRecording) return
    void sendAnswer(currentAnswer)
  }

  // 停止麦克风轨道
  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  // 开始录音
  const startRecording = async () => {
    setRecordError("")
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordError("当前环境不支持麦克风，请改用文字输入")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : ""
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      )
      recordMimeTypeRef.current = recorder.mimeType || "audio/webm"
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstart = () => {
        recordStartTimeRef.current = Date.now()
      }
      recorder.onstop = () => void handleRecordingStop()
      recorder.onerror = () => {
        setIsRecording(false)
        stopStream()
        setRecordError("录音失败，请重试或改用文字输入")
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      setRecordError("无法访问麦克风，请授权后重试或改用文字输入")
    }
  }

  // 停止录音并转写
  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const handleRecordingStop = async () => {
    stopStream()
    const blob = new Blob(audioChunksRef.current, {
      type: recordMimeTypeRef.current,
    })
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - recordStartTimeRef.current) / 1000)
    )
    setIsTranscribing(true)
    try {
      const file = new File([blob], "answer.webm", { type: blob.type })
      const formData = new FormData()
      formData.append("audio", file)
      formData.append("duration", String(durationSec))
      const res = await fetch("/interview/api/transcribe", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("转写失败")
      const data = await res.json()
      const transcript = (data.transcript || "").trim()
      if (!transcript) {
        setRecordError("没听清，请再说一次或直接打字")
      } else {
        const voiceState = analyzeVoiceState(transcript, durationSec)
        setRecordError("")
        void sendAnswer(transcript, voiceState)
      }
    } catch (err) {
      setRecordError(
        err instanceof Error ? err.message : "转写失败，请改用文字输入"
      )
    } finally {
      setIsTranscribing(false)
    }
  }

  // 录音按钮
  const toggleRecord = () => {
    if (phase !== "answering" || isTranscribing) return
    if (isRecording) stopRecording()
    else void startRecording()
  }

  // 提前结束
  const handleEnd = async () => {
    setPhase("waiting")
    try {
      const res = await fetch("/interview/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId }),
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

  // AI 语音面试：通话结束 → 展示转写记录
  if (videoResult) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/practice">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI 面试结束</h1>
            <p className="text-sm text-muted-foreground">
              {company} · {position}
            </p>
          </div>
        </div>

        {videoResult.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{videoResult.error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              面试记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {videoResult.transcript ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-muted-foreground">
                {videoResult.transcript}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                没有获取到面试记录。
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-3">
          {videoResult.interviewId && (
            <Link href={`/interviews/${videoResult.interviewId}`}>
              <Button>查看面试记录</Button>
            </Link>
          )}
          <Link href="/practice">
            <Button variant="outline">再来一场</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">返回首页</Button>
          </Link>
        </div>
      </div>
    )
  }

  // AI 语音面试：通话进行中
  if (videoSession) {
    return (
      <VideoInterviewCall
        session={videoSession}
        company={company}
        position={position}
        roundType={roundTypeParam}
        onFinished={(transcript, endedBy, error, interviewId) =>
          setVideoResult({ transcript, endedBy, error, interviewId })
        }
      />
    )
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
      {degraded && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>AI 语音面试暂不可用，已切换到文字模式。</span>
        </div>
      )}
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
          disabled={phase === "waiting" || isRecording || isTranscribing}
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
                "flex max-w-[80%] flex-col gap-1",
                msg.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.content}
              </div>
              {msg.role === "user" && msg.voiceState && (
                <div className="flex max-w-full items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600">
                  <span>🎙 语音状态</span>
                  <span className="truncate">{msg.voiceState.summary}</span>
                  <span className="shrink-0">
                    {msg.voiceState.score}/10 ·{" "}
                    {msg.voiceState.speechRate.toFixed(1)}字/秒 · 填充词{" "}
                    {msg.voiceState.fillerCount}个
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t pt-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "shrink-0 self-end",
              isRecording && "border-red-500 bg-red-500 text-white hover:bg-red-600 hover:text-white"
            )}
            onClick={toggleRecord}
            disabled={phase !== "answering" || isTranscribing}
            title={isRecording ? "点击停止录音" : "点击开始语音回答"}
          >
            {isTranscribing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
          </Button>
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
              !currentAnswer.trim() ||
              phase !== "answering" ||
              isRecording ||
              isTranscribing
            }
          >
            {phase === "waiting" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        {isRecording && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
            <Mic className="size-3 animate-pulse" />
            录音中，请对着话筒回答，点击红色按钮停止
          </p>
        )}
        {recordError && (
          <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="size-3" />
            {recordError}
          </p>
        )}
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
