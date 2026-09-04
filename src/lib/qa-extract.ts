// 完整稿问答抽取：把整段面试转写交给 LLM，还原成「逐条问答记录」
// —— 面试官一次提问 + 你的回答 = 一条。音频按 60s 分段 ASR 后在此拼接完整，
// 因此带上下文，能把被 60s 切点劈开的一问一答在完整上下文里接回，不再漏内容。
// 抽取语义是「穷举式逐条」，不是总结/浓缩：每一条独立，不把多轮合并成一条。
// 长稿自动分窗（相邻窗口重叠，防问答被窗口截断看残），多窗结果按序汇总后统一清洗：
// 丢弃空问题（首条空白）、仅把窗口重叠残留的「同一条」合并回去，
// 相隔很远的重复问题（面试里真又问了一次）仍保留为两条。

export interface QAPair {
  questionText: string
  userAnswer: string
}

export const DEFAULT_WINDOW_CHARS = 8000
export const DEFAULT_OVERLAP_CHARS = 1200
const MIN_QUESTION_CHARS = 2
const MIN_TRANSCRIPT_CHARS = 20
// 同题在输出序列中的近邻条数：≤ 此值视为窗口重叠/跨段残留的同一问答（合并接回），
// 超过则视为面试中真的又问了一次 → 保留为两条。
const DEDUP_NEAR_POS = 5

export interface ExtractOptions {
  windowChars?: number
  overlapChars?: number
  maxTokens?: number
  /** 可注入的模型调用，便于单测；接收 prompt，返回原始文本或 null。 */
  callModel?: (prompt: string, maxTokens: number) => Promise<string | null>
}

// ── 长稿分窗（纯函数） ──────────────────────────────────────────────
export function chunkTranscript(
  text: string,
  windowChars: number = DEFAULT_WINDOW_CHARS,
  overlapChars: number = DEFAULT_OVERLAP_CHARS
): string[] {
  const t = text.trim()
  if (!t) return []
  if (t.length <= windowChars) return [t]
  const step = Math.max(1, windowChars - overlapChars)
  const chunks: string[] = []
  for (let start = 0; start < t.length; start += step) {
    chunks.push(t.slice(start, start + windowChars))
  }
  return chunks
}

// ── 健壮 JSON 数组解析（纯函数） ────────────────────────────────────
// 兼容 ```json 围栏、前后夹带解释文字；跳过字符串内部的中括号（如 [Redis]）；
// 任何不符合「合法 JSON 数组」的情况一律返回 null，交由上层跳过该窗。
export function parseJsonArray(content: string): unknown[] | null {
  if (!content) return null
  let text = content.trim()
  // 剥掉 ```json ... ``` 围栏（若有）
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  // 找到最外层数组并抽取（引号感知，避免字符串里的 [ ] 干扰括号配对）
  const start = text.indexOf("[")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
    } else if (ch === "[") {
      depth++
    } else if (ch === "]") {
      depth--
      if (depth === 0) {
        try {
          const value: unknown = JSON.parse(text.slice(start, i + 1))
          return Array.isArray(value) ? value : null
        } catch {
          return null
        }
      }
    }
  }
  return null
}

