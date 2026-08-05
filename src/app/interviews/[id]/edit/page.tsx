"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, PlusCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ROUND_TYPES } from "@/types"
import Link from "next/link"
import { OptionChips } from "@/components/OptionChips"
import { POPULAR_POSITIONS, POPULAR_INDUSTRIES, POPULAR_TAGS } from "@/lib/popular-options"

interface QuestionEntry {
  order: number
  questionText: string
  userAnswer: string
}

export default function EditInterview() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [companyName, setCompanyName] = useState("")
  const [companyIndustry, setCompanyIndustry] = useState("")
  const [position, setPosition] = useState("")
  const [roundType, setRoundType] = useState("first")
  const [userNotes, setUserNotes] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [questions, setQuestions] = useState<QuestionEntry[]>([])

  useEffect(() => {
    fetch(`/interview/api/interviews/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCompanyName(data.company.name)
        setCompanyIndustry(data.company.industry || "")
        setPosition(data.position)
        setRoundType(data.roundType)
        setUserNotes(data.userNotes || "")
        setTags((data.tags || []).map((t: any) => t.tag.name))
        setQuestions(
          data.questions.map((q: any) => ({
            order: q.order,
            questionText: q.questionText,
            userAnswer: q.userAnswer || "",
          }))
        )
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

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
      const res = await fetch(`/interview/api/interviews/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyIndustry: companyIndustry.trim() || undefined,
          position: position.trim(),
          roundType,
          userNotes: userNotes.trim() || undefined,
          tags,
          questions: questions
            .filter((q) => q.questionText.trim())
            .map((q) => ({
              order: q.order,
              questionText: q.questionText.trim(),
              userAnswer: q.userAnswer.trim() || undefined,
            })),
        }),
      })

      if (!res.ok) throw new Error("保存失败")
      router.push(`/interviews/${params.id}`)
    } catch {
      alert("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/interviews/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">编辑面试记录</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">公司名称</label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">行业</label>
              <Input value={companyIndustry} onChange={(e) => setCompanyIndustry(e.target.value)} />
              <OptionChips options={POPULAR_INDUSTRIES} selected={[companyIndustry]} onPick={setCompanyIndustry} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">岗位</label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
              <OptionChips options={POPULAR_POSITIONS} selected={[position]} onPick={setPosition} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">轮次</label>
              <Select value={roundType} onValueChange={(v) => v && setRoundType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROUND_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* 标签 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">标签</label>
            <OptionChips
              options={POPULAR_TAGS}
              selected={tags}
              onPick={(t) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
            />
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

          <div className="space-y-2">
            <label className="text-sm font-medium">备注</label>
            <Textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">面试问题</CardTitle>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <PlusCircle className="mr-1 size-3" />添加问题
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">问题 {i + 1}</span>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => removeQuestion(i)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <Input value={q.questionText} onChange={(e) => updateQuestion(i, "questionText", e.target.value)} />
              <Textarea value={q.userAnswer} onChange={(e) => updateQuestion(i, "userAnswer", e.target.value)} rows={3} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={`/interviews/${params.id}`}>
          <Button variant="outline">取消</Button>
        </Link>
        <Button disabled={saving} onClick={handleSubmit}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          保存修改
        </Button>
      </div>
    </div>
  )
}
