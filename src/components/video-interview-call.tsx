"use client"

// AI 语音面试通话组件（阿里云 AI 实时互动 + ARTC）。
// 生命周期：init 引擎 → call 入会 → 面试官语音面试 → 结束（用户点击 / 面试官宣布结束 / 异常）→
//           调 /api/video-interview/end 停实例并取转写 → 交给父组件展示。
//
// 视觉层（v2026-09-02）：会议式双画面 —— SVG 面试官形象（agentState 驱动口型/呼吸/思考动效）
//   + 名牌 + 可选自拍摄像头 + 置底字幕条 + 会议式控制条。通话/落库逻辑一行未动。

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { visualStateFromAgentState } from "@/lib/interview-visuals"
import { InterviewerAvatar } from "@/components/interviewer-avatar"
import { SelfCamera } from "@/components/self-camera"

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
  const [agentState, setAgentState] = useState<number | undefined>(undefined)
  const [subtitle, setSubtitle] = useState("")
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(true)

  // 挂载后校正摄像头可用性（非 HTTPS / 无 getUserMedia → 隐藏开关）
  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      !!navigator.mediaDevices?.getUserMedia
    setCameraSupported(ok)
  }, [])

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
          setAgentState(state)
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

  const handleCameraUnavailable = useCallback(() => {
    setCameraSupported(false)
    setCameraOn(false)
  }, [])

  const toggleCamera = () => setCameraOn((v) => !v)

  const visualState = visualStateFromAgentState(agentState)

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-lg flex-col gap-3 px-4 pb-4">
      {/* 面试间主画面 */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-lg">
        {/* 氛围背景：顶部光晕 + 细网格 */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:36px_36px]" />

        <div className="relative flex flex-col items-center gap-4">
          <InterviewerAvatar state={visualState} phase={phase} />
          {/* 面试官名牌 + 状态点 + 计时 */}
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-sm">
            <span
              className={cn(
                "size-2 rounded-full",
                phase === "connected"
                  ? "bg-emerald-400"
                  : phase === "error"
                    ? "bg-red-400"
                    : "animate-pulse bg-amber-400"
              )}
            />
            <span className="text-sm font-medium text-white">面试官</span>
            <span className="text-xs text-white/60">
              {company} · {position}
            </span>
            <span className="text-xs tabular-nums text-white/40">{fmt(elapsed)}</span>
          </div>
          <p className="min-h-5 text-center text-sm text-white/70">{agentText}</p>
        </div>

        {/* 自拍小窗（右上角，可选） */}
        {cameraSupported && cameraOn && (
          <div className="absolute right-3 top-3">
            <SelfCamera enabled onUnavailable={handleCameraUnavailable} />
          </div>
        )}

        {/* 错误覆盖 */}
        {phase === "error" && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-6">
            <p className="text-center text-sm text-red-300">
              通话失败：{agentText}
              <br />
              <Button variant="ghost" size="sm" className="mt-2 text-white" onClick={hangUp}>
                结束并返回
              </Button>
            </p>
          </div>
        )}
      </div>

      {/* 字幕条 */}
      <div className="min-h-14 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 backdrop-blur">
        {subtitle && phase === "connected" ? (
          <p
            className={cn(
              "text-center text-sm",
              visualState.talking ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">面试官的提问将显示在这里</p>
        )}
      </div>

      {/* 会议式控制条 */}
      <div className="flex items-center justify-center gap-5">
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

        {cameraSupported && (
          <Button
            variant="outline"
            size="icon"
            className="size-14 rounded-full"
            onClick={toggleCamera}
            title={cameraOn ? "关闭摄像头" : "打开摄像头"}
            disabled={phase !== "connected"}
          >
            {cameraOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
          </Button>
        )}

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
    </div>
  )
}
