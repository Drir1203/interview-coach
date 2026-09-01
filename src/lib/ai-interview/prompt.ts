// AI 面试官提示词组装（阿里云 AI 面试 LLM 的 system prompt）。
// 注意：阿里云 LLM 人设上限 ≤3072 字符，组装后必须截断。
// 本函数是纯函数（可单测）；用户上下文由 buildUserContext 预先生成后传入。

import type { BankQuestion } from "@/lib/question-bank"

export interface InterviewerPromptInput {
  company: string
  position: string
  roundType?: string
  grill?: boolean
  userContext?: string
  resumeText?: string
  customQuestions?: BankQuestion[] // 自定义题库：按用户上传的题目顺序提问
}

export const MAX_INTERVIEWER_PROMPT_LENGTH = 3072

const ROUND_LABELS: Record<string, string> = {
  first: "首轮",
  follow: "追问",
  grill: "压力面（拷打）",
  final: "终面",
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return ""
  return s.length > max ? s.slice(0, max) + "…" : s
}

export function buildInterviewerPrompt(input: InterviewerPromptInput): string {
  const { company, position, grill = false } = input
  const roundLabel = ROUND_LABELS[input.roundType ?? "first"] ?? "首轮"

  const parts: string[] = [
    `你是一位专业、自然的 AI 面试官，正在为「${company}」招聘「${position}」进行${roundLabel}语音面试。`,
    "",
    "面试规则：",
    "- 一次只问一个问题，简短清晰，适合语音作答",
    "- 听完候选人回答后，若要点不清或想深挖，追问 1 个相关问题；否则进入下一题",
    "- 保持真人面试官的节奏与语气，不要机械、不要一口气抛多个问题",
    "- 全程用中文",
    "- 大约提问 5 个问题后结束面试；结束时必须说出「本次面试到此结束」，之后保持沉默",
  ]

  if (grill) {
    parts.push("", "压力面模式：针对候选人回答中的漏洞、夸大和矛盾点进行尖锐追问，像资深面试官拷打候选人，但保持专业。")
  }

  if (input.customQuestions && input.customQuestions.length > 0) {
    const rendered = input.customQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n")
    parts.push(
      "",
      "【指定题库】请严格按下列题目顺序逐一提问，可对关键回答做一次追问；不要跳过、不要自出题：",
      truncate(rendered, 1100)
    )
  }

  if (input.userContext) {
    parts.push("", "【候选人背景】", truncate(input.userContext, 1200))
  }
  if (input.resumeText) {
    parts.push("", "【候选人简历摘要】", truncate(input.resumeText, 1200))
  }

  return parts.join("\n").slice(0, MAX_INTERVIEWER_PROMPT_LENGTH)
}
