import { describe, it, expect } from "vitest"
import {
  AGENT_LISTENING,
  AGENT_THINKING,
  AGENT_TALKING,
  visualStateFromAgentState,
} from "@/lib/interview-visuals"

describe("visualStateFromAgentState：agentState → 视觉状态映射", () => {
  it("3(讲话) → talking，其余关闭，connected", () => {
    const s = visualStateFromAgentState(AGENT_TALKING)
    expect(s.talking).toBe(true)
    expect(s.thinking).toBe(false)
    expect(s.listening).toBe(false)
    expect(s.connected).toBe(true)
  })

  it("2(思考) → thinking，互斥", () => {
    const s = visualStateFromAgentState(AGENT_THINKING)
    expect(s.thinking).toBe(true)
    expect(s.talking).toBe(false)
    expect(s.listening).toBe(false)
    expect(s.connected).toBe(true)
  })

  it("1(聆听) → listening，互斥", () => {
    const s = visualStateFromAgentState(AGENT_LISTENING)
    expect(s.listening).toBe(true)
    expect(s.talking).toBe(false)
    expect(s.thinking).toBe(false)
    expect(s.connected).toBe(true)
  })

  it("undefined（未连接/连接中）→ idle，connected=false", () => {
    const s = visualStateFromAgentState(undefined)
    expect(s.talking).toBe(false)
    expect(s.thinking).toBe(false)
    expect(s.listening).toBe(false)
    expect(s.connected).toBe(false)
  })

  it("异常值（0/99）→ idle", () => {
    expect(visualStateFromAgentState(0).connected).toBe(false)
    expect(visualStateFromAgentState(99).talking).toBe(false)
    expect(visualStateFromAgentState(99).thinking).toBe(false)
  })
})
