import type { ReactNode } from "react"
import { Check } from "lucide-react"
import { LogoMark } from "../Logo"

// 登录/注册页的统一外壳（参考 sso.shoplazza.com 等竞品的单卡布局）：
// 全页用同一柔和靛蓝氛围底色铺光斑，中间浮一张圆角卡片；卡片内部
// md+ 再分「左品牌引导 / 右表单」两栏——品牌栏只是卡片内淡淡的淡彩渐变，
// 以细分割线过渡，不形成整屏左右两块硬色切。移动端只留表单栏，顶部居中补品牌。
// 文案均为 AI/Agent 核心卖点 + slogan A（把每一场面试，沉淀为下一次的从容）。

const brandBullets = [
  {
    title: "真实面试 AI 复盘",
    desc: "AI Agent 逐题点评，沉淀为你的专属能力画像",
  },
  {
    title: "AI 面试官随时候场",
    desc: "语音、文字双模式陪练，把紧张练成从容",
  },
  {
    title: "Web + 小程序多端同步",
    desc: "面试随手记录，数据多端同步、随时复盘",
  },
]

interface AuthShellProps {
  /** 表单标题（如「登录」/「注册」） */
  title: string
  /** 标题下方的一行说明 */
  description: string
  /** 表单主体（输入 + 提交按钮 + 底部链接等） */
  children: ReactNode
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      {/* 全页氛围光斑：同一底色上叠低透明度品牌光，不制造色块边界 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 size-[28rem] rounded-full bg-indigo-100/45 blur-3xl dark:bg-indigo-400/10" />
        <div className="absolute -bottom-32 -left-20 size-[26rem] rounded-full bg-violet-100/35 blur-3xl dark:bg-violet-400/10" />
      </div>

      {/* 单张浮层卡片 */}
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="grid md:grid-cols-[1fr_1.15fr]">
          {/* 左：品牌引导（md+）。淡彩渐变收在卡片内，右侧细线过渡 */}
          <div className="hidden flex-col justify-between gap-10 border-b border-border bg-gradient-to-br from-indigo-50/90 to-violet-50/50 p-8 sm:p-10 md:flex md:border-b-0 md:border-r dark:from-indigo-500/10 dark:to-violet-500/10">
            <div className="flex items-center gap-3">
              <LogoMark className="size-11 shrink-0" />
              <div className="leading-tight">
                <p className="text-lg font-bold tracking-tight text-foreground">AI 面师</p>
                <p className="text-sm text-muted-foreground">你的 AI 面试教练</p>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-semibold leading-snug tracking-tight text-foreground xl:text-[2.1rem]">
                把每一场面试，
                <br />
                沉淀为下一次的从容。
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                AI Agent 复盘每一场真实面试，把零散的临场发挥，沉淀成随取随用的能力。
              </p>
            </div>

            <ul className="space-y-3.5">
              {brandBullets.map((b) => (
                <li key={b.title} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                    <Check className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* 右：表单栏 */}
          <div className="p-6 sm:p-10">
            <div className="flex justify-center md:hidden">
              <LogoMark className="size-12 shrink-0" />
            </div>
            <div className="mt-4 text-center md:mt-0 md:text-left">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
