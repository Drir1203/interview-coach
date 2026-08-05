import { NextRequest } from "next/server"
import prisma from "@/lib/db"

const VALID_ROUND = ["first", "second", "third", "final", "hr", "written", "other"]

// GET /api/experiences?company=字节跳动&position=前端 - 查询面经库
export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get("company")?.trim()
  const position = req.nextUrl.searchParams.get("position")?.trim()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50", 10) || 50, 100)

  const experiences = await prisma.interviewExperience.findMany({
    where: {
      ...(company ? { company } : {}),
      ...(position ? { position } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return Response.json(experiences)
}

// POST /api/experiences - 匿名贡献真实面试题（脱敏）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const company = typeof body.company === "string" ? body.company.trim().slice(0, 60) : ""
    const position = typeof body.position === "string" ? body.position.trim().slice(0, 60) : ""
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : ""
    if (!company || !position || !question) {
      return Response.json({ error: "公司、岗位、题目必填" }, { status: 400 })
    }

    const experience = await prisma.interviewExperience.create({
      data: {
        company,
        position,
        round: VALID_ROUND.includes(body.round) ? body.round : "other",
        question,
        answer: typeof body.answer === "string" && body.answer.trim()
          ? body.answer.trim().slice(0, 2000)
          : null,
      },
    })

    return Response.json(experience, { status: 201 })
  } catch (err) {
    console.error("贡献面经失败:", err)
    return Response.json({ error: "提交失败" }, { status: 500 })
  }
}
