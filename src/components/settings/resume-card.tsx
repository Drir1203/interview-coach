"use client"

import { useEffect, useRef, useState } from "react"
import { FileUp, Loader2, Save, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

interface ResumeData {
  resumeText: string | null
  resumeFileName: string | null
  resumeUpdatedAt: string | null
}

type Feedback = { type: "success" | "error"; msg: string }

function formatTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ResumeCard() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState<string | null>(null)
  const [resumeText, setResumeText] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/interview/api/profile/resume")
      .then((r) => r.json())
      .then((d: ResumeData) => {
        setFileName(d.resumeFileName)
        setResumeUpdatedAt(d.resumeUpdatedAt)
        setResumeText(d.resumeText || "")
      })
      .catch(() => {
        setFeedback({ type: "error", msg: "简历信息加载失败" })
      })
      .finally(() => setLoading(false))
  }, [])

  function show(type: Feedback["type"], msg: string) {
    setFeedback({ type, msg })
  }

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      show("error", "仅支持 PDF 格式")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      show("error", "文件过大，请上传 5MB 以内的 PDF")
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const formData = new FormData()
      formData.append("resume", file)
      const res = await fetch("/interview/api/profile/resume", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "上传失败")
      setFileName(data.resumeFileName)
      setResumeUpdatedAt(data.resumeUpdatedAt)
      setResumeText(data.resumeText)
      show("success", "简历上传成功，已解析为文本，可继续编辑")
    } catch (err) {
      show("error", err instanceof Error ? err.message : "上传失败，请稍后重试")
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSave() {
    setBusy(true)
    setFeedback(null)
    try {
      const res = await fetch("/interview/api/profile/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "保存失败")
      setFileName(data.resumeFileName)
      setResumeUpdatedAt(data.resumeUpdatedAt)
      setResumeText(data.resumeText || "")
      show("success", "保存成功")
    } catch (err) {
      show("error", err instanceof Error ? err.message : "保存失败，请稍后重试")
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    setBusy(true)
    setFeedback(null)
    try {
      const res = await fetch("/interview/api/profile/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: "" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "清除失败")
      setFileName(null)
      setResumeUpdatedAt(null)
      setResumeText("")
      show("success", "已清除简历")
    } catch (err) {
      show("error", err instanceof Error ? err.message : "清除失败")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileUp className="size-4 text-primary" />
            <CardTitle className="text-base">我的简历</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 加载中...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileUp className="size-4 text-primary" />
          <CardTitle className="text-base">我的简历</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          上传 PDF 简历，AI 复盘时会结合你的简历背景进行分析。请上传可复制的文本型 PDF（扫描件无法解析）。
        </p>

        <div className="flex items-center gap-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="max-w-sm"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
            }}
          />
          {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {fileName && (
          <p className="text-xs text-muted-foreground">
            当前简历：{fileName}
            {resumeUpdatedAt ? ` · 更新时间：${formatTime(resumeUpdatedAt)}` : ""}
          </p>
        )}

        <div className="space-y-2">
          <Textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={8}
            placeholder="上传 PDF 后自动解析出的文本会显示在这里，可手动编辑…"
          />
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={handleSave} disabled={busy}>
              <Save className="size-4" />
              保存修改
            </Button>
            {(fileName || resumeText) && (
              <Button variant="outline" size="sm" onClick={handleClear} disabled={busy}>
                <Trash2 className="size-4" />
                清除简历
              </Button>
            )}
          </div>
        </div>

        {feedback && (
          <p className={`text-sm ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {feedback.msg}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
