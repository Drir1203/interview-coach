"use client"

import { useState, useRef, useCallback } from "react"
import { Mic, Square, Upload, Loader2, CheckCircle2, AlertCircle, FileAudio, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AudioRecorderProps {
  onTranscribed: (questions: { questionText: string; userAnswer: string }[]) => void
  disabled?: boolean
}

type RecorderState = "idle" | "recording" | "uploading" | "done" | "error"

// FFmpeg.wasm 实例
let ffmpegInstance: any = null

async function getFFmpegCoreUrl(file: string): Promise<string> {
  const resp = await fetch(`/interview/api/ffmpeg-core?file=${file}`)
  const blob = await resp.blob()
  return URL.createObjectURL(blob)
}

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance
  const { FFmpeg } = await import("@ffmpeg/ffmpeg")
  const ffmpeg = new FFmpeg()
  await ffmpeg.load({
    coreURL: await getFFmpegCoreUrl("ffmpeg-core.js"),
    wasmURL: await getFFmpegCoreUrl("ffmpeg-core.wasm"),
  })
  ffmpegInstance = ffmpeg
  return ffmpeg
}

// FFmpeg.wasm 压缩 + 分段为 60 秒一段
async function compressAndSplitAudio(file: Blob): Promise<Blob[]> {
  try {
    const ffmpeg = await getFFmpeg()
    const input = new Uint8Array(await file.arrayBuffer())
    await ffmpeg.writeFile("input", input)

    await ffmpeg.exec([
      "-i", "input",
      "-ar", "16000",
      "-ac", "1",
      "-b:a", "32k",
      "-f", "segment",
      "-segment_time", "60",
      "-reset_timestamps", "1",
      "output_%03d.mp3",
    ])

    const segments: Blob[] = []
    let idx = 0
    while (true) {
      const name = `output_${String(idx).padStart(3, "0")}.mp3`
      try {
        const data: any = await ffmpeg.readFile(name)
        if (data && typeof data !== "string" && data.length > 0) {
          segments.push(new Blob([data], { type: "audio/mp3" }))
          idx++
        } else break
      } catch { break }
    }

    if (segments.length > 0) {
      const totalMB = segments.reduce((s, b) => s + b.size, 0) / 1024 / 1024
      console.log(`压缩分段: ${(file.size/1024/1024).toFixed(1)}MB → ${segments.length}段(${totalMB.toFixed(1)}MB)`)
      return segments
    }
    return [file]
  } catch (err) {
    console.error("压缩分段失败:", err)
    return [file]
  }
}

async function transcribeAudio(blob: Blob, filename: string, duration: number, signal?: AbortSignal) {
  const formData = new FormData()
  formData.append("audio", blob, filename)
  formData.append("duration", String(duration))
  const res = await fetch("/interview/api/transcribe", { method: "POST", body: formData, signal })
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
  const abortRef = useRef<AbortController | null>(null)

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop()
    stream.current?.getTracks().forEach((t) => t.stop())
    if (timer.current) clearInterval(timer.current)
  }, [])

  const reset = () => {
    setState("idle"); setError(""); setFileName(""); setDuration(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const startRecording = async () => {
    try {
      setError(""); setDuration(0); setFileName(""); chunks.current = []
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = mediaStream
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data) }
      recorder.onstop = async () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType })
        setState("uploading")
        abortRef.current = new AbortController()
        try {
          const segments = await compressAndSplitAudio(blob)
          let allQAs: { questionText: string; userAnswer: string }[] = []
          for (let i = 0; i < segments.length; i++) {
            if (abortRef.current?.signal.aborted) return
            setFileName(segments.length > 1 ? `第${i+1}/${segments.length}段...` : "")
            const data = await transcribeAudio(segments[i], "recording.mp3", 60, abortRef.current?.signal)
            if (data?.qas) allQAs = allQAs.concat(data.qas)
          }
          onTranscribed(allQAs)
          setState("done")
        } catch (err: any) {
          if (err.name === "AbortError") return
          setError(err.message); setState("error")
        }
      }
      recorder.onerror = () => { setError("录音出错"); setState("error") }
      mediaRecorder.current = recorder
      recorder.start(1000)
      setState("recording")
      let seconds = 0
      timer.current = setInterval(() => { seconds++; setDuration(seconds); if (seconds >= 600) stopRecording() }, 1000)
    } catch (err: any) {
      setError(err.name === "NotAllowedError" ? "麦克风权限被拒绝" : "无法启动录音: " + err.message)
      setState("error")
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|aac)$/i)) {
      setError("请上传音频文件（mp3/wav/m4a/ogg/webm）")
      setState("error"); return
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("文件过大，请上传小于 200MB 的录音")
      setState("error"); return
    }
    setError(""); setFileName(file.name); setState("uploading")
    abortRef.current = new AbortController()
    try {
      const segments = await compressAndSplitAudio(file)
      let allQAs: { questionText: string; userAnswer: string }[] = []
      for (let i = 0; i < segments.length; i++) {
        if (abortRef.current?.signal.aborted) return
        setFileName(segments.length > 1 ? `第${i+1}/${segments.length}段...` : file.name)
        const data = await transcribeAudio(segments[i], "audio.mp3", 60, abortRef.current?.signal)
        if (data?.qas) allQAs = allQAs.concat(data.qas)
      }
      onTranscribed(allQAs)
      setState("done")
    } catch (err: any) {
      if (err.name === "AbortError") return
      setError(err.message); setState("error")
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="size-4" />录音已处理，问答已提取
        </span>
        <Button variant="ghost" size="icon" className="size-6" onClick={reset} title="清除">
          <X className="size-3" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {state === "idle" && (
          <>
            <Button variant="outline" size="sm" onClick={startRecording} disabled={disabled} className="gap-2">
              <Mic className="size-4" />开始录音
            </Button>
            <span className="text-xs text-muted-foreground">或</span>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={disabled} className="gap-2">
              <Upload className="size-4" />上传录音文件
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac" className="hidden" onChange={handleFileUpload} />
          </>
        )}
        {state === "recording" && (
          <>
            <Button variant="destructive" size="sm" onClick={stopRecording} className="gap-2">
              <Square className="size-4" />停止录音
            </Button>
            <span className="flex items-center gap-2 text-sm text-destructive">
              <span className="inline-block size-2 animate-pulse rounded-full bg-destructive" />
              {formatDuration(duration)}
            </span>
          </>
        )}
        {state === "uploading" && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            处理中「{fileName}」...
          </span>
        )}
        {state === "error" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="gap-2"><X className="size-3" />清除</Button>
            <Button variant="outline" size="sm" onClick={() => { setState("idle"); setError("") }} className="gap-2"><Mic className="size-3" />重试</Button>
          </div>
        )}
      </div>
      {error && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="size-3" />{error}</p>}
    </div>
  )
}
