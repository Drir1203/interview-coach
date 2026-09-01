import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default async function middleware(req: NextRequest) {
  // 与服务端 Auth.js 保持一致的 secureCookie 判定：
  // 存在 NEXTAUTH_URL/AUTH_URL 时以其协议为准（本项目 https → __Secure- 前缀 cookie），
  // 否则按请求本身协议判定。getToken 默认按非安全 cookie 名（authjs.session-token）读取，
  // 不显式传 secureCookie 会导致读不到 __Secure-authjs.session-token → 已登录也被当未登录。
  const envUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const secureCookie = envUrl
    ? new URL(envUrl).protocol === "https:"
    : req.nextUrl.protocol === "https:"
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie })
  const basePath = req.nextUrl.basePath || ""

  // 独立营销首页：已登录 → 进总览；未登录 → 放行看营销页
  if (req.nextUrl.pathname === "/") {
    if (token) return NextResponse.redirect(new URL(`${basePath}/dashboard`, req.url))
    return NextResponse.next()
  }

  if (token) return NextResponse.next()

  // 未登录：直达登录页，callbackUrl 指向原功能页（登录后自动回跳对应功能页）
  const loginUrl = new URL(`${basePath}/auth/login`, req.url)
  loginUrl.searchParams.set("callbackUrl", `${basePath}${req.nextUrl.pathname}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // 需登录的功能页（登录墙）。含子路由的用 :path* 一并覆盖。
  // 注意：matcher 必须内联字面量，Next.js 无法静态分析外部常量引用会退化为匹配所有路径。
  matcher: [
    "/",
    "/dashboard",
    "/question-bank",
    "/coach",
    "/prep",
    "/report",
    "/analysis",
    "/applications",
    "/companies",
    "/experiences",
    "/settings",
    "/interviews/:path*",
    "/practice/:path*",
  ],
}
