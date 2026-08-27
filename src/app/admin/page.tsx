"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, LayoutDashboard, Loader2, Lock, LogOut, Receipt, Settings, ShieldCheck, User, Users } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { StatsPanel } from "@/components/admin/stats-panel"
import { OrdersPanel } from "@/components/admin/orders-panel"
import { UsersPanel } from "@/components/admin/users-panel"
import { PaymentConfigPanel } from "@/components/admin/payment-config-panel"

// 管理后台：独立管理员账号登录（admin_session cookie），登录后三栏——看板 / 订单 / 用户。
// 会话失效（任一子面板 401）→ 统一回到登录表单。
export default function AdminPage() {
  const [admin, setAdmin] = useState<{ username: string } | null>(null)
  const [checking, setChecking] = useState(true) // 初次登录态检测中
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState("stats")

  // 会话失效回调：任一面板收到 401 → 回登录
  const handleUnauthenticated = useCallback(() => {
    setAdmin(null)
    setTab("stats")
  }, [])

  // 初次登录态检测
  useEffect(() => {
    api
      .get<{ username: string }>("/admin/me")
      .then((me) => setAdmin(me))
      .catch(() => setAdmin(null))
      .finally(() => setChecking(false))
  }, [])

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      toast.add({ title: "请输入用户名和密码", type: "warning" })
      return
    }
    setSubmitting(true)
    try {
      const data = await api.post<{ ok: boolean; username: string }>("/admin/login", {
        username,
        password,
      })
      setAdmin({ username: data.username })
      setPassword("")
      setTab("stats")
      toast.add({ title: "登录成功", type: "success" })
    } catch (err) {
      toast.add({
        title: "登录失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await api.post("/admin/logout").catch(() => {})
    setAdmin(null)
    setTab("stats")
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 检测登录状态…
          </CardContent>
        </Card>
      </div>
    )
  }

  // 未登录 → 登录表单
  if (!admin) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader
          icon={ShieldCheck}
          title="管理后台"
          description="管理员账号登录后管理订单与用户"
        />
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4" /> 管理员登录
            </CardTitle>
            <CardDescription>账号由部署时创建（AdminUser），会话 12 小时有效</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoComplete="current-password"
              />
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={submitting || !username.trim() || !password}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              登录
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 已登录 → 三栏面板
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={ShieldCheck}
          title="管理后台"
          description="运营看板 · 订单审批 · 用户管理"
        />
        <Button variant="outline" size="sm" onClick={handleLogout} className="mt-2 shrink-0">
          <LogOut className="size-3.5" /> 退出（{admin.username}）
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="stats">
            <LayoutDashboard /> 看板
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Receipt /> 订单
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users /> 用户
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings /> 收款设置
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stats" className="mt-4">
          <StatsPanel onUnauthenticated={handleUnauthenticated} />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersPanel onUnauthenticated={handleUnauthenticated} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersPanel onUnauthenticated={handleUnauthenticated} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <PaymentConfigPanel onUnauthenticated={handleUnauthenticated} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
