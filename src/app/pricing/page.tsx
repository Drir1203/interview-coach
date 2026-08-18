"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Crown, Check, Loader2, Sparkles, User as UserIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/hooks/useAuth"
import { useSubscription } from "@/hooks/useSubscription"
import { api, redirectToLogin } from "@/lib/api"
import { formatDate } from "@/lib/utils"

interface OrderResult {
  orderId: string
  amount: number
  mockAction: "auto" | "manual"
  mockToken?: string
  payUrl?: string
}

const PLANS = [
  {
    id: "month",
    name: "月度 Pro",
    price: "¥29",
    per: "/月",
    tagline: "按需解锁，灵活起步",
    features: ["无限面试记录", "AI 深度复盘 + 逐题重新生成", "AI 教练 / 押题 / 成长报告全功能"],
    available: true,
    hot: false,
  },
  {
    id: "quarter",
    name: "季度 Pro",
    price: "¥79",
    per: "/季",
    tagline: "求职冲刺期标配",
    features: ["月度 Pro 全部权益", "等效月均 ¥26", "覆盖 2-3 个月求职周期"],
    available: false,
    hot: true,
  },
  {
    id: "year",
    name: "年度 Pro",
    price: "¥249",
    per: "/年",
    tagline: "长期求职，超值之选",
    features: ["季度 Pro 全部权益", "等效月均 ¥21，约 6 折", "一次搞定全年"],
    available: false,
    hot: false,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const { status, reload: reloadUser } = useAuth()
  const { info, loading, reload } = useSubscription()

  // 读取 from（升级前来源页，激活后回跳）。用 window.location 而非 useSearchParams，避免静态渲染缺 Suspense
  const [from, setFrom] = useState<string | null>(null)
  useEffect(() => {
    setFrom(new URLSearchParams(window.location.search).get("from"))
  }, [])

  const [orderingPlan, setOrderingPlan] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderResult | null>(null)
  const [activating, setActivating] = useState(false)

  const isAuthed = status === "authenticated"
  const isPro = info?.tier === "pro"
  const isTrial = !!info?.trialActive

  const scrollToPlans = () => {
    document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // 手动模式（生产）：轮询订单状态直到管理员开通
  useEffect(() => {
    if (!order || order.mockAction !== "manual") return
    const timer = setInterval(async () => {
      try {
        const data = await api.get<{ status: string }>(`/payment/order/${order.orderId}`)
        if (data.status === "paid") {
          clearInterval(timer)
          toast.add({ title: "Pro 已开通", description: "刷新会员状态…", type: "success" })
          setOrder(null)
          reload()
          reloadUser()
          if (from) router.push(from)
        }
      } catch {
        // 轮询失败静默重试
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [order, from, reload, reloadUser, router])

  const handleBuy = async (planId: string) => {
    if (!isAuthed) {
      redirectToLogin()
      return
    }
    setOrderingPlan(planId)
    try {
      const data = await api.post<OrderResult>("/payment/order", { plan: planId })
      setOrder(data)
      if (data.mockAction === "manual") {
        toast.add({
          title: "订单已提交",
          description: "等待管理员开通后自动刷新，也可联系平台开通",
          type: "info",
        })
      }
    } catch (err) {
      toast.add({
        title: "下单失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setOrderingPlan(null)
    }
  }

  // 开发/本地：模拟支付成功 → 自助激活（approve 路由非生产环境校验本人订单）
  const handleMockPay = async () => {
    if (!order) return
    setActivating(true)
    try {
      await api.post("/payment/mock/approve", { orderId: order.orderId })
      toast.add({ title: "模拟支付成功", description: "Pro 会员已开通", type: "success" })
      setOrder(null)
      reload()
      reloadUser()
      if (from) router.push(from)
    } catch (err) {
      toast.add({
        title: "激活失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="animate-fade-up">
        <PageHeader icon={Crown} title="升级 Pro" description="无限面试记录 + AI 深度复盘，让每一次面试都有反馈" />
      </div>

      {/* 当前状态卡 */}
      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            {isPro ? (
              <Crown className="size-7 shrink-0 text-amber-500" />
            ) : (
              <Sparkles className="size-7 shrink-0 text-primary" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {loading ? "加载中…" : isPro ? "Pro 会员" : "免费用户"}
                </span>
                {isPro && isTrial && <Badge variant="secondary">试用中</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {loading
                  ? "正在查询会员状态…"
                  : isPro
                    ? info?.source === "trial"
                      ? `7 天试用进行中，剩余 ${info.daysLeft ?? 0} 天`
                      : `会员有效期至 ${formatDate(info?.proExpiresAt ?? "")}`
                    : `已记录 ${info?.interviewCount ?? 0}/${info?.freeLimit ?? 5} 场面试，免费额度用完将无法新建`}
              </p>
            </div>
          </div>
          {!isPro && !loading && (
            <Button variant="outline" size="sm" onClick={scrollToPlans}>
              立即升级
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 套餐 */}
      <div id="plans" className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={
              "animate-fade-up relative flex flex-col " +
              (plan.hot ? "border-primary/60" : plan.available ? "border-primary/30" : "")
            }
            style={{ animationDelay: "80ms" }}
          >
            {plan.hot && <Badge className="absolute -top-2 right-3">推荐</Badge>}
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.per}</span>
              </div>
              <CardDescription>{plan.tagline}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <ul className="flex-1 space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.available ? (
                isPro ? (
                  <Button className="w-full" variant="outline" disabled>
                    已是 Pro
                  </Button>
                ) : order ? (
                  <Button className="w-full" variant="outline" disabled>
                    订单已生成
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={orderingPlan === plan.id || activating}
                    onClick={() => handleBuy(plan.id)}
                  >
                    {orderingPlan === plan.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Crown className="size-4" />
                    )}
                    升级 Pro
                  </Button>
                )
              ) : (
                <Button className="w-full" variant="outline" disabled>
                  即将上线
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 订单操作区 */}
      {order && (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="text-base">订单 #{order.orderId.slice(-8)}</CardTitle>
            <CardDescription>
              应付 ¥{(order.amount / 100).toFixed(2)} · 有效期 30 天（续费自动叠加）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.mockAction === "auto" ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-xs text-muted-foreground">
                  本地/测试模式：点击下方按钮模拟支付成功并立即开通。
                </p>
                <Button onClick={handleMockPay} disabled={activating} className="gap-2">
                  {activating ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {activating ? "开通中…" : "模拟支付成功"}
                </Button>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
                <UserIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  订单已提交，等待管理员开通。开通后页面将自动刷新，无需重复下单。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isAuthed && (
        <Card className="animate-fade-up">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">登录后即可购买 Pro 会员</p>
            <Button className="mt-3" onClick={() => redirectToLogin()}>
              去登录
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
