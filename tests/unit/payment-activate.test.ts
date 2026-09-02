import { describe, it, expect, vi, beforeEach } from "vitest"

// 在 import activate 前 mock @/lib/db，避免实例化真实 PrismaClient
const mockDb = vi.hoisted(() => ({
  subscriptionOrder: { findUnique: vi.fn(), update: vi.fn() },
  user: { update: vi.fn() },
  voiceCreditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ default: mockDb }))

import { activateSubscription } from "@/lib/payment/activate"

const NOW = new Date("2026-09-02T00:00:00.000Z")
const DAY = 86400000

function pendingOrder(plan: string, proExpiresAt: Date | null = null) {
  return {
    id: "o1",
    userId: "u1",
    plan,
    amount: 2900,
    status: "pending" as const,
    user: { proExpiresAt },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  // $transaction(array)：逐条执行 PrismaPromise
  mockDb.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops))
})

describe("activateSubscription", () => {
  it("voice 包（voice10）→ 订单置 paid + voiceCredits +10 + purchase 流水，且不触碰 proExpiresAt", async () => {
    mockDb.subscriptionOrder.findUnique.mockResolvedValue(pendingOrder("voice10"))

    const res = await activateSubscription("o1")

    expect(res).toEqual({ ok: true })
    expect(mockDb.subscriptionOrder.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "paid", paidAt: NOW },
    })
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { voiceCredits: { increment: 10 } },
    })
    expect(mockDb.voiceCreditLog.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: 10, reason: "purchase", orderId: "o1" },
    })
  })

  it("voice100 → 一次 +100 点", async () => {
    mockDb.subscriptionOrder.findUnique.mockResolvedValue(pendingOrder("voice100", null))

    await activateSubscription("o1")

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { voiceCredits: { increment: 100 } },
    })
  })

  it("subscription（month，无历史到期）→ proExpiresAt = now + 30d，不写点数流水", async () => {
    mockDb.subscriptionOrder.findUnique.mockResolvedValue(pendingOrder("month", null))

    const res = await activateSubscription("o1")

    expect(res).toEqual({ ok: true })
    const updateArgs = mockDb.user.update.mock.calls[0][0]
    expect(updateArgs.data.proExpiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY)
    expect(updateArgs.data.voiceCredits).toBeUndefined()
    expect(mockDb.voiceCreditLog.create).not.toHaveBeenCalled()
    // 订阅订单落 expiresAt
    expect(mockDb.subscriptionOrder.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "paid", paidAt: NOW, expiresAt: updateArgs.data.proExpiresAt },
    })
  })

  it("subscription 续费叠加：历史到期在未来（now+5d）→ 在旧到期上加 30d", async () => {
    mockDb.subscriptionOrder.findUnique.mockResolvedValue(
      pendingOrder("month", new Date(NOW.getTime() + 5 * DAY))
    )

    await activateSubscription("o1")

    const updateArgs = mockDb.user.update.mock.calls[0][0]
    expect(updateArgs.data.proExpiresAt.getTime()).toBe(NOW.getTime() + 5 * DAY + 30 * DAY)
  })

  it("已 paid 订单 → 幂等返回成功，不再重复激活", async () => {
    mockDb.subscriptionOrder.findUnique.mockResolvedValue({
      id: "o1", userId: "u1", plan: "month", status: "paid",
      user: { proExpiresAt: new Date(NOW.getTime() + DAY) },
    })

    const res = await activateSubscription("o1")

    expect(res).toEqual({ ok: true })
    expect(mockDb.subscriptionOrder.update).not.toHaveBeenCalled()
    expect(mockDb.user.update).not.toHaveBeenCalled()
    expect(mockDb.voiceCreditLog.create).not.toHaveBeenCalled()
  })

  it("未知套餐 → 报错，不落任何写操作", async () => {
    mockDb.subscriptionOrder.findUnique.mockResolvedValue(pendingOrder("vip999"))

    const res = await activateSubscription("o1")

    expect(res).toEqual({ ok: false, error: "未知套餐" })
    expect(mockDb.subscriptionOrder.update).not.toHaveBeenCalled()
    expect(mockDb.user.update).not.toHaveBeenCalled()
  })

  it("订单不存在 → 报错", async () => {
    mockDb.subscriptionOrder.findUnique.mockResolvedValue(null)

    const res = await activateSubscription("ghost")

    expect(res).toEqual({ ok: false, error: "订单不存在" })
  })
})
