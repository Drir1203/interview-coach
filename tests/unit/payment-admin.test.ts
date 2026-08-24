import { describe, it, expect, vi, afterEach } from "vitest"
import { SignJWT } from "jose"
import {
  signAdminSession,
  verifyAdminSession,
  requireAdmin,
  ADMIN_COOKIE,
} from "@/lib/payment/admin-session"

// 构造最简 NextRequest 替身：requireAdmin 只用到 cookies.get
const makeReq = (token?: string) => {
  return {
    cookies: {
      get: (name: string) => (token ? { name, value: token } : undefined),
    },
  } as any
}

const TEST_SECRET = "test-admin-secret-key"
const ADMIN = { id: "admin-1", username: "admin-test" }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("signAdminSession / verifyAdminSession", () => {
  it("正确签发 → 校验返回管理员身份", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    const token = await signAdminSession(ADMIN)
    await expect(verifyAdminSession(token)).resolves.toEqual(ADMIN)
  })

  it("篡改 token → 校验返回 null", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    const token = await signAdminSession(ADMIN)
    const tampered = token.slice(0, -4) + "AAAA"
    await expect(verifyAdminSession(tampered)).resolves.toBeNull()
  })

  it("密钥不符（换密钥签发）→ null", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    const other = await new SignJWT({ role: "admin", username: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("a")
      .setExpirationTime("12h")
      .sign(new TextEncoder().encode("other-secret"))
    await expect(verifyAdminSession(other)).resolves.toBeNull()
  })

  it("已过期 token → null", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    const now = Math.floor(Date.now() / 1000)
    const expired = await new SignJWT({ role: "admin", username: "admin-test" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin-1")
      .setIssuedAt(now - 200)
      .setExpirationTime(now - 100)
      .sign(new TextEncoder().encode(TEST_SECRET))
    await expect(verifyAdminSession(expired)).resolves.toBeNull()
  })

  it("role 非 admin 的 token → null", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    const userToken = await new SignJWT({ role: "user", username: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime("12h")
      .sign(new TextEncoder().encode(TEST_SECRET))
    await expect(verifyAdminSession(userToken)).resolves.toBeNull()
  })

  it("空 token / 非法字符串 → null", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    await expect(verifyAdminSession("")).resolves.toBeNull()
    await expect(verifyAdminSession("not-a-jwt")).resolves.toBeNull()
  })
})

describe("requireAdmin", () => {
  it("带有效 cookie → ok true 且带身份", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    const token = await signAdminSession(ADMIN)
    await expect(requireAdmin(makeReq(token))).resolves.toEqual({ ok: true, admin: ADMIN })
  })

  it("无 cookie → ok false", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    await expect(requireAdmin(makeReq())).resolves.toEqual({ ok: false })
  })

  it("无效 token → ok false", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    await expect(requireAdmin(makeReq("garbage-token"))).resolves.toEqual({ ok: false })
  })

  it("cookie 名必须是 admin_session", async () => {
    vi.stubEnv("AUTH_SECRET", TEST_SECRET)
    const token = await signAdminSession(ADMIN)
    const req = {
      cookies: { get: (name: string) => (name === ADMIN_COOKIE ? { name, value: token } : undefined) },
    } as any
    await expect(requireAdmin(req)).resolves.toEqual({ ok: true, admin: ADMIN })
  })
})
