"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Target, Brain, Loader2, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ROUND_TYPES } from "@/types"

export default function PracticePage() {
  const router = useRouter()
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [roundType, setRoundType] = useState("first")
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    if (!position.trim()) return
    setStarting(true)

    try {
      const res = await fetch("/interview/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          company: company.trim() || "未知公司",
          position: position.trim(),
          roundType,
        }),
      })

      if (!res.ok) throw new Error("启动失败")
      const data = await res.json()

      // 跳转到面试页面
      router.push(
        `/practice/session?id=${data.sessionId}&company=${encodeURIComponent(company || "未知公司")}&position=${encodeURIComponent(position)}`
      )
    } catch (err: any) {
      alert("启动模拟面试失败：" + err.message)
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">模拟面试</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI 面试官模拟真实面试场景，结束后生成评估报告
        </p>
      </div>

      {/* 信息卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
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
        <Card>
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
        <Card>
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
      <Card>
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
    </div>
  )
}
