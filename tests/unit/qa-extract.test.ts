import { describe, it, expect, vi } from "vitest"
import {
  chunkTranscript,
  parseJsonArray,
  cleanQAs,
  extractQAsFromTranscript,
  type QAPair,
} from "@/lib/qa-extract"

describe("chunkTranscript（完整稿按窗口切分 + 重叠）", () => {
  it("空/空白文本返回空数组", () => {
    expect(chunkTranscript("")).toEqual([])
    expect(chunkTranscript("   \n  ")).toEqual([])
  })

  it("不超过窗口长度时整体单块返回", () => {
    const text = "问".repeat(50)
    expect(chunkTranscript(text, 100, 20)).toEqual([text])
  })

  it("超过窗口长度时切多块，且相邻块带重叠", () => {
    const text = "字".repeat(250)
    const chunks = chunkTranscript(text, 100, 20)
    expect(chunks.length).toBeGreaterThan(1)
    // 相邻块按 100-20=80 步进；前一块尾部与后一块头部重叠 20 字
    expect(chunks[1].slice(0, 20)).toBe(chunks[0].slice(80, 100))
    // 拼接顺序应覆盖全文
    const covered = chunks.map((c) => c.length).reduce((a, b) => a + b, 0)
    expect(covered).toBeGreaterThanOrEqual(text.length)
  })

  it("恰等于窗口长度也算单块", () => {
    const text = "字".repeat(100)
    expect(chunkTranscript(text, 100, 20)).toEqual([text])
  })
})

describe("parseJsonArray（健壮 JSON 数组解析）", () => {
  it("解析纯数组", () => {
    expect(parseJsonArray('[{"questionText":"a","userAnswer":"b"}]')).toEqual([
      { questionText: "a", userAnswer: "b" },
    ])
  })

  it("兼容 ```json 围栏包裹", () => {
    const content = '```json\n[{"questionText":"a","userAnswer":"b"}]\n```'
    expect(parseJsonArray(content)).toEqual([{ questionText: "a", userAnswer: "b" }])
  })

  it("兼容前后夹带的解释文字", () => {
    const content = '好的，提取结果如下：[{"questionText":"a","userAnswer":"b"}]，请查收。'
    expect(parseJsonArray(content)).toEqual([{ questionText: "a", userAnswer: "b" }])
  })

  it("字符串里出现中括号（如项目名 [xx]）不会被误切", () => {
    const content =
      '[{"questionText":"用过 [Redis] 吗？","userAnswer":"用过，[集群] 部署过。"},{"questionText":"为什么？","userAnswer":"因为并发高。"}]'
    const out = parseJsonArray(content)
    expect(out).toHaveLength(2)
    expect((out![0] as Record<string, unknown>).userAnswer).toBe("用过，[集群] 部署过。")
  })

  it("非法 JSON / 无数组 / 空内容均返回 null", () => {
    expect(parseJsonArray("")).toBeNull()
    expect(parseJsonArray("没有数组的文本")).toBeNull()
    expect(parseJsonArray('{"a":1}')).toBeNull()
    expect(parseJsonArray('[{"questionText":"a",]')).toBeNull()
  })
})

describe("cleanQAs（空值过滤 + 兼容字段 + 去重）", () => {
  it("丢弃空 questionText 与不足 2 字的项", () => {
    const out = cleanQAs([
      { questionText: "", userAnswer: "开场白" },
      { questionText: "  ", userAnswer: "x" },
      { questionText: "请自我介绍", userAnswer: "我..." },
    ])
    expect(out).toEqual([{ questionText: "请自我介绍", userAnswer: "我..." }])
  })

  it("兼容 {question, answer} 字段名", () => {
    const out = cleanQAs([{ question: "讲个项目", answer: "电商订单系统" }])
    expect(out).toEqual([{ questionText: "讲个项目", userAnswer: "电商订单系统" }])
  })

  it("跳过 null/非对象/缺字段项", () => {
    const out = cleanQAs([null, 123, { questionText: 7 }, { questionText: "x", userAnswer: "y" }] as unknown[])
    expect(out).toEqual([])
  })

  it("归一化去重：重复问题保留回答更完整的一条，顺序按首次出现", () => {
    const out = cleanQAs([
      { questionText: " 讲讲你的项目？", userAnswer: "短答" },
      { questionText: "讲讲你的项目。", userAnswer: "这是一条非常完整的回答，包含了项目背景与结果" },
      { questionText: "为什么离职", userAnswer: "寻求成长" },
    ])
    expect(out).toHaveLength(2)
    expect(out[0].questionText).toBe("讲讲你的项目。")
    expect(out[0].userAnswer).toContain("非常完整")
    expect(out[1].questionText).toBe("为什么离职")
  })
})

describe("extractQAsFromTranscript（整稿窗口化抽取编排）", () => {
  const fakeCall = (content: string | null) => vi.fn(async () => content)

  it("过短文本(<20 字)直接返回 [] 且不调用模型", async () => {
    const callModel = fakeCall('[{"questionText":"a","userAnswer":"b"}]')
    const out = await extractQAsFromTranscript("你好，你好", { callModel })
    expect(out).toEqual([])
    expect(callModel).not.toHaveBeenCalled()
  })

  it("多窗口：长文稿分多次调用，结果按序合并且清洗", async () => {
    // 400 字文稿，窗口 100/重叠 20 → 5 次调用，每次返回互不相同的题目
    const qa = (n: number) => JSON.stringify([{ questionText: `问题${n}`, userAnswer: `答案${n}` }])
    let n = 0
    const callModel = vi.fn(async () => qa(++n))
    const text = "字".repeat(400)
    const out = await extractQAsFromTranscript(text, { windowChars: 100, overlapChars: 20, callModel })
    expect(callModel).toHaveBeenCalledTimes(5)
    // 每窗返回 1 条，clean 后条数 = 调用次数（题目各不相同）
    expect(out).toHaveLength(callModel.mock.calls.length)
    expect(out.every((o) => o.questionText && o.userAnswer)).toBe(true)
  })

  it("某窗口模型返回非法内容时该窗口被跳过，其余保留", async () => {
    // 150 字文稿，窗口 100/重叠 20 → 恰好 2 个窗口
    const seq = [null, '[{"questionText":"有效问题","userAnswer":"有效回答"}]']
    let idx = 0
    const callModel = vi.fn(async () => seq[idx++] ?? null)
    const text = "字".repeat(150)
    const out = await extractQAsFromTranscript(text, { windowChars: 100, overlapChars: 20, callModel })
    expect(callModel).toHaveBeenCalledTimes(2)
    expect(out).toEqual([{ questionText: "有效问题", userAnswer: "有效回答" }])
  })

  it("模型全部失败返回 []", async () => {
    const out = await extractQAsFromTranscript(
      "面试官：请自我介绍。我：我是做前端的。面试官：为什么离职。我：想成长。",
      { callModel: vi.fn(async () => null) }
    )
    expect(out).toEqual([])
  })

  it("跨窗口重复问题被去重", async () => {
    const callModel = vi.fn(async () =>
      JSON.stringify([{ questionText: "重复问题", userAnswer: "后窗的更长回答内容" }])
    )
    const text = Array.from({ length: 60 }, (_, i) => `第${i + 1}句。`).join("")
    const out = await extractQAsFromTranscript(text, { windowChars: 100, overlapChars: 20, callModel })
    expect(out).toHaveLength(1)
    expect(callModel.mock.calls.length).toBeGreaterThan(1)
    expect((out[0] as QAPair).questionText).toBe("重复问题")
  })
})
