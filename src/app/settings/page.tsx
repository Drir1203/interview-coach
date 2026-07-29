"use client"

import { useState, useEffect } from "react"
import { Key, Info, Brain, User, Database } from "lucide-react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  const { data: session } = useSession()
  const [claudeKey, setClaudeKey] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("anthropic_api_key")
    if (stored) setClaudeKey(stored)
  }, [])

  const handleSave = () => {
    if (claudeKey.trim()) {
      localStorage.setItem("anthropic_api_key", claudeKey.trim())
    } else {
      localStorage.removeItem("anthropic_api_key")
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">设置</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="size-4 text-primary" />
            <CardTitle className="text-base">API Key 配置</CardTitle>
          </div>
          <CardDescription>
            AI 复盘功能需要 Anthropic Claude API Key
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Anthropic API Key</label>
            <Input
              type="password"
              placeholder="sk-ant-...（留空则使用 Mock 模式）"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Key 仅存储在浏览器本地。不配置时会使用 Mock 模式演示
            </p>
          </div>
          <Button onClick={handleSave}>
            {saved ? "已保存 ✓" : "保存"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            <CardTitle className="text-base">AI 模式</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={claudeKey ? "default" : "secondary"}>
              {claudeKey ? "真实 AI 模式" : "Mock 演示模式"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {claudeKey
                ? "使用 Claude API 进行真实面试分析"
                : "使用模拟数据演示，无需 API Key"}
            </span>
          </div>
        </CardContent>
      </Card>

      {session?.user && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <CardTitle className="text-base">账号信息</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">邮箱：</span>{session.user.email}</p>
            <p><span className="text-muted-foreground">名称：</span>{session.user.name || "未设置"}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="size-4 text-primary" />
            <CardTitle className="text-base">关于</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>i面试 v1.0</p>
          <p>你的 AI 面试教练 — 记录面试 → AI 复盘 → 提升</p>
          <Separator />
          <p className="flex items-center gap-2"><Database className="size-3" /> PostgreSQL（云端，多设备同步）</p>
          <p>AI 服务：Anthropic Claude</p>
        </CardContent>
      </Card>
    </div>
  )
}
