"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusCircle, Trash2, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ROUND_TYPES } from "@/types"
import Link from "next/link"
import { AudioRecorder } from "@/components/AudioRecorder"

interface QuestionEntry {
  order: number
  questionText: string
  userAnswer: string
}

export default function NewInterview() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [companyIndustry, setCompanyIndustry] = useState("")
  const [position, setPosition] = useState("")
  const [roundType, setRoundType] = useState("first")
  const [userNotes, setUserNotes] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [questions, setQuestions] = useState<QuestionEntry[]>([
    { order: 1, questionText: "", userAnswer: "" },
  ])

  const addQuestion = () => {
    setQuestions([...questions, { order: questions.length + 1, questionText: "", userAnswer: "" }])
  }

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return
    const updated = questions.filter((_, i) => i !== index)
    setQuestions(updated.map((q, i) => ({ ...q, order: i + 1 })))
  }

  const updateQuestion = (index: number, field: keyof QuestionEntry, value: string) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setTagInput("")
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSubmit = async () => {
    if (!companyName.trim() || !position.trim()) return

    setSaving(true)
    try {
      const res = await fetch("/interview/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyIndustry: companyIndustry.trim() || undefined,
          position: position.trim(),
          roundType,
          userNotes: userNotes.trim() || undefined,
          questions: questions.filter((q) => q.questionText.trim()).map((q) => ({
            order: q.order,
            questionText: q.questionText.trim(),
            userAnswer: q.userAnswer.trim() || undefined,
          })),
        }),
      })

      if (!res.ok) throw new Error("保存失败")
      const data = await res.json()
      router.push(`/interviews/${data.id}`)
    } catch (err) {
      console.error(err)
      alert("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const hasContent = questions.some((q) => q.questionText.trim())
  const canSubmit = companyName.trim() && position.trim() && hasContent

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/interviews">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">记录新面试</h1>
          <p className="text-sm text-muted-foreground">录入面试信息，稍后可随时 AI 复盘</p>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">公司名称 *</label>
              <Input
                placeholder="例：字节跳动"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">行业</label>
              <Input
                placeholder="例：互联网/电商"
                value={companyIndustry}
                onChange={(e) => setCompanyIndustry(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">岗位 *</label>
              <Input
                placeholder="例：后端开发工程师"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">轮次</label>
              <Select value={roundType} onValueChange={(v) => v && setRoundType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUND_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 标签 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">标签</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                  {tag} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="输入标签后按回车"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
              <Button variant="outline" onClick={addTag} type="button">
                添加
              </Button>
            </div>
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">备注</label>
            <Textarea
              placeholder="面试整体感觉、需要注意的点..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 录音 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">录音转写</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            面试时录音，完成后自动提取问题和回答（可选）
          </p>
          <AudioRecorder
            onTranscribed={(qas) => {
              const startIdx = questions.length
              const newQs = qas.map((qa, i) => ({
                order: startIdx + i + 1,
                questionText: qa.questionText,
                userAnswer: qa.userAnswer,
              }))
              setQuestions([...questions, ...newQs])
            }}
            disabled={false}
          />
        </CardContent>
      </Card>

      {/* 面试问题 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">面试问题</CardTitle>
          <Button variant="outline" size="sm" onClick={addQuestion} type="button">
            <PlusCircle className="mr-1 size-3" />
            添加问题
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">问题 {i + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => removeQuestion(i)}
                  type="button"
                >
                  <Trash2 className="size-3 text-muted-foreground" />
                </Button>
              </div>
              <Input
                placeholder="面试官问了什么？"
                value={q.questionText}
                onChange={(e) => updateQuestion(i, "questionText", e.target.value)}
              />
              <Textarea
                placeholder="你是怎么回答的？（选填）"
                value={q.userAnswer}
                onChange={(e) => updateQuestion(i, "userAnswer", e.target.value)}
                rows={3}
              />
            </div>
          ))}

          {questions.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              添加面试中遇到的问题
            </p>
          )}
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <div className="flex justify-end gap-3">
        <Link href="/interviews">
          <Button variant="outline">取消</Button>
        </Link>
        <Button disabled={!canSubmit || saving} onClick={handleSubmit}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          保存面试记录
        </Button>
      </div>
    </div>
  )
}
