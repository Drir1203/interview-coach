"use client"

import { useState, useRef, useCallback } from "react"
import { Mic, Square, Upload, Loader2, CheckCircle2, AlertCircle, FileAudio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface AudioRecorderProps {
  onTranscribed: (questions: { questionText: string; userAnswer: string }[]) => void
  disabled?: boolean
}

type RecorderState = "idle" | "recording" | "uploading" | "done" | "error"

async function transcribeAudio(blob: Blob, filename: string, duration: number) {
  const formData = new FormData()
  formData.append("audio", blob, filename)
  formData.append("duration", String(duration))
  const apiKey = localStorage.getItem("anthropic_api_key") || ""
  formData.append("apiKey", apiKey)

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "转写失败")
  }

  return res.json()
}

export function AudioRecorder({ onTranscribed, disabled }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle")
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState("")
  const [fileName, setFileName] = useState("")
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop()
    stream.current?.getTracks().forEach((t) => t.stop())
    if (timer.current) clearInterval(timer.current)
  }, [])

  const startRecording = async () => {
    try {
      setError("")
      setDuration(0)
      setFileName("")
      chunks.current = []

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = mediaStream

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType })
        setState("uploading")
        try {
          const data = await transcribeAudio(blob, "recording.webm", duration)
          onTranscribed(data.qas || [])
          setState("done")
        } catch (err: any) {
          setError(err.message)
          setState("error")
        }
      }

      recorder.onerror = () => {
        setError("录音出错")
        setState("error")
      }

      mediaRecorder.current = recorder
      recorder.start(1000)
      setState("recording")

      let seconds = 0
      timer.current = setInterval(() => {
        seconds++
        setDuration(seconds)
        if (seconds >= 600) stopRecording()
      }, 1000)
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("麦克风权限被拒绝，请在浏览器设置中允许")
      } else {
        setError("无法启动录音: " + err.message)
      }
      setState("error")
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|aac)$/i)) {
      setError("请上传音频文件（mp3/wav/m4a/ogg/webm）")
      setState("error")
      return
    }

    // 限制大小 50MB
    if (file.size > 50 * 1024 * 1024) {
      setError("文件过大，请上传小于 50MB 的录音")
      setState("error")
      return
    }

    setError("")
    setFileName(file.name)
    setState("uploading")

    try {
      const estimatedDuration = Math.round(file.size / 16000 / 2) // 粗略估算秒数
      const data = await transcribeAudio(file, file.name, estimatedDuration)
      onTranscribed(data.qas || [])
      setState("done")
    } catch (err: any) {
      setError(err.message)
      setState("error")
    }

    // 重置 file input 以便重新上传同文件
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="size-4" />
        <span>录音/文件已处理，问答已自动提取</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 实时录制 */}
      <div className="flex items-center gap-3">
        {state === "idle" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={startRecording}
              disabled={disabled}
              className="gap-2"
            >
              <Mic className="size-4" />
              开始录音
            </Button>

            <span className="text-xs text-muted-foreground">或</span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="gap-2"
            >
              <Upload className="size-4" />
              上传录音文件
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac"
              className="hidden"
              onChange={handleFileUpload}
            />
          </>
        )}

        {state === "recording" && (
          <div className="flex items-center gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="gap-2"
            >
              <Square className="size-4" />
              停止录音
            </Button>
            <span className="flex items-center gap-2 text-sm text-destructive">
              <span className="inline-block size-2 animate-pulse rounded-full bg-destructive" />
              {formatDuration(duration)}
            </span>
          </div>
        )}

        {state === "uploading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>
              正在转写{fileName ? `「${fileName}」` : "录音"}...
            </span>
          </div>
        )}

        {state === "error" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setState("idle"); setError("") }}
              className="gap-2"
            >
              <Mic className="size-4" />
              重试
            </Button>
          </div>
        )}
      </div>

      {/* 已选择的文件名 */}
      {fileName && state === "uploading" && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileAudio className="size-3" />
          {fileName}
        </p>
      )}

      {/* 错误提示 */}
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </p>
      )}
    </div>
  )
}
