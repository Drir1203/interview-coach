"use client"

// AI 语音面试通话组件（阿里云 AI 实时互动 + ARTC）。
// 生命周期：init 引擎 → call 入会 → 面试官语音面试 → 结束（用户点击 / 面试官宣布结束 / 异常）→
//           调 /api/video-interview/end 停实例并取转写 → 交给父组件展示。

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Mic, MicOff, PhoneOff, AlertCircle, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface VideoSessionInfo {
  sessionId: string
  appId: string
  imsSessionId: string
  rtcParams: Record<string, unknown>
}

export type VideoCallEndedBy = "user" | "agent" | "error"

interface Props {
  session: VideoSessionInfo
  company: string
  position: string
  roundType?: string
  // P3 落库后回传 interviewId，前端据此链到「面试记录」详情页
  onFinished: (transcript: string, endedBy: VideoCallEndedBy, error?: string, interviewId?: string) => void
}

/** 面试官宣布结束的信号词 */
const END_PHRASES = ["面试到此结束", "面试结束"]

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function VideoInterviewCall({ session, company, position, roundType, onFinished }: Props) {
  const engineRef = useRef<any>(null)
  const startedRef = useRef(false)
  const finalizingRef = useRef(false)
  const agentTextRef = useRef("")
  // 通话秒数实时值（finalize 的 useCallback 闭包稳定，取时长用 ref 而非 state，避免读到旧值）
  const elapsedSecRef = useRef(0)

  const [phase, setPhase] = useState<"connecting" | "connected" | "error">("connecting")
  const [agentText, setAgentText] = useState("正在接通面试官…")
  const [subtitle, setSubtitle] = useState("")
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // 通话计时
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed((s) => s + 1)
      elapsedSecRef.current += 1
    }, 1000)
    return () => clearInterval(t)
  }, [])

  /** 收尾：离开 RTC → 停实例 + 取转写 → 通知父组件 */
  const finalize = useCallback(
    async (endedBy: VideoCallEndedBy, error?: string) => {
      if (finalizingRef.current) return
      finalizingRef.current = true

      try {
        await engineRef.current?.handup?.().catch(() => {})
        await engineRef.current?.destroy?.().catch(() => {})
      } catch {
        // 忽略离会错误，继续取转写
      }

      let transcript = ""
      let interviewId: string | undefined
      try {
        const res = await fetch("/interview/api/video-interview/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.sessionId,
            imsSessionId: session.imsSessionId,
            company,
            position,
            roundType,
            durationSec: elapsedSecRef.current,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          transcript = data.transcript ?? ""
          interviewId = data.interviewId ?? undefined
        }
      } catch {
        // 转写获取失败也在下方给出错误提示
      }
      onFinished(transcript, endedBy, error, interviewId)
    },
    [session, onFinished, company, position, roundType]
  )

  // 启动通话
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const start = async () => {
      try {
        // 动态引入：SDK 依赖浏览器 API，仅客户端加载
        const mod = await import("aliyun-auikit-aicall")
        const engine = new mod.default()
        engineRef.current = engine

        const handleError = (code: number, msg: string) => {
          setPhase("error")
          setAgentText(msg || "通话出错")
          void finalize("error", msg || `错误码 ${code}`)
        }

        engine.on("connectionStatusChange", (status: number) => {
          // AICallConnectionStatus.Connected = 3
          if (status === 3) {
            setPhase("connected")
            setAgentText("面试官正在聆听…")
          }
        })
        engine.on("callBegin", () => {
          setPhase("connected")
          setAgentText("面试官正在聆听…")
        })
        engine.on("agentStateChanged", (state: number) => {
          // AICallAgentState: 1 聆听 / 2 思考 / 3 讲话
          const text = state === 3 ? "面试官正在提问…" : state === 2 ? "面试官思考中…" : "面试官正在聆听…"
          setAgentText(text)
        })
        engine.on("agentSubtitleNotify", (sub: { text: string; end: boolean }) => {
          setSubtitle(sub.text)
          if (sub.end) {
            agentTextRef.current += sub.text
            // 面试官宣布结束后自动收尾
            if (END_PHRASES.some((p) => agentTextRef.current.includes(p))) {
              void finalize("agent")
            }
          }
        })
        engine.on("agentWillLeave", () => void finalize("agent"))
        engine.on("callEnd", () => void finalize("agent"))
        engine.on("errorOccurred", handleError)

        const rtc = session.rtcParams
        await engine.init(mod.AICallAgentType.VoiceAgent)
        await engine.call(
          (rtc.userId as string) || "user",
          {
            instanceId: session.sessionId,
            channelId: (rtc.channelId as string) ?? "",
            userId: (rtc.AIAgentUserId as string) ?? "",
            rtcToken: (rtc.token as string) ?? "",
            agentType: mod.AICallAgentType.VoiceAgent,
          },
          mod.AICallAgentType.VoiceAgent
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setPhase("error")
        setAgentText(msg)
        void finalize("error", msg)
      }
    }

    void start()
    return () => {
      engineRef.current?.handup?.().catch(() => {})
      engineRef.current?.destroy?.().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const toggleMute = async () => {
    const next = !muted
    setMuted(next)
    try {
      await engineRef.current?.mute?.(next)
    } catch {
      // 静音失败忽略
    }
  }

  const hangUp = () => void finalize("user")

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center gap-8">
      {/* 顶部信息 */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="size-4 text-primary" />
          <span className="font-medium">AI 语音面试</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {company} · {position}
        </p>
      </div>

      {/* 面试官形象 */}
      <div
        className={cn(
          "flex size-28 items-center justify-center rounded-full bg-primary/10",
          phase === "connected" && "animate-pulse"
        )}
      >
        {phase === "connecting" ? (
          <Loader2 className="size-10 animate-spin text-primary" />
        ) : phase === "error" ? (
          <AlertCircle className="size-10 text-destructive" />
        ) : (
          <Brain className="size-10 text-primary" />
        )}
      </div>

      {/* 状态文本 */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-lg font-medium">{agentText}</p>
        <p className="text-xs text-muted-foreground">{fmt(elapsed)}</p>
      </div>

      {/* 实时字幕 */}
      {subtitle && phase === "connected" && (
        <p className="min-h-12 max-w-sm rounded-lg bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
          {subtitle}
        </p>
      )}

      {/* 通话控制 */}
      <div className="flex items-center gap-6">
        <Button
          variant="outline"
          size="icon"
          className="size-14 rounded-full"
          onClick={() => void toggleMute()}
          title={muted ? "取消静音" : "静音"}
          disabled={phase !== "connected"}
        >
          {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="size-14 rounded-full"
          onClick={hangUp}
          disabled={finalizingRef.current}
          title="结束面试"
        >
          {finalizingRef.current ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <PhoneOff className="size-6" />
          )}
        </Button>
      </div>

      {phase === "error" && (
        <p className="max-w-sm text-center text-sm text-destructive">
          通话失败：{agentText}
          <br />
          <Button variant="ghost" size="sm" className="mt-2" onClick={hangUp}>
            结束并返回
          </Button>
        </p>
      )}
    </div>
  )
}
