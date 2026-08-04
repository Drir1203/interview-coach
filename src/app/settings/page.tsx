"use client"

import { User, Info, Database, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/useAuth"
import { ResumeCard } from "@/components/settings/resume-card"

export default function SettingsPage() {
  const { user: session } = useAuth()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">设置</h1>

      {session && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <CardTitle className="text-base">账号信息</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">邮箱：</span>{session.email}</p>
            <p><span className="text-muted-foreground">名称：</span>{session.name || "未设置"}</p>
          </CardContent>
        </Card>
      )}

      <ResumeCard />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <CardTitle className="text-base">服务状态</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">AI 复盘</span>
            <Badge variant="default">平台已配置</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">语音转写</span>
            <Badge variant="secondary">即将上线</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">数据存储</span>
            <Badge variant="outline">PostgreSQL 云端</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="size-4 text-primary" />
            <CardTitle className="text-base">关于</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>AI 面师 v1.0</p>
          <p>你的 AI 面试教练 — 记录面试 → AI 复盘 → 提升</p>
          <Separator />
          <p className="flex items-center gap-2"><Database className="size-3" /> 数据存储在云端，多设备同步</p>
        </CardContent>
      </Card>
    </div>
  )
}
