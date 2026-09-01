import { LandingPage } from "@/components/landing/LandingPage"

// 独立营销首页：全屏无侧边栏（AppFrame 按路由判断不渲染 Sidebar）。
// 已登录用户访问 / 会被 middleware 重定向到 /dashboard；未登录看到此营销页。
export default function HomePage() {
  return <LandingPage />
}
