// util.js 纯函数测试：分数刻度（10 分制）+ 走势文本 + 趋势筛选 + 策略存储
import { describe, it, expect } from "vitest"
import { clampScore, barPercent, trendText, filterTrend, storeStrategy } from "./util"

describe("clampScore", () => {
  it("正常值原样返回", () => {
    expect(clampScore(7)).toBe(7)
    expect(clampScore(0)).toBe(0)
    expect(clampScore(10)).toBe(10)
  })

  it("超过 max 时钳制到 max", () => {
    expect(clampScore(12)).toBe(10)
    expect(clampScore(10.5)).toBe(10)
  })

  it("低于 0 时钳制到 0", () => {
    expect(clampScore(-3)).toBe(0)
  })

  it("自定义 max", () => {
    expect(clampScore(5, 5)).toBe(5)
    expect(clampScore(6, 5)).toBe(5)
  })

  it("非数字输入返回 0", () => {
    expect(clampScore("abc")).toBe(0)
    expect(clampScore(null)).toBe(0)
    expect(clampScore(undefined)).toBe(0)
  })
})

describe("barPercent", () => {
  it("按 10 分制换算百分比", () => {
    expect(barPercent(5)).toBe(50)
    expect(barPercent(10)).toBe(100)
    expect(barPercent(7.5)).toBe(75)
    expect(barPercent(0)).toBe(0)
  })

  it("越界钳制到 0-100", () => {
    expect(barPercent(12)).toBe(100)
    expect(barPercent(-2)).toBe(0)
  })

  it("非数字输入返回 0", () => {
    expect(barPercent("x")).toBe(0)
    expect(barPercent(null)).toBe(0)
  })
})

describe("trendText", () => {
  it("≥2 场拼接走势序列（分数四舍五入取整）", () => {
    expect(trendText([{ score: 7 }, { score: 8 }, { score: 9 }])).toBe("7 → 8 → 9")
    expect(trendText([{ score: 7.4 }, { score: 8.6 }])).toBe("7 → 9")
  })

  it("不足 2 场返回空串", () => {
    expect(trendText([{ score: 7 }])).toBe("")
    expect(trendText([])).toBe("")
  })

  it("null/undefined 返回空串", () => {
    expect(trendText(null)).toBe("")
    expect(trendText(undefined)).toBe("")
  })
})

describe("filterTrend", () => {
  const trend = [
    { date: "2026-07-01", score: 7, company: "字节", position: "后端" },
    { date: "2026-07-05", score: 8, company: "腾讯", position: "后端" },
    { date: "2026-07-09", score: 9, company: "字节", position: "后端" },
  ]

  it("company 为空时返回原数组", () => {
    expect(filterTrend(trend, "")).toEqual(trend)
    expect(filterTrend(trend, null)).toEqual(trend)
    expect(filterTrend(trend, undefined)).toEqual(trend)
    expect(filterTrend(trend, "all")).toEqual(trend)
  })

  it("按公司过滤", () => {
    const bytes = filterTrend(trend, "字节")
    expect(bytes.length).toBe(2)
    expect(bytes.every((t) => t.company === "字节")).toBe(true)
  })

  it("无匹配公司返回空数组", () => {
    expect(filterTrend(trend, "阿里")).toEqual([])
  })

  it("非法输入返回空数组", () => {
    expect(filterTrend(null, "字节")).toEqual([])
    expect(filterTrend(undefined, "字节")).toEqual([])
    expect(filterTrend("not-array", "字节")).toEqual([])
  })
})

describe("storeStrategy", () => {
  it("更新匹配项的 strategyBlocks（不可变）", () => {
    const apps = [{ id: "a1", name: "A" }, { id: "a2", name: "B" }]
    const blocks = [{ type: "p", text: "策略" }]
    const next = storeStrategy(apps, "a1", blocks)
    expect(next[0].strategyBlocks).toEqual(blocks)
    expect(next[0].name).toBe("A")
    expect(next[1]).toEqual({ id: "a2", name: "B" })
  })

  it("无匹配时返回原数组（不修改）", () => {
    const apps = [{ id: "a1", name: "A" }]
    expect(storeStrategy(apps, "nope", [])).toEqual(apps)
  })

  it("非法输入返回空数组", () => {
    expect(storeStrategy(null, "a1", [])).toEqual([])
    expect(storeStrategy(undefined, "a1", [])).toEqual([])
  })
})
