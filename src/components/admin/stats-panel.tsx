"use client"

// 运营看板：核心指标卡片（注册用户 / Pro 用户 / 试用领取 / 累计实收 / 待开通）。
// 数据来自 /api/admin/stats 一次性聚合。

import { useCallback, useEffect, useState } from "react"
import { Crown, Gift, Loader2, Receipt, Users, Wallet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { api, isUnauthenticated } from "@/lib/api"

export interface AdminStats {
  totalUsers: number
  proUsers: number
  trialClaimed: number
  totalRevenueCents: number
  paidOrders: number
  pendingOrders: number
}

interface Props {
  /** 会话失效（401）→ 通知父组件回登录页 */
  onUnauthenticated: () => void
}

export function StatsPanel({ onUnauthenticated }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await api.get<{ stats: AdminStats }>("/admin/stats")
      setStats(data.stats)
    } catch (err) {
      if (isUnauthenticated(err)) {
        onUnauthenticated()
      } else {
        setError(err instanceof Error ? err.message : "加载失败")
        toast.add({
          title: "加载看板失败",
          description: err instanceof Error ? err.message : "请稍后重试",
          type: "error",
        })
      }
    }
  }, [onUnauthenticated])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 加载中…
        </CardContent>
      </Card>
    )
  }

  const items = [
    { label: "注册用户", value: stats.totalUsers.toLocaleString(), icon: Users, accent: "text-primary" },
    { label: "Pro 用户", value: stats.proUsers.toLocaleString(), icon: Crown, accent: "text-amber-500" },
    { label: "领取试用", value: stats.trialClaimed.toLocaleString(), icon: Gift, accent: "text-emerald-500" },
    { label: "累计实收（元）", value: (stats.totalRevenueCents / 100).toFixed(2), icon: Wallet, accent: "text-sky-500" },
    { label: "待开通订单", value: stats.pendingOrders.toLocaleString(), icon: Receipt, accent: "text-rose-500" },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className={`size-4 ${item.accent}`} />
                  {item.label}
                </div>
                <div className="text-xl font-semibold tabular-nums">{item.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        已支付订单 {stats.paidOrders} 单；金额单位为分存储，此处换算为元展示。
      </p>
    </div>
  )
}
