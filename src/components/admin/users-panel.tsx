"use client"

// 用户管理：邮箱/昵称搜索 + 手动开通 Pro / 撤销 Pro / 重置试用 + 分页。
// 数据来自 /api/admin/users；写操作走 /api/admin/users/{id}/grant|revoke|reset-trial。

import { useCallback, useEffect, useState } from "react"
import { Crown, Gift, Loader2, RefreshCw, Search, Undo2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/toast"
import { PLANS, type PlanId } from "@/lib/payment/types"
import { formatDate } from "@/lib/utils"
import { api, isUnauthenticated } from "@/lib/api"

export interface AdminUser {
  id: string
  name: string | null
  email: string | null
  createdAt: string
  proExpiresAt: string | null
  trialClaimedAt: string | null
  orderCount: number
}

const GRANT_PLANS: PlanId[] = ["month", "quarter", "year"]

interface Props {
  onUnauthenticated: () => void
}

export function UsersPanel({ onUnauthenticated }: Props) {
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [planByUser, setPlanByUser] = useState<Record<string, string>>({})

  const pageSize = 20

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q) params.set("q", q)
      const data = await api.get<{ users: AdminUser[]; total: number }>(`/admin/users?${params}`)
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      if (isUnauthenticated(err)) {
        onUnauthenticated()
      } else {
        toast.add({
          title: "加载用户失败",
          description: err instanceof Error ? err.message : "请稍后重试",
          type: "error",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [q, page, onUnauthenticated])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const runAction = async (userId: string, path: string, successTitle: string) => {
    setBusyId(userId)
    try {
      const data = await api.post<{ ok?: boolean; error?: string }>(path, {})
      if (!data.ok) throw new Error(data.error || "操作失败")
      toast.add({ title: successTitle, type: "success" })
      await loadUsers()
    } catch (err) {
      toast.add({
        title: "操作失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleGrant = async (user: AdminUser) => {
    const plan = (planByUser[user.id] ?? "month") as PlanId
    setBusyId(user.id)
    try {
      const data = await api.post<{ ok?: boolean; error?: string; proExpiresAt?: string }>(
        `/admin/users/${user.id}/grant`,
        { plan }
      )
      if (!data.ok) throw new Error(data.error || "开通失败")
      const planInfo = PLANS[plan]
      toast.add({
        title: `已开通 ${planInfo.label}`,
        description: data.proExpiresAt ? `至 ${formatDate(data.proExpiresAt)}` : "会员已激活",
        type: "success",
      })
      await loadUsers()
    } catch (err) {
      toast.add({
        title: "开通失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleRevoke = (user: AdminUser) => {
    if (window.confirm(`确认取消「${user.name || user.email || user.id}」的 Pro 权限？此操作立即生效。`)) {
      void runAction(user.id, `/admin/users/${user.id}/revoke`, "已取消 Pro")
    }
  }

  const handleResetTrial = (user: AdminUser) => {
    if (window.confirm(`确认重置「${user.name || user.email || user.id}」的试用领取状态？其可再次领取 7 天试用。`)) {
      void runAction(user.id, `/admin/users/${user.id}/reset-trial`, "已重置试用")
    }
  }

  const search = () => {
    setPage(1)
    setQ(input.trim())
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const busy = (id: string) => busyId === id

  return (
    <div className="space-y-3">
      {/* 搜索 + 刷新 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="按邮箱 / 昵称搜索"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
          </div>
          <Button size="sm" onClick={search}>
            搜索
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw className="size-3.5" /> 刷新
          </Button>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <div className="space-y-2">
        {loading && users.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-5 animate-spin" /> 加载中…
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              暂无用户
            </CardContent>
          </Card>
        ) : (
          users.map((u, i) => {
            const plan = (planByUser[u.id] ?? "month") as PlanId
            const isPro = !!u.proExpiresAt && new Date(u.proExpiresAt) > new Date()
            return (
              <Card key={u.id} className="animate-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{u.name || "未设置昵称"}</span>
                      {isPro && (
                        <Badge variant="secondary">
                          <Crown className="size-3 text-amber-500" /> Pro
                        </Badge>
                      )}
                      {u.trialClaimedAt && <Badge variant="outline">已领试用</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {u.email || "—"} · 注册 {formatDate(u.createdAt)} · 订单 {u.orderCount} 单
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isPro && u.proExpiresAt
                        ? `Pro 至 ${formatDate(u.proExpiresAt)}`
                        : "未开通 Pro"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={plan}
                      onValueChange={(v) => setPlanByUser((m) => ({ ...m, [u.id]: String(v) }))}
                    >
                      <SelectTrigger className="w-20" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRANT_PLANS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PLANS[p].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => void handleGrant(u)} disabled={busy(u.id)}>
                      {busy(u.id) ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
                      开通 Pro
                    </Button>
                    {u.proExpiresAt && (
                      <Button size="sm" variant="ghost" onClick={() => handleRevoke(u)} disabled={busy(u.id)}>
                        <Undo2 className="size-3.5" /> 撤销
                      </Button>
                    )}
                    {u.trialClaimedAt && (
                      <Button size="sm" variant="ghost" onClick={() => handleResetTrial(u)} disabled={busy(u.id)}>
                        <Gift className="size-3.5" /> 重置试用
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          第 {page} / {totalPages} 页 · 共 {total} 人
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
