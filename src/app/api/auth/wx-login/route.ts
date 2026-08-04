import { NextRequest } from "next/server"
import { encode } from "next-auth/jwt"
import prisma from "@/lib/db"

// 微信小程序一键登录
// 前端 wx.login() 拿 code → 本接口换 openid → 按 openid 建/找用户 → 签发 NextAuth 会话 token
// 需环境变量 WX_APPID + WX_SECRET（微信公众平台获取）
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    if (!code) {
      return Response.json({ error: "缺少微信登录 code" }, { status: 400 })
    }

    const appid = process.env.WX_APPID
    const secret = process.env.WX_SECRET
    if (!appid || !secret) {
      return Response.json({ error: "微信登录未配置(WX_APPID/WX_SECRET)" }, { status: 500 })
    }

    // code → openid
    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
    const resp = await fetch(url)
    const data = await resp.json()
    const openid = data?.openid
    if (!openid) {
      return Response.json({ error: data?.errmsg || "微信登录失败" }, { status: 401 })
    }

    // 按 openid 建/找用户
    let user = await prisma.user.findUnique({ where: { wechatOpenid: openid } })
    if (!user) {
      user = await prisma.user.create({
        data: { name: "微信用户", wechatOpenid: openid },
      })
    }

    // 签发会话 token（与 mp-login 同 cookie 名，小程序回传即可）
    const secure = (process.env.NEXTAUTH_URL || "").startsWith("https")
    const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token"
    const token = await encode({
      token: { sub: user.id, id: user.id, name: user.name, email: user.email, picture: user.image },
      secret: process.env.AUTH_SECRET!,
      salt: cookieName,
    })

    return Response.json({
      token,
      cookieName,
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (err: any) {
    return Response.json({ error: err.message || "微信登录失败" }, { status: 500 })
  }
}
