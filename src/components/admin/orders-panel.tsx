"use client"

// 订单管理：状态/来源筛选 + 待开通一键激活。数据来自 /api/payment/admin/orders。

import { useCallback, useEffect, useState } from "react"
import { Check, Crown, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/toast"
import { PLANS, type PlanId } from "@/lib/payment/types"
import { formatDate } from "@/lib/utils"
import { api, isUnauthenticated } from "@/lib/api"

export interface AdminOrder {
  id: string
  plan: string
  amount: number
  status: "pending" | "paid"
  source: string
  createdAt: string
  userNotifiedAt: string | null
  paidAt: string | null
  expiresAt: string | null
  user: { name: string | null; email: string | null } | null
}

const SOURCE_LABELS: Record<string, string> = {
  trial: "试用",
  mock: "付费",
  admin: "管理员",
}

interface Props {
  onUnauthenticated: () => void
}

export function OrdersPanel({ onUnauthenticated }: Props) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [source, setSource] = useState("")

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      if (source) params.set("source", source)
      const qs = params.toString()
      const data = await api.get<{ orders: AdminOrder[] }>(
        `/payment/admin/orders${qs ? `?${qs}` : ""}`
      )
      setOrders(data.orders ?? [])
    } catch (err) {
      if (isUnauthenticated(err)) {
        onUnauthenticated()
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
  }, [status, source, onUnauthenticated])

  // 筛选变化即重查
  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

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

  const pendingCount = orders.filter((o) => o.status === "pending").length

  return (
    <div className="space-y-3">
      {/* 筛选 + 刷新 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-3">
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : String(v))}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待开通</SelectItem>
                <SelectItem value="paid">已开通</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source || "all"} onValueChange={(v) => setSource(v === "all" ? "" : String(v))}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="全部来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                <SelectItem value="trial">试用</SelectItem>
                <SelectItem value="mock">付费</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            待开通 {pendingCount} 单 · 共 {orders.length} 条
            <Button variant="outline" size="sm" onClick={() => void loadOrders()} disabled={loading}>
              <RefreshCw className="size-3.5" /> 刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <div className="space-y-2">
        {loading && orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-5 animate-spin" /> 加载中…
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
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
                      <Badge variant="outline">{SOURCE_LABELS[o.source] ?? o.source}</Badge>
                      {o.userNotifiedAt && (
                        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">
                          <Check className="size-3" /> 已通知
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {o.user?.email || "—"} · {plan?.label ?? o.plan} ¥{(o.amount / 100).toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      下单 {formatDate(o.createdAt)}
                      {o.userNotifiedAt ? ` · 已通知 ${formatDate(o.userNotifiedAt)}` : ""}
                      {o.paidAt ? ` · 开通 ${formatDate(o.paidAt)}` : ""}
                    </p>
                  </div>
                  {isPending ? (
                    <Button size="sm" onClick={() => void handleApprove(o.id)} disabled={approvingId === o.id}>
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
