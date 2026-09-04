// 完整稿 QA 抽取：把一整段面试转写对话交给 LLM，抽取「面试官提问 → 我的回答」。
// 长稿自动按窗口切分（相邻窗口重叠以防把一问一答切散），多窗结果合并后再统一清洗
// 空值、去重。相比按 60 秒音频碎片各自抽取，整稿抽取带上下文，丢题/空题明显减少。

export interface QAPair {
  questionText: string
  userAnswer: string
}

export const DEFAULT_WINDOW_CHARS = 5000
export const DEFAULT_OVERLAP_CHARS = 800
const MIN_QUESTION_CHARS = 2
const MIN_TRANSCRIPT_CHARS = 20

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

// ── 清洗 + 去重（纯函数） ───────────────────────────────────────────
function normalizeQuestion(q: string): string {
  return q
    .trim()
    .toLowerCase()
    // 去掉首尾常见标点（中英文），仅用于判重
    .replace(/^[。．.！!？?~～\s、，,：:；;「」"'“”‘’]+|[。．.！!？?~～\s、，,：:；;「」"'“”‘’]+$/g, "")
    .replace(/\s+/g, "")
}

export function cleanQAs(list: unknown[]): QAPair[] {
  const seen = new Map<string, number>() // 归一化问题 → result 下标
  const out: QAPair[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue
    const o = raw as Record<string, unknown>
    const question =
      typeof o.questionText === "string" ? o.questionText : typeof o.question === "string" ? o.question : ""
    const answer =
      typeof o.userAnswer === "string" ? o.userAnswer : typeof o.answer === "string" ? o.answer : ""
    const q = question.trim()
    const a = answer.trim()
    if (!q || q.length < MIN_QUESTION_CHARS) continue // 丢弃空问题/纯开场白占位
    const norm = normalizeQuestion(q)
    const existingIdx = seen.get(norm)
    if (existingIdx === undefined) {
      seen.set(norm, out.length)
      out.push({ questionText: q, userAnswer: a })
    } else if (a.length > out[existingIdx].userAnswer.length) {
      // 重叠窗口可能产出重复问题：保留回答更完整的一条，顺序按首次出现稳定
      out[existingIdx] = { questionText: q, userAnswer: a }
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

function buildPrompt(windowText: string): string {
  return `你是面试复盘助手。以下是面试录音的一段转写（可能是完整对话的一段窗口），
从中识别「面试官提问 → 你（候选人）回答」的问答对。
要求：
1. 只返回 JSON 数组，形如 [{"questionText":"问题","userAnswer":"回答"}]，不要任何多余文字或 markdown。
2. 问题要还原面试官原话的主干，回答保留候选人真实内容（可适度精简，不要编造）。
3. 寒暄、开场白、自报家门、无实质问题的闲聊不算问题；无法分离出问答时返回 []。
4. 严格按对话出现顺序输出。

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
  const maxTokens = opts.maxTokens ?? 4096
  const callModel = opts.callModel ?? defaultCallModel

  const windows = chunkTranscript(t, windowChars, overlapChars)
  const collected: unknown[] = []
  for (const window of windows) {
    const content = await callModel(buildPrompt(window), maxTokens)
    const parsed = content ? parseJsonArray(content) : null
    if (parsed) {
      collected.push(...parsed)
    } else {
      // 不再完全静默：至少留下一条可检索的服务端日志，方便定位丢题
      console.warn(`[qa-extract] 窗口抽取未得到合法 JSON（窗口字数 ${window.length}）`)
    }
  }
  return cleanQAs(collected)
}
