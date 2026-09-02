"use client"

// 独立营销首页（未登录访问 / 时渲染）。已登录用户会被 middleware 重定向到 /dashboard。
// 自带头部导航 + Hero + 怎么用 + 功能 + 收费方案 + 优势 + CTA + 页脚，全屏无 Sidebar。
// 所有「能力点/价格」均为真实产品数据：免费 5 场 / Pro ¥29 每月含 AI 语音 15 场 / 语音点数包 10·30·100 场 /
// 注册即送 7 天 Pro 试用（api/auth/register 内 ensureTrialOnRegister）。

import Link from "next/link"
import {
  ArrowRight,
  Sparkles,
  Mic,
  Target,
  LineChart,
  AudioLines,
  RefreshCw,
  Smartphone,
  Library,
  Crown,
  Check,
  TrendingUp,
  ClipboardList,
  ShieldCheck,
  Coins,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/Logo"
import { useAuth } from "@/hooks/useAuth"

interface FeatureItem {
  icon: LucideIcon
  title: string
  desc: string
  href?: string
}

// 主打功能（自上而下对应求职主链路：复盘 → 语音/模拟 → 押题 → 题库 → 报告）
const features: FeatureItem[] = [
  { icon: Sparkles, title: "AI 复盘", desc: "记录真实面试，AI 自动生成结构化复盘与改进建议，场场沉淀能力画像" },
  { icon: AudioLines, title: "AI 语音面试", desc: "AI 面试官语音提问，口型 / 思考动效还原真实面试氛围" },
  { icon: Mic, title: "模拟面试", desc: "文字 + 语音双模式，多轮模拟随时开练，不怕冷场" },
  { icon: Target, title: "面经押题", desc: "AI 押题 + 面经库，提前准备不慌乱" },
  { icon: Library, title: "我的题库", desc: "上传面试题文档，AI 按你的题目出题练习" },
  { icon: LineChart, title: "成长报告", desc: "阶段成长总结，看得见的进步" },
]

// 工作流（怎么用）：把「为什么要持续记录」讲清楚，突出真实数据闭环
const steps: FeatureItem[] = [
  { icon: ClipboardList, title: "记录每一场", desc: "真实面试随手记，或随时开一场 AI 模拟面试" },
  { icon: Sparkles, title: "AI 自动复盘", desc: "评分 + 逐题建议，自动沉淀你的能力画像" },
  { icon: Target, title: "押题 + 针对性练", desc: "AI 押题查漏补缺，语音面试模拟实战节奏" },
  { icon: TrendingUp, title: "见证成长", desc: "阶段成长报告，告诉教练下一步练什么" },
]

// 平台差异化优势
const advantages: FeatureItem[] = [
  {
    icon: RefreshCw,
    title: "真实数据闭环",
    desc: "每一场真实面试都沉淀为能力画像，AI 复盘持续反哺你的准备，越练越懂你",
  },
  {
    icon: Smartphone,
    title: "Web + 小程序多端同步",
    desc: "电脑、手机随时记录与复盘，数据实时同步",
  },
  {
    icon: Zap,
    title: "多模型 AI 引擎",
    desc: "DeepSeek → Qwen → Claude 智能择优作答，深度复盘也有高质体验",
  },
]

// 收费方案（与 /pricing 页及后端 PLANS 价格一致；仅做首页引导，完整版见 /pricing）
interface PriceCard {
  id: "free" | "pro" | "voice"
  name: string
  price: string
  unit: string
  desc: string
  features: string[]
  hot?: boolean
  cta: { label: string; href: string }
  note?: string
}

const priceCards: PriceCard[] = [
  {
    id: "free",
    name: "免费版",
    price: "¥0",
    unit: "体验起步",
    desc: "先体验核心流程，感受 AI 复盘的价值",
    features: [
      "5 场面试记录 + AI 复盘",
      "文字模拟面试不限",
      "我的题库上传",
      "Web + 小程序",
    ],
    cta: { label: "免费开始", href: "/auth/register" },
  },
  {
    id: "pro",
    name: "Pro 会员",
    price: "¥29",
    unit: "/月",
    desc: "求职冲刺主力套餐，能力全解锁",
    features: [
      "真实 / 模拟面试不限场次",
      "AI 语音面试每月 15 场",
      "AI 深度复盘 + 能力画像",
      "押题 / 题库 / 成长报告全功能",
    ],
    hot: true,
    cta: { label: "注册送 7 天试用", href: "/auth/register" },
    note: "注册即享 7 天 Pro 试用 · 试用期含 AI 语音 1 场",
  },
  {
    id: "voice",
    name: "语音点数包",
    price: "¥29",
    unit: "起 / 10 场",
    desc: "语音面试超额或按量使用，灵活加场",
    features: [
      "1 场 AI 语音面试 = 1 点",
      "10 / 30 / 100 场可选",
      "即时到账 · 长期有效",
      "免费用户也可购买",
    ],
    cta: { label: "选购点数", href: "/pricing" },
  },
]

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md px-6 py-6">
      {/* 主卡：AI 复盘 */}
      <div className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-foreground/5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-semibold">AI 复盘报告</p>
            <p className="text-xs text-muted-foreground">刚刚完成 · 后端开发岗</p>
          </div>
        </div>
        <div className="mt-4 flex items-end gap-1">
          <span className="text-3xl font-bold text-indigo-600">8.6</span>
          <span className="pb-1 text-xs text-muted-foreground">/ 10</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["逻辑清晰", "回答完整", "技术深度"].map((t) => (
            <span
              key={t}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 浮动小卡：AI 语音面试 */}
      <div className="absolute right-0 top-0 flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-card-hover ring-1 ring-foreground/5">
        <AudioLines className="size-4 text-indigo-600" />
        <span className="text-xs font-medium">AI 语音面试</span>
      </div>

      {/* 浮动小卡：押题 */}
      <div className="absolute bottom-0 left-0 flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-card-hover ring-1 ring-foreground/5">
        <Target className="size-4 text-indigo-600" />
        <span className="text-xs font-medium">今日押题 5 题</span>
      </div>
    </div>
  )
}

