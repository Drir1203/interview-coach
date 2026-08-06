import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

function getUserId(session: { user?: { id?: string } | null } | null): string {
  return session?.user?.id || "__anon__"
}

// GET /api/coach/conversations/:id - 对话详情(含全部消息,按时间升序)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = getUserId(await auth())

  const conversation = await prisma.coachConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })

  if (!conversation || conversation.userId !== userId) {
    return Response.json({ error: "对话不存在" }, { status: 404 })
  }

  return Response.json(conversation)
}

// PUT /api/coach/conversations/:id - 重命名标题
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = getUserId(await auth())

  let body: { title?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const title = typeof body?.title === "string" ? body.title.trim() : ""
  if (!title) {
    return Response.json({ error: "标题不能为空" }, { status: 400 })
  }

  const existing = await prisma.coachConversation.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    return Response.json({ error: "对话不存在" }, { status: 404 })
  }

  const updated = await prisma.coachConversation.update({
    where: { id },
    data: { title: title.slice(0, 50) },
  })

  return Response.json(updated)
}

// DELETE /api/coach/conversations/:id - 删除对话(消息级联删除)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = getUserId(await auth())

  const existing = await prisma.coachConversation.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    return Response.json({ error: "对话不存在" }, { status: 404 })
  }

  await prisma.coachConversation.delete({ where: { id } })
  return Response.json({ success: true })
}
