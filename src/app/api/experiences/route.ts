import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { auth } from "@/auth"

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
// 支持单条 { company, position, round, question, answer } 与批量 { items: [...] }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || "default"
    const body = await req.json()

    // 批量提交（来自 AI 草稿确认）
    if (Array.isArray(body.items)) {
      const items = body.items
        .filter(
          (it: any) =>
            it &&
            typeof it.company === "string" && it.company.trim() &&
            typeof it.position === "string" && it.position.trim() &&
            typeof it.question === "string" && it.question.trim()
        )
        .map((it: any) => ({
          userId,
          sourceInterviewId: typeof it.sourceInterviewId === "string" ? it.sourceInterviewId : null,
          company: it.company.trim().slice(0, 60),
          position: it.position.trim().slice(0, 60),
          round: VALID_ROUND.includes(it.round) ? it.round : "other",
          question: it.question.trim().slice(0, 500),
          answer:
            typeof it.answer === "string" && it.answer.trim()
              ? it.answer.trim().slice(0, 2000)
              : null,
        }))
      if (items.length === 0) {
        return Response.json({ error: "没有可提交的面经" }, { status: 400 })
      }
      const created = await prisma.interviewExperience.createMany({ data: items })
      return Response.json({ count: created.count }, { status: 201 })
    }

    // 单条提交（手动填写）
    const company = typeof body.company === "string" ? body.company.trim().slice(0, 60) : ""
    const position = typeof body.position === "string" ? body.position.trim().slice(0, 60) : ""
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : ""
    if (!company || !position || !question) {
      return Response.json({ error: "公司、岗位、题目必填" }, { status: 400 })
    }

    const experience = await prisma.interviewExperience.create({
      data: {
        userId,
        sourceInterviewId: typeof body.sourceInterviewId === "string" ? body.sourceInterviewId : null,
        company,
        position,
        round: VALID_ROUND.includes(body.round) ? body.round : "other",
        question,
        answer:
          typeof body.answer === "string" && body.answer.trim()
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
