import { describe, it, expect } from "vitest"
import { evaluateNotify } from "@/lib/payment/notify"

// evaluateNotify：用户「我已转账」声明的前置合法性（纯函数，不碰 DB）。
// 路由层负责查订单并传入，判定结果决定是否允许写 userNotifiedAt。

const order = {
  userId: "user-1",
  status: "pending",
  userNotifiedAt: null as Date | null,
}

describe("evaluateNotify（我已转账声明合法性）", () => {
  it("本人 + pending + 未通知 → ok", () => {
    expect(evaluateNotify(order, "user-1")).toEqual({ ok: true })
  })

  it("订单不存在 → no_order", () => {
    const r = evaluateNotify(null, "user-1")
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.code).toBe("no_order")
    expect(r.error).toContain("订单")
  })

  it("非本人订单 → not_owner", () => {
    const r = evaluateNotify(order, "user-2")
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.code).toBe("not_owner")
    expect(r.error).toContain("无权")
  })

  it("非 pending 状态（paid）→ not_pending", () => {
    const r = evaluateNotify({ ...order, status: "paid" }, "user-1")
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.code).toBe("not_pending")
  })

  it("已通知过（幂等拒绝，防重复提交）→ already_notified", () => {
    const r = evaluateNotify({ ...order, userNotifiedAt: new Date("2026-08-26T00:00:00Z") }, "user-1")
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.code).toBe("already_notified")
    expect(r.error).toContain("已标记")
  })
})
