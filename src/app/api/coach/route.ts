import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { coachChat } from "@/lib/ai-coach"

// POST /api/coach - AI 教练对话
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || "default"

  let body: { messages?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "缺少对话内容" }, { status: 400 })
  }

  interface RawMsg {
    role?: unknown
    content?: unknown
  }
  // 只保留 user/assistant 消息,防止注入 role 伪造
  const clean = (messages as RawMsg[])
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, 4000) }))
    .slice(-20) // 最多保留最近 20 条,控制上下文

  if (clean.length === 0) {
    return Response.json({ error: "对话内容无效" }, { status: 400 })
  }

  try {
    const reply = await coachChat(userId, clean)
    return Response.json({ reply })
  } catch (err) {
    console.error("AI 教练调用失败:", err)
    return Response.json({ error: "教练暂时开小差了,请稍后再试" }, { status: 500 })
  }
}
