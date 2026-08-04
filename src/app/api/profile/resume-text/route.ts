import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

const MAX_RESUME_TEXT_LENGTH = 20000

// 小程序端：保存纯文本简历（替代 Web 端 PDF 上传，供 AI 复盘/押题作背景）
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || "default"

    const { resumeText } = await req.json()
    if (typeof resumeText !== "string" || resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return Response.json({ error: "简历文本无效或过长(限 2 万字)" }, { status: 400 })
    }

    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, resumeText, resumeUpdatedAt: new Date() },
      update: { resumeText, resumeFileName: null, resumeUpdatedAt: new Date() },
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error("保存简历失败:", err)
    return Response.json({ error: "保存失败" }, { status: 500 })
  }
}
