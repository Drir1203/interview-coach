import { NextRequest } from "next/server"
import { transcribeAudio } from "@/lib/transcribe"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const audioFile = formData.get("audio") as File | null
  const duration = parseInt((formData.get("duration") as string) || "0", 10)

  if (!audioFile) {
    return Response.json({ error: "请上传录音文件" }, { status: 400 })
  }

  try {
    const buffer = await audioFile.arrayBuffer()
    const blob = new Blob([buffer], { type: audioFile.type })

    const result = await transcribeAudio(blob, duration, audioFile.type)

    return Response.json(result)
  } catch (err: any) {
    return Response.json({ error: err.message || "转写失败" }, { status: 500 })
  }
}