// ── 清洗 + 近邻去重（纯函数） ───────────────────────────────────────
function normalizeQuestion(q: string): string {
  return q
    .trim()
    .toLowerCase()
    // 去掉首尾常见标点（中英文），仅用于判重
    .replace(/^[。．.！!？?~～\s、，,：:；;「」"'“”‘’]+|[。．.！!？?~～\s、，,：:；;「」"'“”‘’]+$/g, "")
    .replace(/\s+/g, "")
}

// 把同一问答的多份文本归成一份。返回归并后的回答文案。
// - 一份完全包含另一份（窗口重叠把整条重复输出）→ 保留更全的那份，不拼接；
// - 一份明显比另一份短（≥2 倍）→ 视为同题被回答了两遍，取更全那份，不拼接；
// - 长度接近、互不包含 → 视为同一问答被 60s/窗口切成的两段 → 按先后顺序拼接回完整回答。
function mergeAnswers(prev: string, next: string): { answer: string; useNext: boolean } {
  const p = prev.replace(/\s+/g, "")
  const n = next.replace(/\s+/g, "")
  if (!p) return { answer: next, useNext: true }
  if (!n) return { answer: prev, useNext: false }
  if (n.includes(p)) return { answer: next, useNext: true }
  if (p.includes(n)) return { answer: prev, useNext: false }
  const shorter = Math.min(p.length, n.length)
  const longer = Math.max(p.length, n.length)
  if (shorter > 0 && longer / shorter >= 2) {
    return longer === n.length ? { answer: next, useNext: true } : { answer: prev, useNext: false }
  }
  return { answer: prev + "\n" + next, useNext: false }
}

export function cleanQAs(list: unknown[]): QAPair[] {
  const out: QAPair[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue
    const o = raw as Record<string, unknown>
    const question = (
      typeof o.questionText === "string" ? o.questionText : typeof o.question === "string" ? o.question : ""
    ).trim()
    const answer = (
      typeof o.userAnswer === "string" ? o.userAnswer : typeof o.answer === "string" ? o.answer : ""
    ).trim()
    if (!question || question.length < MIN_QUESTION_CHARS) continue // 丢弃空问题/开场白占位（首条空白）
    const norm = normalizeQuestion(question)

    // 只在近邻内找同题残留：窗口重叠/跨段会把它输出两三次，位置相邻
    let mergeIdx = -1
    if (norm) {
      for (let i = out.length - 1; i >= 0 && i >= out.length - DEDUP_NEAR_POS; i--) {
        if (normalizeQuestion(out[i].questionText) === norm) {
          mergeIdx = i
          break
        }
      }
    }

    if (mergeIdx === -1) {
      out.push({ questionText: question, userAnswer: answer })
    } else {
      const prev = out[mergeIdx]
      const { answer: mergedAns, useNext } = mergeAnswers(prev.userAnswer, answer)
      // 归并后若采用的是「下一份」（同题更完整的回答），问题措辞也跟它走
      out[mergeIdx] = { questionText: useNext ? question : prev.questionText, userAnswer: mergedAns }
    }
  }
  return out
}

// ── 模型调用（默认 DeepSeek → DashScope 回退） ──────────────────────
async function defaultCallModel(prompt: string, maxTokens: number): Promise<string | null> {
  const keys = [
    { key: process.env.DEEPSEEK_API_KEY, url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    { key: process.env.DASHSCOPE_API_KEY, url: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-max" },
  ]
  for (const { key, url, model } of keys) {
    if (!key) continue
    try {
      const res = await fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: maxTokens }),
      })
      if (!res.ok) continue
      const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
      const content = data?.choices?.[0]?.message?.content
      if (typeof content === "string" && content) return content
    } catch {
      // 尝试下一个 provider
    }
  }
  return null
}

// ── 抽取提示词：穷举式逐条（不是总结浓缩） ──────────────────────────
function buildPrompt(windowText: string): string {
  return `你是面试复盘助手。下面是面试录音转写的完整对话（或其中一段连续窗口），请把它还原成「逐条问答记录」。

要求：
1. 只返回 JSON 数组，形如 [{"questionText":"面试官的问题","userAnswer":"你的回答"}]，不要任何多余文字或 markdown。
2. 穷举：对话里面试官问过的问题，每个都要输出为独立一条，严格按对话顺序，不要漏、不要跳、不要合并多条不同问答。
3. 不总结、不浓缩：回答保留候选人当时的原话（可去掉口癖、重复和语气词），不要改写成概括。
4. 同一次提问若回答被打断分几段才说完，仍只算一条，把后续内容并入该条的 userAnswer。
5. 若相邻窗口文字有重叠、某个问答看起来在前面已出现过，则不要重复输出同一条。
6. 纯寒暄、自报家门、没有实际提问的过渡不算问答，跳过；寒暄里带了实际提问则按提问保留。
7. 问题不能为空；只有独白而识别不出问题时不要编造问题，跳过。

转写内容：
${windowText}`
}

// ── 整稿抽取主入口 ─────────────────────────────────────────────────
export async function extractQAsFromTranscript(
  transcript: string,
  opts: ExtractOptions = {}
): Promise<QAPair[]> {
  const t = transcript?.trim?.() ?? ""
  if (t.length < MIN_TRANSCRIPT_CHARS) return []

  const windowChars = opts.windowChars ?? DEFAULT_WINDOW_CHARS
  const overlapChars = opts.overlapChars ?? DEFAULT_OVERLAP_CHARS
  const maxTokens = opts.maxTokens ?? 6000
  const callModel = opts.callModel ?? defaultCallModel

  const windows = chunkTranscript(t, windowChars, overlapChars)
  // 各窗口并行抽（长录音整稿抽的耗时大头在等 LLM，并行可显著压缩尾部等待），
  // Promise.all 保序，汇总后仍按对话顺序走清洗/近邻去重。
  const parsedList = await Promise.all(
    windows.map(async (window) => {
      const content = await callModel(buildPrompt(window), maxTokens)
      const parsed = content ? parseJsonArray(content) : null
      if (!parsed) {
        // 不再静默：至少留下一条可检索的服务端日志，方便定位丢内容
        console.warn(`[qa-extract] 窗口抽取未得到合法 JSON（窗口字数 ${window.length}）`)
        return []
      }
      return parsed
    })
  )
  const collected: unknown[] = []
  for (const parsed of parsedList) collected.push(...parsed)
  return cleanQAs(collected)
}
