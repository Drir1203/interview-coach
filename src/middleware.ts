import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl

  // API routes 不拦截（API 自己处理鉴权）
  if (pathname.startsWith("/api/")) return

  // 登录/注册页不拦截
  if (pathname.startsWith("/auth/")) return

  // 静态资源不拦截
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return

  // 未登录 → 重定向到登录页
  if (!req.auth) {
    const loginUrl = new URL("/auth/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
