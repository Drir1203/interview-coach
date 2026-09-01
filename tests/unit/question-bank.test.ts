import { describe, it, expect, vi, beforeEach } from "vitest"

// 在 import question-bank 前 mock @/lib/ai-coach，隔离 chatWithFallback
const mockChat = vi.hoisted(() => vi.fn())
vi.mock("@/lib/ai-coach", () => ({ chatWithFallback: mockChat }))

import { AiQuotaError } from "@/lib/payment/ai-quota"
import {
  parseBankJsonArray,
  normalizeQuestions,
  extractQuestionsFromText,
  MAX_BANK_QUESTIONS,
  MAX_BANK_EXTRACT_CHARS,
} from "@/lib/question-bank"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("parseBankJsonArray", () => {
  it("纯 JSON 数组字符串 → 解析", () => {
    expect(parseBankJsonArray('[{"question":"Q1"}]')).toEqual([{ question: "Q1" }])
  })

  it("```json 围栏包裹 → 剥离后解析", () => {
    const raw = "```json\n[{\"question\":\"Q1\",\"answer\":\"A1\"}]\n```"
    expect(parseBankJsonArray(raw)).toEqual([{ question: "Q1", answer: "A1" }])
  })

  it("前导散文 + 围栏 → 只取数组部分", () => {
    const raw = "好的，以下是从文档中提取的题目：\n```json\n[{\"question\":\"Q1\"}]\n```"
    expect(parseBankJsonArray(raw)).toEqual([{ question: "Q1" }])
  })

  it("对象而非数组 → 解析失败返回 null", () => {
    expect(parseBankJsonArray('{"question":"Q1"}')).toBeNull()
  })

  it("垃圾内容 → 返回 null", () => {
    expect(parseBankJsonArray("抱歉，我无法识别题目")).toBeNull()
    expect(parseBankJsonArray("")).toBeNull()
  })
})

describe("normalizeQuestions", () => {
  it("合法数组 → 保留 question + 非空 answer", () => {
    expect(
      normalizeQuestions([
        { question: "请介绍你的项目经验", answer: "参考要点：STAR 结构" },
        { question: "为什么离开上一家公司" },
      ])
    ).toEqual([
      { question: "请介绍你的项目经验", answer: "参考要点：STAR 结构" },
      { question: "为什么离开上一家公司" },
    ])
  })

  it("非数组 / null / undefined → 空数组", () => {
    expect(normalizeQuestions("not array")).toEqual([])
    expect(normalizeQuestions(null)).toEqual([])
    expect(normalizeQuestions(undefined)).toEqual([])
  })

  it("题干为空、非字符串、长度 <4 → 丢弃", () => {
    expect(
      normalizeQuestions([{ question: "" }, { question: "技术" }, { question: 123 }, { question: "请介绍你自己" }])
    ).toEqual([{ question: "请介绍你自己" }])
  })

  it("题干去重（保留首次出现）", () => {
    expect(
      normalizeQuestions([
        { question: "请你介绍一下你自己" },
        { question: "为什么离开上一家公司" },
        { question: "请你介绍一下你自己" },
      ])
    ).toEqual([{ question: "请你介绍一下你自己" }, { question: "为什么离开上一家公司" }])
  })

  it("answer 为空/空白 → 省略", () => {
    expect(
      normalizeQuestions([
        { question: "请你介绍一下你自己", answer: "" },
        { question: "为什么离开上一家公司", answer: "   " },
      ])
    ).toEqual([{ question: "请你介绍一下你自己" }, { question: "为什么离开上一家公司" }])
  })

  it("超过上限 → 截断（默认 50）", () => {
    const big = Array.from({ length: 60 }, (_, i) => ({ question: `第${i + 1}题：请描述你的项目经验` }))
    expect(normalizeQuestions(big)).toHaveLength(MAX_BANK_QUESTIONS)
  })
})

describe("extractQuestionsFromText", () => {
  it("空文本 → 返回 [] 且不调用 AI", async () => {
    await expect(extractQuestionsFromText("", { userId: "u1" })).resolves.toEqual([])
    expect(mockChat).not.toHaveBeenCalled()
  })

  it("AI 返回好 JSON → 解析并规范化", async () => {
    mockChat.mockResolvedValue(
      '[{"question":"请你介绍一下你自己","answer":"参考要点：STAR"},{"question":"为什么离开上一家公司"}]'
    )
    const result = await extractQuestionsFromText("一段文档内容", { userId: "u1" })
    expect(result).toEqual([
      { question: "请你介绍一下你自己", answer: "参考要点：STAR" },
      { question: "为什么离开上一家公司" },
    ])
    // feature 计量 + 调用参数
    const [, , , opts] = mockChat.mock.calls[0]
    expect(opts).toMatchObject({ userId: "u1", feature: "question-bank" })
  })

  it("AI 返回垃圾 → 返回 []（不抛）", async () => {
    mockChat.mockResolvedValue("抱歉，我无法从文档中识别题目。")
    await expect(extractQuestionsFromText("内容", { userId: "u1" })).resolves.toEqual([])
  })

  it("超长文本 → 只喂前 6000 字符文档部分（A5 免费单请求 8000 token 护栏）", async () => {
    mockChat.mockResolvedValue("[]")
    const long = "字".repeat(MAX_BANK_EXTRACT_CHARS + 1000)
    await extractQuestionsFromText(long, { userId: "u1" })
    const inputContent = mockChat.mock.calls[0][1][0].content as string
    const prefix = "以下是面试题文档的文本内容，请提取所有面试题：\n\n"
    expect(inputContent.startsWith(prefix)).toBe(true)
    // 文档正文部分被截断到前 6000 字符（wrapper 前缀不计）
    expect(inputContent.slice(prefix.length).length).toBeLessThanOrEqual(MAX_BANK_EXTRACT_CHARS)
  })

  it("通用异常 → 吞掉并返回 []", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockChat.mockRejectedValue(new Error("网络故障"))
    await expect(extractQuestionsFromText("内容", { userId: "u1" })).resolves.toEqual([])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("AiQuotaError → 重抛（路由映射 429）", async () => {
    mockChat.mockRejectedValue(new AiQuotaError("DAILY_LIMIT", "今日用量已达上限"))
    await expect(extractQuestionsFromText("内容", { userId: "u1" })).rejects.toBeInstanceOf(AiQuotaError)
  })
})
