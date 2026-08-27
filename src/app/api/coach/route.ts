import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { coachChat } from "@/lib/ai-coach"
import { AiQuotaError } from "@/lib/payment/ai-quota"
import prisma from "@/lib/db"

interface RawMsg {
  role?: unknown
  content?: unknown
}

interface Attachment {
  name?: unknown
  content?: unknown
}

// POST /api/coach - AI 教练对话(持久化 + 可选附件)
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || "__anon__"

  let body: { messages?: unknown[]; conversationId?: unknown; attachment?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "缺少对话内容" }, { status: 400 })
  }

  // 只保留 user/assistant 消息,防止注入 role 伪造;截断超长内容
  let clean = (messages as RawMsg[])
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, 4000) }))

  if (clean.length === 0) {
    return Response.json({ error: "对话内容无效" }, { status: 400 })
  }

  // 标题取第一条用户消息前 20 字(在拼接附件之前计算,避免带上附件标记)
  const firstUserText = (clean.find((m) => m.role === "user")?.content || "").slice(0, 20)

  // 附件拼接到最后一条用户消息: content + "\n\n[附件: name]\n" + content
  const attachment = (body?.attachment || null) as Attachment | null
  if (
    attachment &&
    typeof attachment.name === "string" &&
    typeof attachment.content === "string" &&
    attachment.name.trim() &&
    attachment.content
  ) {
    const lastUserIdx = clean.reduce((acc, m, i) => (m.role === "user" ? i : acc), -1)
    if (lastUserIdx >= 0) {
      const merged = `${clean[lastUserIdx].content}\n\n[附件: ${attachment.name.trim()}]\n${attachment.content}`
      clean = clean.map((m, i) => (i === lastUserIdx ? { ...m, content: merged.slice(0, 4000) } : m))
    }
  }

  const rawConversationId =
    typeof body?.conversationId === "string" && body.conversationId.trim() ? body.conversationId.trim() : ""

  try {
    // 1. 确定/创建对话
    let conversationId: string
    if (rawConversationId) {
      const existing = await prisma.coachConversation.findUnique({ where: { id: rawConversationId } })
      if (!existing || existing.userId !== userId) {
        return Response.json({ error: "对话不存在" }, { status: 404 })
      }
      conversationId = existing.id
    } else {
      const created = await prisma.coachConversation.create({
        data: { userId, title: firstUserText || "新对话" },
      })
      conversationId = created.id
    }

    // 2. 持久化整段对话(先删旧再重建,保证与发送内容一致)
    await prisma.coachMessage.deleteMany({ where: { conversationId } })
    await prisma.coachMessage.createMany({
      data: clean.map((m) => ({ conversationId, role: m.role, content: m.content })),
    })

    // 3. 调用教练(只取最近 20 条,持久化不影响调用)
    const reply = await coachChat(userId, clean.slice(-20))

    // 4. 持久化 assistant 回复
    await prisma.coachMessage.create({
      data: { conversationId, role: "assistant", content: reply },
    })

    // 5. 标题若仍为"新对话"则更新为第一条用户消息前 20 字;并刷新 updatedAt
    const current = await prisma.coachConversation.findUnique({ where: { id: conversationId } })
    const updateData: { title?: string; updatedAt: Date } = { updatedAt: new Date() }
    if (firstUserText && current?.title === "新对话") {
      updateData.title = firstUserText
    }
    const conversation = await prisma.coachConversation.update({
      where: { id: conversationId },
      data: updateData,
    })

    return Response.json({ reply, conversationId: conversation.id })
  } catch (err) {
    if (err instanceof AiQuotaError) {
      return Response.json({ error: err.message }, { status: 429 })
    }
    console.error("AI 教练调用失败:", err)
    return Response.json({ error: "教练暂时开小差了,请稍后再试" }, { status: 500 })
  }
}
