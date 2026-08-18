import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { computeExpiry, amountMatches, PLANS } from "@/lib/payment/types"
import { mockProvider, createMockToken } from "@/lib/payment/mock"

const SECRET = "test-secret"
const DAY = 24 * 3600 * 1000

beforeEach(() => {
  vi.stubEnv("MOCK_PAY_SECRET", SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("createPayment", () => {
  it("MOCK_AUTO_PAY=true → auto + mockToken", async () => {
    vi.stubEnv("MOCK_AUTO_PAY", "true")
    const res = await mockProvider.createPayment({ id: "o1", amount: 2900, plan: "month" })
    expect(res.mockAction).toBe("auto")
    expect(res.mockToken).toBe(createMockToken("o1"))
  })

  it("未设 MOCK_AUTO_PAY → manual", async () => {
    vi.stubEnv("MOCK_AUTO_PAY", undefined)
    const res = await mockProvider.createPayment({ id: "o1", amount: 2900, plan: "month" })
    expect(res.mockAction).toBe("manual")
    expect(res.mockToken).toBeUndefined()
  })
})

describe("verifyCallback", () => {
  it("X-Mock-Secret 头正确 → success", async () => {
    const res = await mockProvider.verifyCallback('{"orderId":"o1"}', {
      "x-mock-secret": SECRET,
    })
    expect(res).toEqual({ orderId: "o1", success: true })
  })

  it("头缺失/错误 → 拒签", async () => {
    const missing = await mockProvider.verifyCallback('{"orderId":"o1"}', {})
    expect(missing.success).toBe(false)

    const wrong = await mockProvider.verifyCallback('{"orderId":"o1"}', {
      "x-mock-secret": "wrong-secret",
    })
    expect(wrong.success).toBe(false)
  })

  it("body 带正确 mockToken → success（订单方签名）", async () => {
    const token = createMockToken("o1")
    const res = await mockProvider.verifyCallback(JSON.stringify({ orderId: "o1", mockToken: token }), {})
    expect(res.success).toBe(true)
  })

  it("mockToken 伪造（他人订单/错密钥）→ 拒签", async () => {
    const forged = createMockToken("o2") // 用另一个订单号签的 token
    const res = await mockProvider.verifyCallback(JSON.stringify({ orderId: "o1", mockToken: forged }), {})
    expect(res.success).toBe(false)
  })

  it("body 非法 JSON → 拒签", async () => {
    const res = await mockProvider.verifyCallback("not-json", {})
    expect(res.success).toBe(false)
  })
})

describe("computeExpiry（续费叠加）", () => {
  const now = new Date("2026-08-17T00:00:00.000Z")

  it("无现有到期 → now + 时长", () => {
    expect(computeExpiry(null, now, 30).getTime()).toBe(now.getTime() + 30 * DAY)
  })

  it("现有到期在未来 → 在现有之上叠加", () => {
    const current = new Date(now.getTime() + 10 * DAY)
    expect(computeExpiry(current, now, 30).getTime()).toBe(now.getTime() + 40 * DAY)
  })

  it("现有到期已过去 → 从 now 重新起算", () => {
    const current = new Date(now.getTime() - 5 * DAY)
    expect(computeExpiry(current, now, 30).getTime()).toBe(now.getTime() + 30 * DAY)
  })
})

describe("amountMatches（金额校验）", () => {
  it("相等 → true", () => {
    expect(amountMatches(2900, 2900)).toBe(true)
  })

  it("不等 → false", () => {
    expect(amountMatches(2900, 3000)).toBe(false)
  })

  it("非安全整数 → false", () => {
    expect(amountMatches(2900, Number.MAX_SAFE_INTEGER + 1)).toBe(false)
  })
})

describe("PLANS 定价表", () => {
  it("月卡可用，季卡/年卡即将上线", () => {
    expect(PLANS.month).toMatchObject({ amount: 2900, status: "available" })
    expect(PLANS.quarter.status).toBe("soon")
    expect(PLANS.year.status).toBe("soon")
  })
})
