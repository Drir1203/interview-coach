import { SignJWT, jwtVerify } from "jose"
import type { NextRequest } from "next/server"

// 管理后台会话：独立于主站 NextAuth 用户会话。
// - cookie 名 admin_session（与 authjs.session-token 完全不同，按 host 隔离）
// - JWT HS256，密钥复用 AUTH_SECRET（不新增 env）
// - 会话时长 12h（管理操作一次完成，长期后台自行重新登录）

export const ADMIN_COOKIE = "admin_session"
const SESSION_TTL = "12h"

export interface AdminSessionUser {
  id: string
  username: string
}

function getSecretKey(): Uint8Array {
  // AUTH_SECRET 未配置时签发必然失败（jose 会抛错），requireAdmin 侧由 try/catch 兜底返回未授权
  return new TextEncoder().encode(process.env.AUTH_SECRET || "")
}

// 签发管理会话 token（登录成功后调用）
export async function signAdminSession(admin: AdminSessionUser): Promise<string> {
  return new SignJWT({ role: "admin", username: admin.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey())
}

// 校验 token：过期/篡改/密钥不符/非 admin 角色 → 一律返回 null
export async function verifyAdminSession(token: string): Promise<AdminSessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] })
    if (payload.role !== "admin" || !payload.sub || typeof payload.username !== "string") {
      return null
    }
    return { id: payload.sub, username: payload.username }
  } catch {
    return null
  }
}

// 路由级鉴权：读 cookie → 校验 → { ok: true, admin } | { ok: false }
export async function requireAdmin(
  req: NextRequest
): Promise<{ ok: true; admin: AdminSessionUser } | { ok: false }> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!token) return { ok: false }
  const admin = await verifyAdminSession(token)
  if (!admin) return { ok: false }
  return { ok: true, admin }
}

// 登录/退出接口共用的 cookie 设置选项：
// Path=/interview（覆盖 admin 页面 + /api/admin/* + /api/payment/mock/approve）
// SameSite=Strict + Secure：仅同站 HTTPS 下携带，杜绝跨站携带
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/interview",
  maxAge: 60 * 60 * 12, // 12h
}
