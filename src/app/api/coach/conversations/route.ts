import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { Prisma } from "@/generated/prisma"

function getUserId(session: { user?: { id?: string } | null } | null): string {
  return session?.user?.id || "default"
}

// GET /api/coach/conversations?q=关键词&limit=50 - 对话列表/搜索
export async function GET(req: NextRequest) {
  const userId = getUserId(await auth())

  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").trim()
  const rawLimit = parseInt(url.searchParams.get("limit") || "50", 10)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50

  const where: Prisma.CoachConversationWhereInput = { userId }
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { messages: { some: { content: { contains: q } } } },
    ]
  }

  const conversations = await prisma.coachConversation.findMany({
    where,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })

  return Response.json(
    conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      lastMessage: c.messages[0]
        ? { role: c.messages[0].role, content: c.messages[0].content, createdAt: c.messages[0].createdAt }
        : null,
    }))
  )
}

// POST /api/coach/conversations - 创建空对话
export async function POST(req: Request) {
  const userId = getUserId(await auth())

  let body: { title?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // 无 body 或格式错误时使用默认标题
  }

  const rawTitle = typeof body?.title === "string" ? body.title.trim() : ""
  const title = rawTitle ? rawTitle.slice(0, 50) : "新对话"

  const conversation = await prisma.coachConversation.create({
    data: { userId, title },
  })

  return Response.json(conversation, { status: 201 })
}
