import { NextRequest } from "next/server"
import { transcribeAudio } from "@/lib/transcribe"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const audioFile = formData.get("audio") as File | null
  const duration = parseInt((formData.get("duration") as string) || "0", 10)
  // 长录音分段场景：每段只取转写文本，问答统一在拼完整稿后由 /transcribe/qa 抽取
  const extractQa = formData.get("extractQa") !== "0"

  if (!audioFile) {
    return Response.json({ error: "请上传录音文件" }, { status: 400 })
  }

  try {
    const buffer = await audioFile.arrayBuffer()
    const blob = new Blob([buffer], { type: audioFile.type })

    const result = await transcribeAudio(blob, duration, audioFile.type, { extractQa })

    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "转写失败" },
      { status: 500 }
    )
  }
}