export function LandingPage() {
  const { status } = useAuth()
  const authenticated = status === "authenticated"
  const homeHref = authenticated ? "/dashboard" : "/auth/register"
  const homeCtaLabel = authenticated ? "进入应用" : "免费开始"

  return (
    <div className="animate-fade-up overflow-x-clip">
      {/* 顶部导航：sticky，已登录 / 未登录都可看；已登录显示「进入应用」 */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              功能
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              怎么练
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              收费方案
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {authenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="gap-1.5 px-3">
                  进入应用
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="px-3">
                    登录
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm" className="px-3">
                    免费开始
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero：氛围底 + 左文案 + 右侧产品卡 */}
      <section className="relative">
        {/* 氛围光斑（纯装饰，不影响可读性） */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-96 rounded-full bg-gradient-to-br from-indigo-200/60 to-violet-200/40 blur-3xl dark:from-indigo-500/20 dark:to-violet-500/10" />
          <div className="absolute -left-32 top-40 size-80 rounded-full bg-gradient-to-br from-violet-200/40 to-indigo-100/40 blur-3xl dark:from-violet-500/10 dark:to-indigo-500/10" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div className="text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-card ring-1 ring-foreground/5">
              <Sparkles className="size-3.5 text-primary" />
              AI 驱动 · 覆盖求职全流程的面试教练
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
              AI 面师 — 你的{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
                AI 面试教练
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
              真实面试自动 AI 复盘 · AI 面试官随时模拟 · 考前智能押题备战。
              一个平台，让每一次面试都成为你更强的理由。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={homeHref}>
                <Button size="lg" className="gap-2 px-6">
                  {homeCtaLabel}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="px-6">
                  了解更多
                </Button>
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" />
                注册送 7 天 Pro 试用
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" />
                不付费也能练
              </li>
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* 怎么练：4 步讲清价值闭环 */}
      <section id="how" className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            把每一次面试，变成看得见的进步
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            不是练习完就结束——你的每一场面试都会被 AI 记住，复盘与准备越用越准
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={s.title} className="relative rounded-2xl bg-card p-6 shadow-card ring-1 ring-foreground/5">
                  <span className="absolute right-4 top-4 text-3xl font-black text-indigo-100 dark:text-indigo-500/20">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 功能：6 卡 2×3 */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold md:text-3xl">一个平台，覆盖求职全流程</h2>
        <p className="mt-2 text-center text-muted-foreground">记录、复盘、押题、模拟面试，一站式完成</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group rounded-2xl bg-card p-6 shadow-card ring-1 ring-foreground/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-primary/20"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* 收费方案：三档（免费 / Pro / 语音点数包），完整版跳 /pricing */}
      <section id="pricing" className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center">
            <Badge variant="secondary" className="gap-1">
              <Crown className="size-3 text-amber-500" />
              收费方案
            </Badge>
            <h2 className="mt-3 text-2xl font-bold md:text-3xl">从免费开始，按需升级</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              免费版即可体验完整流程；重度求职再升级 Pro，语音面试超额用点数包灵活加场
            </p>
          </div>

          <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
            {priceCards.map((p) => (
              <div
                key={p.id}
                className={
                  "relative flex flex-col rounded-2xl bg-card p-6 shadow-card ring-1 ring-foreground/5 " +
                  (p.hot
                    ? "border border-primary/50 shadow-card-hover ring-primary/20 md:-mt-3 md:mb-3"
                    : "")
                }
              >
                {p.hot && (
                  <Badge className="absolute -top-2.5 right-4">最受欢迎</Badge>
                )}
                <div className="flex items-center gap-2">
                  {p.id === "free" && <ShieldCheck className="size-4 text-muted-foreground" />}
                  {p.id === "pro" && <Crown className="size-4 text-amber-500" />}
                  {p.id === "voice" && <Coins className="size-4 text-primary" />}
                  <h3 className="font-semibold">{p.name}</h3>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.unit}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link href={p.id === "pro" && authenticated ? "/pricing" : p.cta.href} className="block">
                    <Button
                      className="w-full gap-1.5"
                      variant={p.hot ? "default" : "outline"}
                    >
                      {p.cta.label}
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                  {p.note && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">{p.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">
              查看完整定价与档位对比 →
            </Link>
          </p>
        </div>
      </section>

      {/* 优势：3 条（平台差异化） */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {advantages.map((a) => {
            const Icon = a.icon
            return (
              <div key={a.title} className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-4 font-semibold">{a.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{a.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#a5b4fc] px-6 py-14 text-center text-white">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-2xl font-bold md:text-3xl">开始你的面试提升之旅</h2>
          <p className="relative mt-2 text-white/90">
            {authenticated
              ? "回到总览，继续你的求职节奏"
              : "免费注册即送 7 天 Pro 试用，第一场复盘很快就来"}
          </p>
          <Link href={homeHref} className="relative mt-6 inline-block">
            <Button
              size="lg"
              className="gap-2 bg-white px-6 text-indigo-600 hover:bg-indigo-50"
            >
              {homeCtaLabel}
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-sm text-muted-foreground">
          <Logo size="sm" />
          <p>© 2026 AI 面师 · 你的 AI 面试教练</p>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              定价
            </Link>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              收费方案
            </a>
            <Link href="/auth/login" className="transition-colors hover:text-foreground">
              登录
            </Link>
            <Link href="/auth/register" className="transition-colors hover:text-foreground">
              注册
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
