"use client"

// 会议式自拍小窗：getUserMedia 拉取摄像头画面（镜像），供 AI 语音面试页开启
// 「自己出镜」的临场感。权限拒绝 / 非安全上下文 / 无设备 → onUnavailable，
// 由父组件隐藏开关，不影响通话。挂断/卸载自动停流。

import { useEffect, useRef } from "react"

interface SelfCameraProps {
  enabled: boolean
  onUnavailable?: () => void
  label?: string
}

export function SelfCamera({ enabled, onUnavailable, label = "我" }: SelfCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
      } catch {
        onUnavailable?.()
      }
    }

    if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onUnavailable?.()
      return
    }
    void start()

    return () => {
      cancelled = true
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  if (!enabled) return null

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/25 bg-slate-900 shadow-lg">
      <video
        ref={videoRef}
        className="h-40 w-32 -scale-x-100 object-cover"
        muted
        playsInline
        autoPlay
      />
      <span className="absolute bottom-1 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {label}
      </span>
    </div>
  )
}
