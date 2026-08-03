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

const navItems = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/coach", label: "AI 教练", icon: Bot },
  { href: "/interviews", label: "面试记录", icon: Briefcase },
  { href: "/analysis", label: "深入分析", icon: BarChart3 },
  { href: "/companies", label: "公司看板", icon: Building2 },
  { href: "/practice", label: "模拟面试", icon: GraduationCap },
  { href: "/settings", label: "设置", icon: Settings },
]

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
          <Button className="w-full gap-2">
            <PlusCircle className="size-4" />
            记录新面试
          </Button>
        </Link>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 暗色模式切换 */}
      <div className="border-t px-3 py-2">
        <ThemeToggle />
      </div>

      {/* 用户信息 */}
      <div className="border-t p-3">
        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted transition-colors">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {(session?.name || session?.email || "U")[0].toUpperCase()}
              </div>
              <span className="truncate text-sm font-medium">
                {session?.name || session?.email?.split("@")[0] || "用户"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
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
