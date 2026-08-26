import { describe, it, expect } from "vitest"
import {
  buildAdminGrant,
  buildOrderFilter,
  buildUserFilter,
  parsePage,
  parsePageSize,
  resolvePlan,
  ADMIN_PAGE_SIZE,
  ADMIN_PAGE_SIZE_MAX,
} from "@/lib/payment/admin-helpers"
import { PLANS } from "@/lib/payment/types"

describe("buildOrderFilter（订单筛选）", () => {
  it("无筛选参数 → ok + 空 where（回退默认全部）", () => {
    expect(buildOrderFilter({})).toEqual({ ok: true, where: {} })
  })

  it("status=pending → { status: { in: [pending] } }", () => {
    expect(buildOrderFilter({ status: "pending" })).toEqual({
      ok: true,
      where: { status: { in: ["pending"] } },
    })
  })

  it("source=mock → { source: mock }", () => {
    expect(buildOrderFilter({ source: "mock" })).toEqual({ ok: true, where: { source: "mock" } })
  })

  it("status + source 组合", () => {
    expect(buildOrderFilter({ status: "paid", source: "admin" })).toEqual({
      ok: true,
      where: { status: { in: ["paid"] }, source: "admin" },
    })
  })

  it("未知状态 → ok false + 中文错误信息", () => {
    const r = buildOrderFilter({ status: "bogus" })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.error).toContain("状态")
  })

  it("未知来源 → ok false", () => {
    const r = buildOrderFilter({ source: "wechat" })
    expect(r.ok).toBe(false)
  })
})

describe("buildUserFilter（用户搜索）", () => {
  it("空 q / 全空白 → {}（不过滤）", () => {
    expect(buildUserFilter({})).toEqual({})
    expect(buildUserFilter({ q: "   " })).toEqual({})
  })

  it("非空 q → OR：邮箱+昵称 不区分大小写 contains", () => {
    expect(buildUserFilter({ q: "张三" })).toEqual({
      OR: [
        { email: { contains: "张三", mode: "insensitive" } },
        { name: { contains: "张三", mode: "insensitive" } },
      ],
    })
  })

  it("q 首尾空白被裁剪后再匹配", () => {
    expect(buildUserFilter({ q: "  foo@bar.com  " })).toEqual({
      OR: [
        { email: { contains: "foo@bar.com", mode: "insensitive" } },
        { name: { contains: "foo@bar.com", mode: "insensitive" } },
      ],
    })
  })
})

describe("resolvePlan / buildAdminGrant（手动开通 Pro）", () => {
  it("resolvePlan 已知套餐 → ok + 套餐信息", () => {
    const r = resolvePlan("month")
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error("应返回成功")
    expect(r.plan.id).toBe("month")
    expect(r.plan.amount).toBe(2900)
  })

  it("resolvePlan 未知套餐 → ok false", () => {
    const r = resolvePlan("weekly")
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.error).toContain("套餐")
  })

  it("buildAdminGrant 生成已支付管理员订单数据（source=admin）", () => {
    const now = new Date("2026-08-26T00:00:00Z")
    const expiresAt = new Date("2026-09-25T00:00:00Z")
    const r = buildAdminGrant(PLANS.month, expiresAt, now)
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error("应返回成功")
    expect(r.data).toEqual({
      plan: "month",
      amount: 2900,
      status: "paid",
      source: "admin",
      paidAt: now,
      expiresAt,
    })
  })
})

describe("parsePage / parsePageSize（分页参数）", () => {
  it("parsePage 缺省/非法 → 1", () => {
    expect(parsePage(null)).toBe(1)
    expect(parsePage("0")).toBe(1)
    expect(parsePage("abc")).toBe(1)
  })

  it("parsePage 合法 → 原值", () => {
    expect(parsePage("3")).toBe(3)
  })

  it("parsePageSize 缺省 → 默认 20", () => {
    expect(parsePageSize(null)).toBe(ADMIN_PAGE_SIZE)
  })

  it("parsePageSize 超大 → 截断到上限 50", () => {
    expect(parsePageSize("999")).toBe(ADMIN_PAGE_SIZE_MAX)
  })
})
