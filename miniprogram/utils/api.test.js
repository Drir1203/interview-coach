// api.js 的 review 扩展：mode/questionId/instruction 透传 + instruction 空值处理
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import api from "./api"
import config from "../config"

let capturedRequests = []

// request() 会拼接 baseUrl，断言相对路径时剥离前缀
function relUrl(full) {
  return full.startsWith(config.baseUrl) ? full.slice(config.baseUrl.length) : full
}

function installWxMock() {
  globalThis.wx = {
    getStorageSync: (key) => (key === "token" ? "test-token" : ""),
    request: (opts) => {
      capturedRequests.push(opts)
      opts.success({ statusCode: 200, data: { ok: true } })
    },
  }
}

describe("api.review options 透传", () => {
  beforeEach(() => {
    capturedRequests = []
    installWxMock()
  })

  afterEach(() => {
    delete globalThis.wx
  })

  it("全量复盘：默认只带 interviewId", async () => {
    await api.review("interview-1")
    expect(capturedRequests[0].url).toContain("/api/review")
    expect(capturedRequests[0].method).toBe("POST")
    expect(capturedRequests[0].data).toEqual({ interviewId: "interview-1" })
  })

  it("单题重新生成：透传 mode/questionId/instruction", async () => {
    await api.review("interview-1", {
      mode: "question",
      questionId: "q-9",
      instruction: "更深入分析，结合简历",
    })
    expect(capturedRequests[0].data).toEqual({
      interviewId: "interview-1",
      mode: "question",
      questionId: "q-9",
      instruction: "更深入分析，结合简历",
    })
  })

  it("instruction 为空白时不传给后端", async () => {
    await api.review("interview-1", { mode: "question", questionId: "q-9", instruction: "   " })
    expect(capturedRequests[0].data).toEqual({
      interviewId: "interview-1",
      mode: "question",
      questionId: "q-9",
    })
  })
})

describe("api.coachChat 透传 conversationId", () => {
  beforeEach(() => {
    capturedRequests = []
    installWxMock()
  })

  afterEach(() => {
    delete globalThis.wx
  })

  it("新对话：不传 conversationId", async () => {
    await api.coachChat([{ role: "user", content: "hi" }])
    expect(capturedRequests[0].data).toEqual({ messages: [{ role: "user", content: "hi" }] })
  })

  it("续聊：透传 conversationId", async () => {
    await api.coachChat([{ role: "user", content: "hi" }], "conv-abc")
    expect(capturedRequests[0].data).toEqual({
      messages: [{ role: "user", content: "hi" }],
      conversationId: "conv-abc",
    })
  })

  it("空字符串 conversationId 不携带", async () => {
    await api.coachChat([{ role: "user", content: "hi" }], "")
    expect(capturedRequests[0].data).toEqual({ messages: [{ role: "user", content: "hi" }] })
  })
})

describe("api.coach 历史对话列表", () => {
  beforeEach(() => {
    capturedRequests = []
    installWxMock()
  })

  afterEach(() => {
    delete globalThis.wx
  })

  it("getCoachConversations：无关键词时 URL 不带 query", async () => {
    await api.getCoachConversations()
    expect(relUrl(capturedRequests[0].url)).toBe("/api/coach/conversations")
    expect(capturedRequests[0].method).toBe("GET")
  })

  it("getCoachConversations：有关键词时拼 q 参数（encodeURIComponent）", async () => {
    await api.getCoachConversations("字节 面试")
    expect(relUrl(capturedRequests[0].url)).toBe(
      "/api/coach/conversations?q=" + encodeURIComponent("字节 面试")
    )
  })

  it("getCoachConversation：按 id 拉取详情", async () => {
    await api.getCoachConversation("conv-1")
    expect(relUrl(capturedRequests[0].url)).toBe("/api/coach/conversations/conv-1")
    expect(capturedRequests[0].method).toBe("GET")
  })

  it("renameCoachConversation：PUT + title body", async () => {
    await api.renameCoachConversation("conv-1", "字节二面复盘")
    expect(relUrl(capturedRequests[0].url)).toBe("/api/coach/conversations/conv-1")
    expect(capturedRequests[0].method).toBe("PUT")
    expect(capturedRequests[0].data).toEqual({ title: "字节二面复盘" })
  })

  it("deleteCoachConversation：DELETE 请求", async () => {
    await api.deleteCoachConversation("conv-1")
    expect(relUrl(capturedRequests[0].url)).toBe("/api/coach/conversations/conv-1")
    expect(capturedRequests[0].method).toBe("DELETE")
  })
})
