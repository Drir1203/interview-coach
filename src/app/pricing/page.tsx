"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Crown, Check, Info, Loader2, Sparkles, User as UserIcon, QrCode } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/hooks/useAuth"
import { useSubscription } from "@/hooks/useSubscription"
import { api, redirectToLogin } from "@/lib/api"
import type { PaymentConfigData } from "@/lib/payment/payment-config"
import { formatDate } from "@/lib/utils"

// 手动模式轮询：间隔 + 连续失败上限（达到上限停止静默重试，提示用户手动刷新）
const POLL_INTERVAL_MS = 3000
const POLL_MAX_FAILURES = 10

interface OrderResult {
  orderId: string
  amount: number
  mockAction: "auto" | "manual"
  mockToken?: string
  payUrl?: string
  paymentConfig?: PaymentConfigData
}

type QrChannel = "wechat" | "alipay"

const PLANS = [
  {
    id: "month",
    name: "月度 Pro",
    price: "¥29",
    per: "/月",
    tagline: "按需解锁，灵活起步",
    features: [
      "真实 / 模拟面试不限场次",
      "AI 语音面试每日最多 3 场",
      "AI 深度复盘 + 逐题重新生成",
      "AI 教练 / 押题 / 成长报告全功能",
    ],
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
  const [notified, setNotified] = useState(false) // 本订单用户是否已点「我已转账」
  const [qrChannel, setQrChannel] = useState<QrChannel>("wechat")
  const [notifying, setNotifying] = useState(false)

  const isAuthed = status === "authenticated"
  const isPro = info?.tier === "pro"
  const isTrial = !!info?.trialActive

  const scrollToPlans = () => {
    document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // 手动模式（生产）：轮询订单状态直到管理员开通；同时恢复「我已转账」声明状态（刷新不丢失）。
  // 连续失败达到上限即停止，避免无限静默重试（提示用户手动刷新）。
  useEffect(() => {
    if (!order || order.mockAction !== "manual") return
    let failures = 0
    const timer = setInterval(async () => {
      try {
        const data = await api.get<{ status: string; userNotifiedAt?: string | null }>(
          `/payment/order/${order.orderId}`
        )
        failures = 0
        if (data.status === "paid") {
          clearInterval(timer)
          toast.add({ title: "Pro 已开通", description: "刷新会员状态…", type: "success" })
          setOrder(null)
          reload()
          reloadUser()
          if (from) router.push(from)
        } else {
          setNotified(!!data.userNotifiedAt)
        }
      } catch {
        failures += 1
        if (failures >= POLL_MAX_FAILURES) {
          clearInterval(timer)
          toast.add({
            title: "订单状态查询失败",
            description: "请稍后手动刷新页面查看开通结果",
            type: "warning",
          })
        }
      }
    }, POLL_INTERVAL_MS)
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
      setNotified(false)
      const hasQr = data.paymentConfig?.wechatQrUrl || data.paymentConfig?.alipayQrUrl
      if (!data.paymentConfig?.wechatQrUrl && data.paymentConfig?.alipayQrUrl) {
        setQrChannel("alipay")
      } else {
        setQrChannel("wechat")
      }
      if (data.mockAction === "manual") {
        toast.add({
          title: "订单已提交",
          description: hasQr ? "请扫码转账后点击「我已转账」" : "等待管理员开通后自动刷新，也可联系平台开通",
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

  // 用户「我已转账」声明：标记订单，管理员据此确认收款（不自动开通，仍由管理员放行）
  const handleNotify = async () => {
    if (!order) return
    setNotifying(true)
    try {
      await api.post(`/payment/order/${order.orderId}/notify`, {})
      setNotified(true)
      toast.add({
        title: "已通知平台",
        description: "管理员核对到账后会自动开通，请稍候",
        type: "success",
      })
    } catch (err) {
      toast.add({
        title: "通知失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setNotifying(false)
    }
  }

  const qrConfig = order?.paymentConfig
  const hasQr = !!(qrConfig?.wechatQrUrl || qrConfig?.alipayQrUrl)
  const activeQrUrl = qrChannel === "wechat" ? qrConfig?.wechatQrUrl : qrConfig?.alipayQrUrl
  const showChannelSwitch = !!(qrConfig?.wechatQrUrl && qrConfig?.alipayQrUrl)

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
            ) : hasQr ? (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
                {/* 收款码 */}
                <div className="flex flex-col items-center gap-2">
                  {activeQrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeQrUrl}
                      alt={qrChannel === "wechat" ? "微信收款码" : "支付宝收款码"}
                      className="h-44 w-44 rounded-lg border bg-white object-contain"
                    />
                  ) : (
                    <div className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/50 text-xs text-muted-foreground">
                      <QrCode className="size-6" />
                      收款码待配置
                    </div>
                  )}
                  {showChannelSwitch && (
                    <div className="flex gap-1.5">
                      {[
                        { key: "wechat" as const, label: "微信收款" },
                        { key: "alipay" as const, label: "支付宝收款" },
                      ].map((c) => (
                        <button
                          key={c.key}
                          onClick={() => setQrChannel(c.key)}
                          className={
                            "rounded-md px-2.5 py-1 text-xs transition-colors " +
                            (qrChannel === c.key
                              ? "bg-primary text-primary-foreground"
                              : "border bg-background text-muted-foreground hover:bg-muted")
                          }
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* 说明 + 声明按钮 */}
                <div className="flex flex-1 flex-col gap-2">
                  <p className="text-sm font-medium">
                    扫码转账 ¥{(order.amount / 100).toFixed(2)} 后，点击下方按钮通知平台
                  </p>
                  <p className="text-xs text-muted-foreground">
                    订单号：{order.orderId.slice(-8)} · 请转账后截图留证，方便核对
                  </p>
                  {qrConfig?.accountHint && (
                    <p className="text-xs text-muted-foreground">{qrConfig.accountHint}</p>
                  )}
                  {notified ? (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50 p-3 dark:bg-emerald-500/10">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <p className="text-xs text-muted-foreground">
                        已通知平台，等待管理员确认到账后自动开通。开通后页面将自动刷新。
                      </p>
                    </div>
                  ) : (
                    <Button onClick={handleNotify} disabled={notifying} className="w-full gap-2 sm:w-auto">
                      {notifying ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      {notifying ? "提交中…" : "我已转账，等待确认"}
                    </Button>
                  )}
                </div>
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

      {/* 计费说明：面试场次怎么算（免费 5 场合计 / Pro 不限） */}
      <Card className="animate-fade-up">
        <CardContent className="space-y-2 py-4 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              免费用户：真实面试、模拟面试、AI 语音面试合计最多 5 场（以落库场次为准），用完需升级 Pro 才能继续新建。
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              Pro 会员：真实 / 模拟面试不限场次；AI 语音面试（阿里云按分钟计费）每日最多 3 场，生成后自动归档，可随时查看转写与 AI 复盘。
            </span>
          </p>
        </CardContent>
      </Card>

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
