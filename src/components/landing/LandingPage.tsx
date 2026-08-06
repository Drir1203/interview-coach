"use client"

import Link from "next/link"
import {
  ArrowRight,
  Sparkles,
  Mic,
  Briefcase,
  Target,
  LineChart,
  AudioLines,
  RefreshCw,
  Smartphone,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/Logo"

interface FeatureItem {
  icon: LucideIcon
  title: string
  desc: string
}

const features: FeatureItem[] = [
  { icon: Sparkles, title: "AI 复盘", desc: "记录真实面试，AI 自动生成结构化复盘与改进建议" },
  { icon: Mic, title: "模拟面试", desc: "多轮模拟面试，随时开练，不怕冷场" },
  { icon: Briefcase, title: "求职进度", desc: "投递、面试、Offer 一个看板全掌握" },
  { icon: Target, title: "面经押题", desc: "AI 押题 + 面经库，提前准备不慌乱" },
  { icon: LineChart, title: "成长报告", desc: "阶段成长总结，看得见的进步" },
  { icon: AudioLines, title: "语音模拟", desc: "语音作答，还原真实面试节奏" },
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
    icon: Users,
    title: "面经网络效应",
    desc: "面试数据汇聚成面经，用的人越多，参考越准",
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

      {/* 浮动小卡：模拟面试 */}
      <div className="absolute right-0 top-0 flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-card-hover ring-1 ring-foreground/5">
        <Mic className="size-4 text-indigo-600" />
        <span className="text-xs font-medium">模拟面试 进行中</span>
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
      {/* Hero：左对齐 */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
        <div className="text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-indigo-600 md:text-5xl">
            AI 面师 — 你的 AI 面试教练
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            记录真实面试 → AI 复盘 → 押题 → 成长。一个平台管理你的求职全生命周期。
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
        <p className="mt-2 text-center text-muted-foreground">记录、复盘、押题、管理，一站式完成</p>
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
            return (
              <div key={a.title} className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-4 font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
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
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-sm text-muted-foreground">
          <Logo size="sm" />
          <p>© 2026 AI 面师 · 你的 AI 面试教练</p>
        </div>
      </footer>
    </div>
  )
}
