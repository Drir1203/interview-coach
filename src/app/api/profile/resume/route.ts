import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { MAX_RESUME_FILE_SIZE, parsePdfToText } from "@/lib/resume"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getUserId(session: { user?: { id?: string } | null } | null): string {
  return session?.user?.id || "default"
}

const MAX_RESUME_TEXT_LENGTH = 20000

interface ResumePayload {
  resumeText: string | null
  resumeFileName: string | null
  resumeUpdatedAt: Date | null
}

// 查询当前用户的简历
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserId(session)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { resumeText: true, resumeFileName: true, resumeUpdatedAt: true },
    })

    return Response.json({
      resumeText: user?.resumeText ?? null,
      resumeFileName: user?.resumeFileName ?? null,
      resumeUpdatedAt: user?.resumeUpdatedAt ?? null,
    })
  } catch (err) {
    console.error("查询简历失败:", err)
    return Response.json({ error: "查询简历失败" }, { status: 500 })
  }
}

// 上传 PDF 简历并解析为文本
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserId(session)

    const formData = await req.formData()
    const file = formData.get("resume") as File | null

    if (!file) {
      return Response.json({ error: "请选择 PDF 简历文件" }, { status: 400 })
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      return Response.json({ error: "仅支持 PDF 格式" }, { status: 400 })
    }

    if (file.size > MAX_RESUME_FILE_SIZE) {
      return Response.json({ error: "文件过大，请上传 5MB 以内的 PDF" }, { status: 413 })
    }

    const buffer = await file.arrayBuffer()
    const resumeText = await parsePdfToText(buffer)

    const updatedAt = new Date()
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        resumeText,
        resumeFileName: file.name,
        resumeUpdatedAt: updatedAt,
      },
      update: {
        resumeText,
        resumeFileName: file.name,
        resumeUpdatedAt: updatedAt,
      },
    })

    const payload: ResumePayload = { resumeText, resumeFileName: file.name, resumeUpdatedAt: updatedAt }
    return Response.json(payload)
  } catch (err) {
    console.error("上传简历失败:", err)
    const message = err instanceof Error ? err.message : "上传简历失败，请稍后重试"
    return Response.json({ error: message }, { status: 400 })
  }
}

// 编辑保存解析后的简历文本（空字符串 = 清除简历）
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserId(session)

    const body = await req.json()
    const { resumeText } = body

    if (typeof resumeText !== "string") {
      return Response.json({ error: "resumeText 必须为字符串" }, { status: 400 })
    }

    const trimmed = resumeText.trim()
    if (trimmed.length > MAX_RESUME_TEXT_LENGTH) {
      return Response.json(
        { error: `简历文本过长，最多 ${MAX_RESUME_TEXT_LENGTH} 字` },
        { status: 400 }
      )
    }

    const updatedAt = new Date()
    const data = trimmed
      ? { resumeText: trimmed, resumeUpdatedAt: updatedAt }
      : { resumeText: null, resumeFileName: null, resumeUpdatedAt: null }

    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, ...data },
      update: data,
    })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { resumeText: true, resumeFileName: true, resumeUpdatedAt: true },
    })

    return Response.json({
      resumeText: user?.resumeText ?? null,
      resumeFileName: user?.resumeFileName ?? null,
      resumeUpdatedAt: user?.resumeUpdatedAt ?? null,
    })
  } catch (err) {
    console.error("保存简历失败:", err)
    return Response.json({ error: "保存简历失败，请稍后重试" }, { status: 500 })
  }
}
