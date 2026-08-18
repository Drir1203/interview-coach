import { createHmac, timingSafeEqual } from "node:crypto"
import type { PaymentProvider } from "./types"

// Mock 支付渠道（v1）：验签 = X-Mock-Secret 头 或 订单方签名 mockToken（hmac(orderId, secret)）。
// 生产启用真实渠道后，此文件不再被路由使用，但保留作测试/本地回退。

function getSecret(): string {
  return process.env.MOCK_PAY_SECRET || ""
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

// 订单方签名：mock 回调的防伪标识（仅 mock 渠道，真实渠道用渠道自身签名）
export function createMockToken(orderId: string): string {
  return createHmac("sha256", getSecret()).update(orderId).digest("hex")
}

export const mockProvider: PaymentProvider = {
  name: "mock",

  async createPayment(order) {
    // auto（本地/测试）→ 前端显示「模拟支付成功」按钮；manual（生产）→ 仅管理员手动开通
    if (process.env.MOCK_AUTO_PAY === "true") {
      return { mockAction: "auto", mockToken: createMockToken(order.id) }
    }
    return { mockAction: "manual" }
  },

  async verifyCallback(rawBody, headers) {
    try {
      const body = JSON.parse(rawBody) as { orderId?: string; mockToken?: string }
      const orderId = body.orderId
      if (!orderId) return { orderId: "", success: false }

      const headerOk = safeEqual(headers["x-mock-secret"] ?? "", getSecret())
      const tokenOk =
        typeof body.mockToken === "string" && safeEqual(body.mockToken, createMockToken(orderId))
      if (!headerOk && !tokenOk) return { orderId, success: false }
      return { orderId, success: true }
    } catch {
      return { orderId: "", success: false }
    }
  },
}

// 渠道路由：v2 在此按订单 source 返回 wechat/alipay Provider，业务层零改动
export function getProvider(): PaymentProvider {
  return mockProvider
}
