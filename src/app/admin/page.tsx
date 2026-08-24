"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Crown, KeyRound, Loader2, Lock, LogOut, ShieldCheck, User } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { PLANS, type PlanId } from "@/lib/payment/types"
import { formatDate } from "@/lib/utils"
import { api, isUnauthenticated } from "@/lib/api"

interface AdminOrder {
  id: string
  plan: string
  amount: number
  status: "pending" | "paid"
  source: string
  createdAt: string
  paidAt: string | null
  expiresAt: string | null
  user: { name: string | null; email: string | null } | null
}

// 订单管理端：管理员账号登录（独立于主站用户体系）。
// 会话 = HttpOnly cookie admin_session，随同源请求自动携带，前端不接触密钥。
export default function AdminPage() {
  const [admin, setAdmin] = useState<{ username: string } | null>(null)
  const [checking, setChecking] = useState(true) // 初次登录态检测中
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ orders: AdminOrder[] }>("/payment/admin/orders")
      setOrders(data.orders ?? [])
    } catch (err) {
      if (isUnauthenticated(err)) {
        // 会话失效 → 回登录
        setAdmin(null)
        setOrders([])
      } else {
        toast.add({
          title: "加载订单失败",
          description: err instanceof Error ? err.message : "请稍后重试",
          type: "error",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // 初次登录态检测
  useEffect(() => {
    api
      .get<{ username: string }>("/admin/me")
      .then((me) => setAdmin(me))
      .catch(() => setAdmin(null))
      .finally(() => setChecking(false))
  }, [])

  // 已登录 → 拉订单
  useEffect(() => {
    if (admin) loadOrders()
  }, [admin, loadOrders])

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
    setOrders([])
  }

  const handleApprove = async (orderId: string) => {
    setApprovingId(orderId)
    try {
      const data = await api.post<{ ok?: boolean; error?: string }>("/payment/mock/approve", {
        orderId,
      })
      if (!data.ok) throw new Error(data.error || "开通失败")
      toast.add({ title: "已开通 Pro", description: "会员已激活", type: "success" })
      await loadOrders()
    } catch (err) {
      toast.add({
        title: "开通失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setApprovingId(null)
    }
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
          title="订单管理端"
          description="管理员账号登录后审批开通订单"
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

  // 已登录 → 订单列表
  const pendingCount = orders.filter((o) => o.status === "pending").length
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={ShieldCheck}
          title="订单管理端"
          description="待开通订单一键激活，开通后会员立即生效"
        />
        <Button variant="outline" size="sm" onClick={handleLogout} className="mt-2 shrink-0">
          <LogOut className="size-3.5" /> 退出（{admin.username}）
        </Button>
      </div>

      {/* 概览 */}
      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Crown className="size-7 shrink-0 text-amber-500" />
            <div>
              <div className="text-sm font-semibold">待开通 {pendingCount} 单</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                共 {orders.length} 条订单记录（待开通 + 已开通）
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            刷新
          </Button>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <div className="space-y-2">
        {loading && orders.length === 0 ? (
          <Card className="animate-fade-up">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-5 animate-spin" /> 加载中…
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card className="animate-fade-up">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              暂无订单
            </CardContent>
          </Card>
        ) : (
          orders.map((o, i) => {
            const plan = PLANS[o.plan as PlanId]
            const isPending = o.status === "pending"
            return (
              <Card key={o.id} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {o.user?.name || "未知用户"}
                      </span>
                      <Badge variant={isPending ? "default" : "secondary"}>
                        {isPending ? "待开通" : "已开通"}
                      </Badge>
                      {o.source === "trial" && <Badge variant="outline">试用</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {o.user?.email || "—"} · {plan?.label ?? o.plan} ¥{(o.amount / 100).toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      下单 {formatDate(o.createdAt)}
                      {o.paidAt ? ` · 开通 ${formatDate(o.paidAt)}` : ""}
                    </p>
                  </div>
                  {isPending ? (
                    <Button size="sm" onClick={() => handleApprove(o.id)} disabled={approvingId === o.id}>
                      {approvingId === o.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      开通 Pro
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Crown className="size-3.5 text-amber-500" />
                      {o.expiresAt ? `至 ${formatDate(o.expiresAt)}` : "已开通"}
                    </span>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
