import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { MAX_RESUME_FILE_SIZE, parsePdfToText } from "@/lib/resume"
import { AiQuotaError } from "@/lib/payment/ai-quota"
import { extractQuestionsFromText, MAX_BANK_RAW_CHARS } from "@/lib/question-bank"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 我的题库 CRUD：上传面试题文档（PDF/txt）→ AI 提取结构化题目 → 保存可复用。
// 文字 mock 与 AI 语音面试均可按题库顺序提问；题库属主 = 登录用户。

// GET /api/question-bank → { banks: [{id, name, questionCount, updatedAt}] }（按更新时间倒序）
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }
  try {
    const banks = await prisma.questionBank.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, questionCount: true, updatedAt: true },
    })
    return Response.json({ banks })
  } catch (err) {
    console.error("查询题库失败:", err)
    return Response.json({ error: "查询题库失败" }, { status: 500 })
  }
}

// POST multipart field "file"（.pdf / .txt）→ 提取题目并创建题库
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get("file") as File | null
  if (!file) {
    return Response.json({ error: "请选择面试题文档" }, { status: 400 })
  }
  if (file.size > MAX_RESUME_FILE_SIZE) {
    return Response.json({ error: "文件过大，请上传 5MB 以内的文档" }, { status: 413 })
  }

  const lowerName = file.name.toLowerCase()
  const ext = lowerName.endsWith(".pdf") ? "pdf" : lowerName.endsWith(".txt") ? "txt" : null
  if (!ext) {
    return Response.json({ error: "仅支持 PDF 或 txt 格式" }, { status: 400 })
  }

  // 解析文档 → 纯文本（PDF 复用简历解析链；解析失败返回用户可读错误）
  let rawText: string
  try {
    if (ext === "pdf") {
      const buffer = await file.arrayBuffer()
      rawText = await parsePdfToText(buffer)
    } else {
      rawText = await file.text()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "文档解析失败"
    return Response.json({ error: message }, { status: 400 })
  }

  if (!rawText.trim()) {
    return Response.json({ error: "文档内容为空" }, { status: 400 })
  }

  // AI 提取（内部只喂前 6000 字符，A5）；配额耗尽 → 429，其余 → 未能识别 400
  let questions
  try {
    questions = await extractQuestionsFromText(rawText.slice(0, MAX_BANK_RAW_CHARS), { userId })
  } catch (err) {
    if (err instanceof AiQuotaError) {
      return Response.json({ error: err.message, code: err.code }, { status: 429 })
    }
    throw err
  }
  if (questions.length === 0) {
    return Response.json({ error: "未能识别出题目，请确认文档含题干" }, { status: 400 })
  }

  const name = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 60) || "我的题库"
  const bank = await prisma.questionBank.create({
    data: {
      userId,
      name,
      rawText: rawText.slice(0, MAX_BANK_RAW_CHARS),
      questions: JSON.stringify(questions),
      questionCount: questions.length,
    },
  })

  return Response.json({ id: bank.id, name: bank.name, questionCount: bank.questionCount, questions })
}

// DELETE /api/question-bank?id=xxx —— 仅属主可删（deleteMany 带 userId 过滤）
export async function DELETE(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return Response.json({ error: "请先登录" }, { status: 401 })
  }
  const id = new URL(req.url).searchParams.get("id")
  if (!id) {
    return Response.json({ error: "缺少题库 id" }, { status: 400 })
  }
  const result = await prisma.questionBank.deleteMany({ where: { id, userId } })
  if (result.count === 0) {
    return Response.json({ error: "题库不存在" }, { status: 404 })
  }
  return Response.json({ ok: true })
}
