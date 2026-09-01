"use client"

// 全局布局框架：按路由决定是否渲染 Sidebar。
//  `/` 是独立营销首页 → 不渲染侧边栏、main 无偏移；其余路径 → 侧边栏 + md:ml-64 偏移（原根 layout 样式）。
// 同时负责主题初始化：原逻辑在 Sidebar 里只覆盖 app 页，营销页没有 Sidebar，故移到此处覆盖所有路由。

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"

export function AppFrame({ children }: { children: React.ReactNode }) {
  // basePath 下 usePathname 返回去掉前缀后的路径，根路径即 "/"
  const isMarketing = usePathname() === "/"

  // 主题初始化：localStorage.theme 优先，否则跟随系统偏好
  useEffect(() => {
    const stored = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const dark = stored ? stored === "dark" : prefersDark
    document.documentElement.classList.toggle("dark", dark)
  }, [])

  return (
    <>
      {!isMarketing && <Sidebar />}
      <main
        className={
          isMarketing
            ? "min-h-screen"
            : "min-h-screen p-4 pt-16 md:ml-64 md:pt-8 md:p-8"
        }
      >
        {children}
      </main>
    </>
  )
}
