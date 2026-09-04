import { NextRequest } from "next/server"
import { extractQAsFromTranscript } from "@/lib/qa-extract"

// 完整稿问答抽取：收一整段转写文本（Web 端为多段 60s 转写拼接而成），
// 在带上下文的完整对话上抽取「面试官提问 → 我的回答」，解决逐 60s 碎片抽取丢题/空题。
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const transcript = typeof body?.transcript === "string" ? body.transcript : ""
    if (!transcript.trim()) {
      return Response.json({ error: "transcript 不能为空" }, { status: 400 })
    }

    const qas = await extractQAsFromTranscript(transcript)

    return Response.json({ qas })
  } catch (err) {
    console.error("整稿问答抽取失败:", err)
    return Response.json(
      { error: err instanceof Error ? err.message : "问答抽取失败，请稍后重试" },
      { status: 500 }
    )
  }
}
