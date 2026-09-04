// 录音转写（ASR）
// 浏览器端用 FFmpeg.wasm 压缩后，服务端 base64 → DashScope ASR。
// 转写与「问答抽取」解耦：/api/transcribe 默认顺手抽（兼容小程序/单次上传），
// Web 端长录音分段场景传 extractQa=0 只取转写，拼完整稿后走 /api/transcribe/qa
// 统一做带上下文的整稿抽取（见 qa-extract.ts）。

import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"
import os from "os"
import path from "path"
import ffmpegStatic from "ffmpeg-static"
import { extractQAsFromTranscript, type QAPair } from "./qa-extract"

const execFileP = promisify(execFile)

export interface TranscribeOptions {
  /** 是否在单次转写后即抽取问答对（默认 true）。分段长录音应传 false 以省去碎片抽取。 */
  extractQa?: boolean
}

// Web MediaRecorder 输出 webm，DashScope ASR 可能不认 → 服务端转 mp3
async function convertWebmToMp3(buffer: Buffer): Promise<Buffer> {
  const inFile = path.join(os.tmpdir(), `audio-${Date.now()}.webm`)
  const outFile = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`)
  fs.writeFileSync(inFile, buffer)
  try {
    await execFileP(ffmpegStatic!, ["-y", "-i", inFile, "-codec:a", "libmp3lame", "-b:a", "64k", outFile])
    return fs.readFileSync(outFile)
  } finally {
    fs.unlinkSync(inFile)
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile)
  }
}

export async function transcribeAudio(
  audioBlob: Blob,
  duration: number,
  mimeType?: string,
  opts: TranscribeOptions = {}
): Promise<{ transcript: string; qas: QAPair[] }> {
  const apiKey = process.env.DASHSCOPE_API_KEY

  if (!apiKey) {
    throw new Error("语音转写服务暂未配置，请手动录入面试问题")
  }

  // base64，按实际上传格式设置 mime（iOS 录音是 aac，不再硬编码 mp3）
  let buffer: Buffer = Buffer.from(await audioBlob.arrayBuffer())
  let audioMime = mimeType || audioBlob.type || "audio/mp3"
  // Web 录音是 webm → 转 mp3（DashScope 兼容性）
  const isWebm =
    audioMime.includes("webm") ||
    (buffer.length > 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3)
  if (isWebm) {
    try {
      buffer = Buffer.from(await convertWebmToMp3(buffer))
      audioMime = "audio/mp3"
    } catch (e) {
      // 转换失败则用原格式，让 DashScope 尽力而为
      console.error("webm 转 mp3 失败:", e)
    }
  }
  const base64 = buffer.toString("base64")
  const dataUri = `data:${audioMime};base64,${base64}`

  // DashScope chat/completions
  const response = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "qwen3-asr-flash",
        messages: [{
          role: "user",
          content: [{ type: "input_audio", input_audio: { data: dataUri } }],
        }],
        stream: false,
        asr_options: { enable_itn: false },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`语音转写失败: ${error}`)
  }

  const data = await response.json()
  const transcript: string = data?.choices?.[0]?.message?.content || ""

  // 默认顺手在整份（本次）转写上抽问答；extractQa=false 时只返回转写文本
  const qas = opts.extractQa === false ? [] : await extractQAsFromTranscript(transcript)
  return { transcript, qas }
}
