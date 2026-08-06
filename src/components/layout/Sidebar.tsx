"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  GraduationCap,
  Settings,
  PlusCircle,
  LogOut,
  User,
  BarChart3,
  Menu,
  X,
  Bot,
  Target,
  LineChart,
  TrendingUp,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Logo } from "@/components/Logo"
import { useAuth } from "@/hooks/useAuth"
import { useState } from "react"

// 分组：总览独立顶层项 + 三组（D 风格：彩色圆角方块图标）
type NavTint = { bg: string; text: string; bgActive: string }
const navGroups = [
  {
    label: "AI 智能",
    items: [
      { href: "/coach", label: "AI 教练", icon: Bot, tint: { bg: "bg-indigo-100", text: "text-indigo-600", bgActive: "bg-indigo-200" } },
      { href: "/prep", label: "面试押题", icon: Target, tint: { bg: "bg-violet-100", text: "text-violet-600", bgActive: "bg-violet-200" } },
      { href: "/report", label: "成长报告", icon: LineChart, tint: { bg: "bg-emerald-100", text: "text-emerald-600", bgActive: "bg-emerald-200" } },
      { href: "/analysis", label: "深入分析", icon: BarChart3, tint: { bg: "bg-amber-100", text: "text-amber-600", bgActive: "bg-amber-200" } },
    ],
  },
  {
    label: "面试",
    items: [
      { href: "/interviews", label: "面试记录", icon: Briefcase, tint: { bg: "bg-blue-100", text: "text-blue-600", bgActive: "bg-blue-200" } },
      { href: "/practice", label: "模拟面试", icon: GraduationCap, tint: { bg: "bg-fuchsia-100", text: "text-fuchsia-600", bgActive: "bg-fuchsia-200" } },
      { href: "/companies", label: "公司看板", icon: Building2, tint: { bg: "bg-cyan-100", text: "text-cyan-600", bgActive: "bg-cyan-200" } },
    ],
  },
  {
    label: "求职",
    items: [
      { href: "/applications", label: "求职进度", icon: TrendingUp, tint: { bg: "bg-rose-100", text: "text-rose-600", bgActive: "bg-rose-200" } },
      { href: "/experiences", label: "面经库", icon: BookOpen, tint: { bg: "bg-teal-100", text: "text-teal-600", bgActive: "bg-teal-200" } },
    ],
  },
]

// D 风格导航项：彩色圆角方块图标 + 文字，激活方块加深 + 文字加粗
function NavItem({
  href,
  label,
  icon: Icon,
  tint,
  pathname,
  onClick,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  tint: NavTint
  pathname: string
  onClick?: () => void
}) {
  const isActive = pathname === href
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
        isActive ? "bg-muted/60" : "text-muted-foreground hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg",
          tint.bg,
          tint.text,
          isActive && tint.bgActive
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className={cn("text-[13px]", isActive && "font-semibold text-foreground")}>{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { user: session } = useAuth()
  const [open, setOpen] = useState(false)

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-6">
        <Logo size="sm" />
      </div>

      {/* 新建面试按钮 */}
      <div className="p-4">
        <Link href="/interviews/new" onClick={() => setOpen(false)}>
          <Button className="w-full gap-2 rounded-xl">
            <PlusCircle className="size-4" />
            记录新面试
          </Button>
        </Link>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-1">
        {/* 总览：独立顶层项（无冗余组标题） */}
        <div className="pb-1 pt-2">
          <NavItem href="/" label="总览" icon={LayoutDashboard} tint={{ bg: "bg-sky-100", text: "text-sky-600", bgActive: "bg-sky-200" }} pathname={pathname} onClick={() => setOpen(false)} />
        </div>

        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1 pt-4 text-[11px] font-medium tracking-wide text-muted-foreground/70">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavItem
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    tint={item.tint}
                    pathname={pathname}
                    onClick={() => setOpen(false)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* 底部：设置 + 暗色 + 用户，合并一个分区 */}
      <div className="border-t p-2.5">
        <NavItem href="/settings" label="设置" icon={Settings} tint={{ bg: "bg-gray-100", text: "text-gray-600", bgActive: "bg-gray-200" }} pathname={pathname} onClick={() => setOpen(false)} />
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <div className="text-xs text-muted-foreground">深色模式</div>
          <ThemeToggle />
        </div>
        <div className="mt-2 border-t pt-2">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted transition-colors">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                  {(session?.name || session?.email || "U")[0].toUpperCase()}
                </div>
                <span className="truncate">{session?.name || session?.email?.split("@")[0] || "用户"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {session?.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/interview/auth/login" })}>
                  <LogOut className="mr-2 size-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full gap-2" size="sm">
                <User className="size-4" />
                登录
              </Button>
            </Link>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* 移动端汉堡按钮 */}
      <button
        className="fixed left-4 top-3 z-50 flex size-9 items-center justify-center rounded-lg border bg-background md:hidden"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {/* 移动端遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 桌面端侧边栏 */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 flex-col border-r bg-sidebar md:flex">
        {sidebarContent}
      </aside>

      {/* 移动端侧边栏 */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* 桌面端主内容偏移 */}
      <main className="md:ml-64">{/* 实际 main 标签在 layout.tsx */}</main>
    </>
  )
}
