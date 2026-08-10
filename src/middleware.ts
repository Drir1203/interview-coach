import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET })
  if (token) return NextResponse.next()

  // 未登录：直达登录页，callbackUrl 指向原功能页（登录后自动回跳对应功能页）
  const basePath = req.nextUrl.basePath || ""
  const loginUrl = new URL(`${basePath}/auth/login`, req.url)
  loginUrl.searchParams.set("callbackUrl", `${basePath}${req.nextUrl.pathname}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // 需登录的功能页（登录墙）。含子路由的用 :path* 一并覆盖。
  // 注意：matcher 必须内联字面量，Next.js 无法静态分析外部常量引用会退化为匹配所有路径。
  matcher: [
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
