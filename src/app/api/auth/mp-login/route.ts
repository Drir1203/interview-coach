import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { signIn } from "@/auth"

// 小程序登录：真实建立 NextAuth 会话，返回 session token 供小程序回传
// 小程序端无法走浏览器 Cookie，故通过 JSON 接口获取 token，
// 后续请求以 `Cookie: <cookieName>=<token>` 携带。
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return Response.json({ error: "邮箱和密码必填" }, { status: 400 })
    }

    try {
      await signIn("credentials", { email, password, redirect: false })
    } catch {
      // authorize 返回 null / 凭据错误时 signIn 抛 CredentialsSignin
      return Response.json({ error: "邮箱或密码错误" }, { status: 401 })
    }

    const cookieStore = await cookies()
    // HTTPS 生产环境 cookie 名带 __Secure- 前缀，优先读该形式，兼容 http 环境
    const sessionCookie =
      cookieStore.get("__Secure-authjs.session-token") ||
      cookieStore.get("authjs.session-token")

    if (!sessionCookie) {
      return Response.json({ error: "登录失败，未获取到会话" }, { status: 500 })
    }

    return Response.json({ token: sessionCookie.value, cookieName: sessionCookie.name })
  } catch (err: any) {
    return Response.json({ error: err.message || "登录失败" }, { status: 500 })
  }
}
