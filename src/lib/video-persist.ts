import prisma from "@/lib/db"
import type { PrismaClient } from "@/generated/prisma"

// AI 语音面试结果落库：把阿里云转写归档写入 Interview 表（type="video"、status="draft"），
// 打通「面试记录 → 复盘 → 能力画像 → 教练建议」闭环。纯函数部分可单测。

// ── 转写（面试官/候选人 逐行）→ 配对成逐题问答 ──
// 每条「面试官」行开新题；其后连续的「候选人」行合并为该题 answer（ASR 允许多轮）。
// 无「面试官」行 → 空数组（原始转写仍在 Interview.transcript 原样保留，不丢数据）。
const INTERVIEWER_RE = /^面试官[：:]\s*(.+)$/
const CANDIDATE_RE = /^候选人[：:]\s*(.+)$/

export function parseVideoTranscript(
  transcript: string
): { question: string; answer: string | null }[] {
  const pairs: { question: string; answer: string | null }[] = []
  let pendingQuestion: string | null = null
  const answers: string[] = []

  for (const rawLine of transcript.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue

    const qMatch = line.match(INTERVIEWER_RE)
    if (qMatch) {
      // 上一题封口（无回答的追问如实保留为 null answer）
      if (pendingQuestion !== null) {
        pairs.push({ question: pendingQuestion, answer: answers.length ? answers.join("\n") : null })
      }
      pendingQuestion = qMatch[1].trim()
      answers.length = 0
      continue
    }

    const aMatch = line.match(CANDIDATE_RE)
    if (aMatch) {
      // 候选人在面试官开题前说话（ASR 错位）→ 丢弃，不与任何题绑定
      if (pendingQuestion !== null) answers.push(aMatch[1].trim())
      continue
    }

    // 其它行（[杂音]、静音标记等）→ 丢弃
  }

  if (pendingQuestion !== null) {
    pairs.push({ question: pendingQuestion, answer: answers.length ? answers.join("\n") : null })
  }
  return pairs
}

export interface VideoInterviewMeta {
  company: string
  position: string
  roundType?: string
  transcript: string
  durationSec?: number | null
}

// 落库：find-or-create Company（按 name）→ create Interview（type="video"、status="draft"、原始转写 + 通话时长）
// → create questions（转写解析出的逐题 Q&A）。
// 不调 updateSkillProfile：draft 无 aiScore，画像由用户后续「AI 复盘」驱动（与手动面试 draft→复盘 一致）。
// 空转写 → 返回 null 不落库（通话失败/异常，用户可重开且不消耗场次）。
export async function persistVideoInterview(
  userId: string,
  meta: VideoInterviewMeta,
  db: PrismaClient = prisma
): Promise<string | null> {
  const transcript = (meta.transcript || "").trim()
  if (!transcript) return null

  const qas = parseVideoTranscript(transcript)

  let company = await db.company.findFirst({ where: { name: meta.company } })
  if (!company) {
    company = await db.company.create({ data: { name: meta.company } })
  }

  const interview = await db.interview.create({
    data: {
      userId,
      companyId: company.id,
      position: meta.position,
      roundType: meta.roundType ?? "first",
      type: "video",
      status: "draft",
      transcript,
      durationSec: meta.durationSec ?? null,
      ...(qas.length > 0
        ? {
            questions: {
              create: qas.map((qa, i) => ({
                order: i + 1,
                questionText: qa.question,
                userAnswer: qa.answer,
              })),
            },
          }
        : {}),
    },
  })

  return interview.id
}
