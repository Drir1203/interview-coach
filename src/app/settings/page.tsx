"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Info, Database, CheckCircle2, Lock, Loader2, Settings, Crown, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useSubscription } from "@/hooks/useSubscription"
import { toast } from "@/components/ui/toast"
import { ResumeCard } from "@/components/settings/resume-card"
import { formatDate } from "@/lib/utils"

export default function SettingsPage() {
  const router = useRouter()
  const { user: session } = useAuth()
  const { info } = useSubscription()

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const isWechatUser = !!session && !session.email

  const submitPassword = async () => {
    if (newPassword.length < 6) {
      alert("新密码至少 6 位")
      return
    }
    if (newPassword !== confirmPassword) {
      alert("两次输入的新密码不一致")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/interview/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: oldPassword || undefined,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data?.error || "修改失败")
        return
      }
      toast.add({ title: "密码已修改", type: "success" })
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      alert(err?.message || "修改失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="animate-fade-up">
        <PageHeader icon={Settings} title="设置" description="管理账号、简历与平台偏好" />
      </div>

      {session && (
        <Card className="animate-fade-up" style={{ animationDelay: "50ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <CardTitle className="text-base">账号信息</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">邮箱：</span>{session.email || "微信登录"}</p>
            <p><span className="text-muted-foreground">名称：</span>{session.name || "未设置"}</p>
          </CardContent>
        </Card>
      )}

      {/* 会员（付费墙） */}
      <Card className="animate-fade-up" style={{ animationDelay: "70ms" }}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-amber-500" />
            <CardTitle className="text-base">会员</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">当前档位</span>
            {info?.tier === "pro" ? (
              <span className="flex items-center gap-2">
                <Badge className="bg-amber-500 text-white">Pro</Badge>
                {info.trialActive && <Badge variant="secondary">试用中</Badge>}
              </span>
            ) : (
              <Badge variant="outline">免费</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">有效期</span>
            <span>
              {info?.tier === "pro"
                ? info.source === "trial"
                  ? `7 天试用 · 剩余 ${info.daysLeft ?? 0} 天`
                  : formatDate(info.proExpiresAt ?? "")
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">面试记录</span>
            <span>{info ? `${info.interviewCount}/${info.freeLimit}` : "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">AI 语音 · 本月</span>
            <span>
              {info?.tier === "pro"
                ? `${info.voiceUsedThisMonth}/${info.voiceMonthlyQuota} 场`
                : "需 Pro 或点数包"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">语音点数（场）</span>
            <span className="font-medium">{info ? info.voiceCredits : "—"}</span>
          </div>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/pricing")}
            >
              <Sparkles className="mr-1 size-3" />
              加购语音点数
            </Button>
            <Button
              size="sm"
              variant={info?.tier === "pro" ? "outline" : "default"}
              onClick={() => router.push("/pricing")}
            >
              <Crown className="mr-1 size-3" />
              {info?.tier === "pro" ? "管理会员" : "升级 Pro"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="animate-fade-up" style={{ animationDelay: "90ms" }}>
        <ResumeCard />
      </div>

      <Card className="animate-fade-up" style={{ animationDelay: "130ms" }}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <CardTitle className="text-base">修改密码</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isWechatUser && (
            <p className="text-sm text-muted-foreground">微信登录用户可直接设置密码</p>
          )}
          <Input
            type="password"
            placeholder="当前密码（留空则跳过，微信登录用户）"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder="新密码（至少 6 位）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="确认新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Button onClick={submitPassword} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            提交
          </Button>
        </CardContent>
      </Card>

      <Card className="animate-fade-up" style={{ animationDelay: "170ms" }}>
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

      <Card className="animate-fade-up" style={{ animationDelay: "210ms" }}>
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
