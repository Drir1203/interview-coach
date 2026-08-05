// 录音转写 + QA 提取
// 浏览器端用 FFmpeg.wasm 压缩后，服务端 base64 → DashScope

import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"
import os from "os"
import path from "path"
import ffmpegStatic from "ffmpeg-static"

const execFileP = promisify(execFile)

export interface QAPair {
  questionText: string
  userAnswer: string
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
  mimeType?: string
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
  const transcript = data?.choices?.[0]?.message?.content || ""

  const qas = await extractQAFromTranscript(transcript)
  return { transcript, qas }
}

async function extractQAFromTranscript(transcript: string): Promise<QAPair[]> {
  if (!transcript || transcript.trim().length < 20) return []

  const keys = [
    { key: process.env.DEEPSEEK_API_KEY, url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    { key: process.env.DASHSCOPE_API_KEY, url: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-max" },
  ]

  const prompt = `从以下面试对话中提取问答对，返回 JSON [{"questionText":"问题","userAnswer":"回答"}]，无法分离返回[]。\n\n${transcript}`

  for (const { key, url, model } of keys) {
    if (!key) continue
    try {
      const res = await fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 2048 }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data?.choices?.[0]?.message?.content
        if (content) {
          const m = content.match(/\[[\s\S]*?\]/)
          if (m) return JSON.parse(m[0]) as QAPair[]
        }
      }
    } catch {}
  }
  return []
}
