import { NextRequest, NextResponse } from "next/server"
import { compare } from "bcryptjs"
import prisma from "@/lib/db"
import {
  signAdminSession,
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
} from "@/lib/payment/admin-session"

// 管理后台登录（独立于主站 NextAuth 用户登录）：
// 校验 AdminUser 用户名+密码 → 签发 admin_session cookie（HttpOnly）。
// 极简内存限流：单实例 PM2 fork 下有效，按 IP 5 次失败锁 15 分钟，防爆破。
const MAX_FAIL = 5
const LOCK_MS = 15 * 60 * 1000
const failCounts = new Map<string, { count: number; lockedUntil: number }>()

function clientIp(req: NextRequest): string {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
}

function isLocked(ip: string): boolean {
  const rec = failCounts.get(ip)
  if (!rec) return false
  if (Date.now() < rec.lockedUntil) return true
  failCounts.delete(ip)
  return false
}

function recordFail(ip: string) {
  const rec = failCounts.get(ip)
  const count = (rec?.count ?? 0) + 1
  failCounts.set(ip, {
    count,
    lockedUntil: count >= MAX_FAIL ? Date.now() + LOCK_MS : (rec?.lockedUntil ?? 0),
  })
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (isLocked(ip)) {
    return Response.json({ error: "尝试次数过多，请 15 分钟后再试" }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const username = typeof body.username === "string" ? body.username.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""
  if (!username || !password) {
    return Response.json({ error: "请输入用户名和密码" }, { status: 400 })
  }

  const admin = await prisma.adminUser.findUnique({ where: { username } })
  const ok = admin ? await compare(password, admin.passwordHash) : false
  if (!admin || !ok) {
    recordFail(ip)
    return Response.json({ error: "用户名或密码错误" }, { status: 401 })
  }

  const token = await signAdminSession({ id: admin.id, username: admin.username })
  failCounts.delete(ip)
  const res = NextResponse.json({ ok: true, username: admin.username })
  res.cookies.set(ADMIN_COOKIE, token, ADMIN_COOKIE_OPTIONS)
  return res
}
