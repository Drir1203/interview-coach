import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { auth } from "@/auth"
import { syncInterviewTags } from "@/lib/interview-tags"

// 获取单条面试详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      company: true,
      questions: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
      recordings: true,
    },
  })

  if (!interview) {
    return Response.json({ error: "面试记录不存在" }, { status: 404 })
  }

  return Response.json(interview)
}

// 更新面试记录
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const session = await auth()
  const userId = session?.user?.id || "__anon__"

  const interview = await prisma.interview.findUnique({ where: { id } })
  if (!interview) {
    return Response.json({ error: "面试记录不存在" }, { status: 404 })
  }

  // 如果改了公司名，查找或创建公司
  let companyId = interview.companyId
  if (body.companyName) {
    let company = await prisma.company.findFirst({ where: { name: body.companyName } })
    if (!company) {
      company = await prisma.company.create({
        data: { name: body.companyName, industry: body.companyIndustry || null },
      })
    }
    companyId = company.id
  }

  // 更新问题：删除旧的，创建新的
  if (body.questions) {
    await prisma.interviewQuestion.deleteMany({ where: { interviewId: id } })
    await prisma.interviewQuestion.createMany({
      data: body.questions.map((q: any) => ({
        interviewId: id,
        order: q.order,
        questionText: q.questionText,
        userAnswer: q.userAnswer || null,
        userScore: q.userScore || null,
      })),
    })
  }

  const updated = await prisma.interview.update({
    where: { id },
    data: {
      companyId,
      position: body.position ?? undefined,
      roundType: body.roundType ?? undefined,
      date: body.date ? new Date(body.date) : undefined,
      userNotes: body.userNotes ?? undefined,
      result: body.result ?? undefined,
      status: body.status ?? undefined,
    },
    include: {
      company: true,
      questions: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  })

  // 同步标签
  if (body.tags !== undefined) {
    await syncInterviewTags(userId, id, body.tags)
  }

  return Response.json(updated)
}

// 删除面试记录
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const interview = await prisma.interview.findUnique({ where: { id } })
  if (!interview) {
    return Response.json({ error: "面试记录不存在" }, { status: 404 })
  }

  await prisma.interview.delete({ where: { id } })
  return Response.json({ success: true })
}
