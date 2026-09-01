// 我的题库：用户上传面试题文档 → AI 提取结构化题目 → 供自定义模拟面试
// 纯逻辑层（不 import prisma），便于单测；路由负责鉴权/配额/落库。

import { chatWithFallback } from "@/lib/ai-coach"
import { AiQuotaError } from "@/lib/payment/ai-quota"

export interface BankQuestion {
  question: string
  answer?: string // 文档自带的参考答案（对比反馈用，≠ 用户作答，A1）
}

export const MAX_BANK_QUESTIONS = 50 // 单题库题目上限
export const MAX_BANK_RAW_CHARS = 50_000 // 落库原始文本上限
export const MAX_BANK_EXTRACT_CHARS = 6000 // 提取输入上限（A5：免费单请求 8000 token 护栏）

const EXTRACT_SYSTEM_PROMPT = `你是一个面试题提取助手。用户会提供一份面试题文档的文本内容。
请从中提取所有面试题目，输出为 JSON 数组，每项形如 {"question":"题干","answer":"参考答案(如有)"}。
要求：
1. 只提取真正的面试题目（问句或明确的提问句），忽略说明性文字、页码、标题、目录
2. question 必须是完整、清晰的题干原文，不要改写
3. answer 可选：文档中若附带参考答案/评分要点则提取，否则省略该字段
4. 只输出 JSON 数组本身，不要任何解释、markdown 围栏或前后缀`

// 从 AI 返回文本中提取 JSON 数组（健壮降级：剥离 markdown 围栏/前后杂质，镜像 parseSummaryJson）
export function parseBankJsonArray(raw: string): unknown[] | null {
  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const s = (fence ? fence[1] : raw).trim()
    const start = s.indexOf("[")
    const end = s.lastIndexOf("]")
    if (start === -1 || end <= start) return null
    const parsed = JSON.parse(s.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

// 规范化提取结果：非数组→[]；题干非空字符串且长度≥4；去重；answer 仅保留非空；上限截断
export function normalizeQuestions(raw: unknown, max = MAX_BANK_QUESTIONS): BankQuestion[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: BankQuestion[] = []
  for (const item of raw) {
    if (out.length >= max) break
    const q = (item as { question?: unknown })?.question
    if (typeof q !== "string" || q.trim().length < 4) continue
    const key = q.trim()
    if (seen.has(key)) continue
    seen.add(key)
    const answer = (item as { answer?: unknown })?.answer
    out.push({
      question: key,
      ...(typeof answer === "string" && answer.trim() ? { answer: answer.trim() } : {}),
    })
  }
  return out
}

// AI 提取入口：空文本前短路（确定性 400）；只喂前 6000 字符；
// AiQuotaError 重抛（路由映射 429）；其他异常吞掉返回 []（路由映射 400「未能识别」）。
export async function extractQuestionsFromText(
  rawText: string,
  opts: { userId: string }
): Promise<BankQuestion[]> {
  if (!rawText || rawText.trim().length === 0) return []
  const input = rawText.slice(0, MAX_BANK_EXTRACT_CHARS)
  let content: string
  try {
    content = await chatWithFallback(
      EXTRACT_SYSTEM_PROMPT,
      [{ role: "user", content: `以下是面试题文档的文本内容，请提取所有面试题：\n\n${input}` }],
      () => "[]",
      { userId: opts.userId, feature: "question-bank" }
    )
  } catch (err) {
    if (err instanceof AiQuotaError) throw err
    console.error("题库 AI 提取失败（返回空）:", err)
    return []
  }
  return normalizeQuestions(parseBankJsonArray(content))
}
