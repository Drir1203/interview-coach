import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { syncInterviewTags } from "@/lib/interview-tags"

function getUserId(session: any): string {
  return session?.user?.id || "default"
}

// 获取面试列表
export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = getUserId(session)

  const interviews = await prisma.interview.findMany({
    where: { userId },
    include: {
      company: true,
      tags: { include: { tag: true } },
      _count: { select: { questions: true } },
    },
    orderBy: { date: "desc" },
  })

  return Response.json(interviews)
}

// 创建面试记录
export async function POST(req: Request) {
  const session = await auth()
  const userId = getUserId(session)
  const body = await req.json()

  let company = await prisma.company.findFirst({
    where: { name: body.companyName },
  })

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: body.companyName,
        industry: body.companyIndustry || null,
      },
    })
  }

  const interview = await prisma.interview.create({
    data: {
      userId,
      companyId: company.id,
      position: body.position,
      roundType: body.roundType,
      date: body.date ? new Date(body.date) : new Date(),
      userNotes: body.userNotes || null,
      status: "draft",
      questions: body.questions?.length
        ? {
            create: body.questions.map((q: any) => ({
              order: q.order,
              questionText: q.questionText,
              userAnswer: q.userAnswer || null,
              userScore: q.userScore || null,
            })),
          }
        : undefined,
    },
    include: {
      company: true,
      questions: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  })

  // 持久化标签
  await syncInterviewTags(userId, interview.id, body.tags)

  return Response.json(interview, { status: 201 })
}
