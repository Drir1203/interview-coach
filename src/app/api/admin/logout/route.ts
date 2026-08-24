import { NextResponse } from "next/server"
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS } from "@/lib/payment/admin-session"

// 退出：清掉 admin_session cookie
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 })
  return res
}
