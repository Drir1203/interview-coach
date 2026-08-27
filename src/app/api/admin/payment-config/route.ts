import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"
import { PAYMENT_CONFIG_ID, sanitizePaymentConfig } from "@/lib/payment/payment-config"

// 管理端收款设置（单例 id=1）：
// - GET：读当前配置（价格页展示用；价格页本身走公开读，这里是后台编辑回显）
// - PUT：清洗校验后 upsert（wechatQrUrl/alipayQrUrl/accountHint）
// 鉴权：admin_session cookie；未登录或失效 → 401

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }
  const config = await prisma.paymentConfig.findUnique({ where: { id: PAYMENT_CONFIG_ID } })
  return Response.json({
    wechatQrUrl: config?.wechatQrUrl ?? null,
    alipayQrUrl: config?.alipayQrUrl ?? null,
    accountHint: config?.accountHint ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const verdict = sanitizePaymentConfig(body)
  if (!verdict.ok) {
    return Response.json({ error: verdict.error }, { status: 400 })
  }

  await prisma.paymentConfig.upsert({
    where: { id: PAYMENT_CONFIG_ID },
    update: verdict.data,
    create: { id: PAYMENT_CONFIG_ID, ...verdict.data },
  })

  return Response.json({ ok: true, ...verdict.data })
}
