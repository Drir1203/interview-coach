"use client"

// 我的题库：上传面试题文档（PDF/txt）→ AI 识别为题库 → 模拟面试按你的题目提问。
// 受 middleware 保护（未登录 → 登录页）。与 practice 页共用 /interview/api/question-bank。

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Library, Upload, Trash2, Loader2, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"

interface QuestionBank {
  id: string
  name: string
  questionCount: number
}

export default function QuestionBankPage() {
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const loadBanks = useCallback(async (): Promise<QuestionBank[] | null> => {
    try {
      const res = await fetch("/interview/api/question-bank")
      if (!res.ok) return null
      const data = await res.json()
      return data.banks ?? []
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    loadBanks().then((b) => {
      if (b) setBanks(b)
      setLoading(false)
    })
  }, [loadBanks])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/interview/api/question-bank", { method: "POST", body: formData })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || "上传失败")
      }
      const data = await res.json()
      alert(`已识别 ${data.questionCount} 题`)
      const list = await loadBanks()
      if (list) setBanks(list)
    } catch (err: any) {
      alert("上传题库失败：" + err.message)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleDeleteBank = async (id: string) => {
    if (!confirm("确认删除该题库？删除后不可恢复。")) return
    try {
      const res = await fetch(`/interview/api/question-bank?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || "删除失败")
      }
      setBanks((prev) => prev.filter((b) => b.id !== id))
    } catch (err: any) {
      alert("删除题库失败：" + err.message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="animate-fade-up">
        <PageHeader
          icon={Library}
          title="我的题库"
          description="上传面试题文档，AI 面试官按你的题目进行模拟面试"
        />
      </div>

      {/* 上传卡片 */}
      <Card className="animate-fade-up" style={{ animationDelay: "50ms" }}>
        <CardHeader>
          <CardTitle className="text-base">上传面试题文档</CardTitle>
          <CardDescription>
            支持 PDF / txt，AI 自动识别其中的面试题目（仅解析前 6000 字符）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground transition hover:border-primary/50">
            {uploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Upload className="size-6" />
            )}
            <span>{uploading ? "AI 识别中..." : "点击选择文档，上传后即可在模拟面试中使用"}</span>
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </CardContent>
      </Card>

      {/* 题库列表 */}
      <Card className="animate-fade-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle className="text-base">我的题库（{banks.length}）</CardTitle>
          <CardDescription>上传后可删除，或在模拟面试页选择指定题库</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : banks.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              还没有题库，上传一份面试题文档开始吧
            </p>
          ) : (
            <div className="space-y-2">
              {banks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <Library className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{b.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{b.questionCount} 题</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteBank(b.id)}
                  >
                    <Trash2 className="size-3" />
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 去模拟面试 */}
      <div className="animate-fade-up text-center" style={{ animationDelay: "150ms" }}>
        <Link href="/practice">
          <Button variant="outline" className="gap-2">
            去模拟面试，按题库练习
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
