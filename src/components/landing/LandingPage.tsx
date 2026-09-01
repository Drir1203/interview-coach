"use client"

// 独立营销首页（未登录访问 / 时渲染）。已登录用户会被 middleware 重定向到 /dashboard。
// 自带头部导航 + Hero + 功能 + 优势 + CTA + 页脚，全屏无 Sidebar。

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
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/Logo"

interface FeatureItem {
  icon: LucideIcon
  title: string
  desc: string
  href?: string
}

const features: FeatureItem[] = [
  { icon: Sparkles, title: "AI 复盘", desc: "记录真实面试，AI 自动生成结构化复盘与改进建议" },
  { icon: AudioLines, title: "AI 语音面试", desc: "AI 面试官语音提问，口型 / 思考动效还原真实面试氛围" },
  { icon: Mic, title: "模拟面试", desc: "文字 + 语音双模式，多轮模拟随时开练，不怕冷场" },
  { icon: Target, title: "面经押题", desc: "AI 押题 + 面经库，提前准备不慌乱" },
  { icon: Library, title: "我的题库", desc: "上传面试题文档，AI 按你的题目出题练习" },
  { icon: LineChart, title: "成长报告", desc: "阶段成长总结，看得见的进步" },
]

const advantages: FeatureItem[] = [
  {
    icon: RefreshCw,
    title: "真实数据闭环",
    desc: "每一场真实面试都沉淀为能力画像，AI 复盘持续反哺你的准备",
  },
  {
    icon: Smartphone,
    title: "Web + 小程序多端同步",
    desc: "电脑、手机随时记录与复盘，数据实时同步",
  },
  {
    icon: Crown,
    title: "Pro 会员",
    desc: "无限记录 + AI 深度复盘 + 语音面试，¥29/月起",
    href: "/pricing",
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
  return (
    <div className="animate-fade-up">
      {/* 顶部导航：sticky，已登录 / 未登录都可看 */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              功能
            </a>
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              定价
            </Link>
          </nav>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      {/* Hero：左对齐 */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
        <div className="text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-indigo-600 md:text-5xl">
            AI 面师 — 你的 AI 面试教练
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            记录真实面试 → AI 复盘 → 押题 → 模拟面试 → 成长。一个平台管理你的求职全生命周期。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth/register">
              <Button size="lg" className="gap-2 px-5">
                免费开始
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="px-5">
                了解更多
              </Button>
            </a>
          </div>
        </div>
        <HeroVisual />
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
                className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-foreground/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* 优势：3 条 */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          {advantages.map((a) => {
            const Icon = a.icon
            const content = (
              <>
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-4 font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </>
            )
            return (
              <div key={a.title} className="text-center">
                {a.href ? (
                  <Link href={a.href} className="block transition-opacity hover:opacity-80">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#a5b4fc] px-6 py-14 text-center text-white">
          <h2 className="text-2xl font-bold md:text-3xl">开始你的面试提升之旅</h2>
          <p className="mt-2 text-white/90">免费开始，第一场复盘很快就来</p>
          <Link href="/auth/register" className="mt-6 inline-block">
            <Button
              size="lg"
              className="gap-2 bg-white px-6 text-indigo-600 hover:bg-indigo-50"
            >
              免费开始
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
