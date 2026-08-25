import { describe, it, expect, vi, afterEach } from "vitest"
import { buildInterviewerPrompt, MAX_INTERVIEWER_PROMPT_LENGTH } from "@/lib/ai-interview/prompt"
import { getAiInterviewConfig, isAiInterviewEnabled } from "@/lib/ai-interview/config"
import { resolveProvider, startInterview } from "@/lib/ai-interview/service"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("C4 优雅降级开关：isAiInterviewEnabled / getAiInterviewConfig", () => {
  it("未配置任何 IMS_* → 降级关闭 AI 面试", () => {
    expect(isAiInterviewEnabled()).toBe(false)
  })

  it("IMS_* 四项齐全 → 启用且 region 有默认值 cn-shanghai", () => {
    vi.stubEnv("IMS_ACCESS_KEY_ID", "ak")
    vi.stubEnv("IMS_ACCESS_KEY_SECRET", "sk")
    vi.stubEnv("IMS_AGENT_ID", "agent-1")
    vi.stubEnv("IMS_APP_ID", "app-1")

    expect(isAiInterviewEnabled()).toBe(true)
    expect(getAiInterviewConfig()).toEqual({
      accessKeyId: "ak",
      accessKeySecret: "sk",
      agentId: "agent-1",
      appId: "app-1",
      region: "cn-shanghai",
    })
  })

  it("缺任一项 → 降级（config null）", () => {
    vi.stubEnv("IMS_ACCESS_KEY_ID", "ak")
    vi.stubEnv("IMS_ACCESS_KEY_SECRET", "sk")
    vi.stubEnv("IMS_AGENT_ID", "agent-1")
    // 缺 IMS_APP_ID

    expect(isAiInterviewEnabled()).toBe(false)
    expect(getAiInterviewConfig()).toBeNull()
  })
})

describe("P1 未接线 provider：resolveProvider / startInterview", () => {
  it("未配置 → provider null，startInterview 降级返回 text 模式（带 reason）", async () => {
    expect(resolveProvider()).toBeNull()
    const result = await startInterview({
      userId: "u1",
      company: "某公司",
      position: "前端",
      prompt: "p",
    })
    if (result.mode !== "text") throw new Error("应降级为 text 模式")
    expect(typeof result.reason).toBe("string")
  })
})

describe("buildInterviewerPrompt（纯函数）", () => {
  it("组装包含公司/岗位/轮次标签", () => {
    const p = buildInterviewerPrompt({ company: "字节", position: "后端", roundType: "first" })
    expect(p).toContain("字节")
    expect(p).toContain("后端")
    expect(p).toContain("首轮")
  })

  it("grill=true 追加压力面规则", () => {
    const p = buildInterviewerPrompt({ company: "字节", position: "后端", grill: true })
    expect(p).toContain("压力面")
  })

  it("超长输入被截断到 ≤3072 字符", () => {
    const p = buildInterviewerPrompt({
      company: "x".repeat(5000),
      position: "y".repeat(5000),
      userContext: "u".repeat(5000),
      resumeText: "r".repeat(5000),
    })
    expect(p.length).toBeLessThanOrEqual(MAX_INTERVIEWER_PROMPT_LENGTH)
  })

  it("候选人背景与简历摘要各自截断（避免整体被尾部截断丢人设）", () => {
    const p = buildInterviewerPrompt({
      company: "A",
      position: "B",
      userContext: "u".repeat(5000),
      resumeText: "r".repeat(5000),
    })
    // 面试规则必须保留在最前段，背景/简历被截断在尾部
    expect(p).toContain("面试规则")
    expect(p).toContain("候选人背景")
    expect(p).toContain("候选人简历摘要")
  })
})
