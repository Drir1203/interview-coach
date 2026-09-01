"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Target, Brain, Loader2, ArrowRight, Mic, Upload, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ROUND_TYPES } from "@/types"

export default function PracticePage() {
  const router = useRouter()
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [roundType, setRoundType] = useState("first")
  const [starting, setStarting] = useState(false)
  const [grillMode, setGrillMode] = useState(false)
  const [hasResume, setHasResume] = useState(false)
  const [mode, setMode] = useState<"text" | "video">("text")
  const [banks, setBanks] = useState<{ id: string; name: string; questionCount: number }[]>([])
  const [selectedBankId, setSelectedBankId] = useState("")
  const [uploading, setUploading] = useState(false)

  // 检查用户是否已上传简历（简历深挖模式的前提）
  useEffect(() => {
    fetch("/interview/api/profile/resume")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.resumeText) setHasResume(true)
      })
      .catch(() => {})
  }, [])

  // 加载我的题库列表（未登录 → 401 → null，显示「登录后可用」）
  const loadBanks = async (): Promise<{ id: string; name: string; questionCount: number }[] | null> => {
    try {
      const res = await fetch("/interview/api/question-bank")
      if (!res.ok) return null
      const data = await res.json()
      return data.banks ?? []
    } catch {
      return null
    }
  }

  useEffect(() => {
    loadBanks().then((b) => {
      if (b) setBanks(b)
    })
  }, [])

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
      setSelectedBankId(data.id)
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
    if (!confirm("确认删除该题库？")) return
    try {
      const res = await fetch(`/interview/api/question-bank?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || "删除失败")
      }
      setBanks((prev) => prev.filter((b) => b.id !== id))
      if (selectedBankId === id) setSelectedBankId("")
    } catch (err: any) {
      alert("删除题库失败：" + err.message)
    }
  }

  const handleStart = async () => {
    if (!position.trim()) return
    setStarting(true)

    const bankSuffix = selectedBankId ? `&questionBankId=${encodeURIComponent(selectedBankId)}` : ""
    const base = `company=${encodeURIComponent(company || "未知公司")}&position=${encodeURIComponent(position)}&roundType=${roundType}${grillMode ? "&grill=1" : ""}${bankSuffix}`

    try {
      // AI 语音面试：不在列表页预启动，面试页再尝试视频面试/降级（C4）
      if (mode === "video") {
        router.push(`/practice/session?mode=video&${base}`)
        return
      }

      const res = await fetch("/interview/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          company: company.trim() || "未知公司",
          position: position.trim(),
          roundType,
          resumeMode: grillMode,
          ...(selectedBankId ? { questionBankId: selectedBankId } : {}),
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

      // 跳转到面试页面
      router.push(
        `/practice/session?id=${data.sessionId}&${base}`
      )
    } catch (err: any) {
      alert("启动模拟面试失败：" + err.message)
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <PageHeader
          icon={Mic}
          title="模拟面试"
          description="AI 面试官模拟真实面试场景，结束后生成评估报告"
        />
      </div>

      {/* 信息卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="animate-fade-up transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover" style={{ animationDelay: "50ms" }}>
          <CardHeader className="pb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="size-5 text-primary" />
            </div>
            <CardTitle className="mt-2 text-sm">AI 面试官</CardTitle>
            <CardDescription className="text-xs">
              模拟真实面试官提问和追问
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="animate-fade-up transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover" style={{ animationDelay: "90ms" }}>
          <CardHeader className="pb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Target className="size-5 text-primary" />
            </div>
            <CardTitle className="mt-2 text-sm">薄弱项针对性练习</CardTitle>
            <CardDescription className="text-xs">
              根据你的历史面试数据出题
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="animate-fade-up transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover" style={{ animationDelay: "130ms" }}>
          <CardHeader className="pb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCap className="size-5 text-primary" />
            </div>
            <CardTitle className="mt-2 text-sm">面后总结报告</CardTitle>
            <CardDescription className="text-xs">
              评分 + 改进建议
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 开始配置 */}
      <Card className="animate-fade-up" style={{ animationDelay: "170ms" }}>
        <CardHeader>
          <CardTitle className="text-base">配置模拟面试</CardTitle>
          <CardDescription>
            填写基本信息，AI 将根据这些信息定制面试问题
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">目标公司</label>
              <Input
                placeholder="例：字节跳动"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">岗位 *</label>
              <Input
                placeholder="例：后端开发工程师"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">模拟轮次</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">面试形态</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("text")}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  mode === "text"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                )}
              >
                <p className="text-sm font-medium">文字模式</p>
                <p className="text-xs text-muted-foreground">打字回答，零门槛</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  mode === "video"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                )}
              >
                <p className="text-sm font-medium">AI 语音面试</p>
                <p className="text-xs text-muted-foreground">AI 面试官语音提问（未开通自动降级文字）</p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">简历深挖模式</p>
              <p className="text-xs text-muted-foreground">
                {selectedBankId
                  ? "已选「我的题库」，面试按你的题目进行"
                  : hasResume
                    ? "AI 面试官盯着你简历的漏洞、夸大和矛盾点拷打你"
                    : "需先在「设置」上传简历才能使用"}
              </p>
            </div>
            <input
              type="checkbox"
              className="size-5 accent-[#6366f1]"
              checked={grillMode}
              disabled={!hasResume || !!selectedBankId}
              onChange={(e) => setGrillMode(e.target.checked)}
            />
          </div>

          <Button
            className="w-full gap-2"
            disabled={!position.trim() || starting}
            onClick={handleStart}
          >
            {starting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {starting ? "准备中..." : "开始模拟面试"}
          </Button>
        </CardContent>
      </Card>

      {/* 我的题库：上传面试题文档，AI 按你的题目进行模拟面试 */}
      <Card className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle className="text-base">我的题库</CardTitle>
          <CardDescription>
            上传面试题文档（PDF/txt），AI 面试官按你的题目顺序提问（文字与 AI 语音面试均支持）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition hover:border-primary/50">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            <span>{uploading ? "AI 识别中..." : "上传面试题文档（仅解析前 6000 字符）"}</span>
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>

          {banks.length > 0 && (
            <div className="space-y-1">
              {banks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="questionBank"
                      className="size-4 accent-[#6366f1]"
                      checked={selectedBankId === b.id}
                      onChange={() => setSelectedBankId(b.id)}
                    />
                    <span className="truncate">{b.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{b.questionCount} 题</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteBank(b.id)}
                  >
                    <Trash2 className="size-3" />
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {banks.length > 0
              ? "选择题库后开始模拟面试，AI 将按题库顺序提问。"
              : "未上传题库时，AI 按岗位自动出题；上传后可选指定题库。"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
