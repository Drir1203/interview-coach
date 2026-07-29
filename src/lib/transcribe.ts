// 录音转写 + QA 提取

export interface QAPair {
  questionText: string
  userAnswer: string
}

export async function transcribeAudio(
  audioBlob: Blob,
  duration: number
): Promise<{ transcript: string; qas: QAPair[] }> {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY

  // 无 API Key → 平台尚未配置语音转写
  if (!apiKey) {
    throw new Error("语音转写服务暂未配置，请手动录入面试问题")
  }

  // 优先使用阿里云 Qwen3-ASR-Flash（国内平台）
  if (process.env.DASHSCOPE_API_KEY) {
    const transcript = await transcribeWithQwenASR(audioBlob, apiKey)
    const qas = await extractQAFromTranscript(transcript)
    return { transcript, qas }
  }

  // 回退到 Whisper API
  const whisperResult = await transcribeWithWhisper(audioBlob, duration, apiKey)
  return whisperResult
}

async function transcribeWithQwenASR(audioBlob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData()
  formData.append("file", audioBlob, "recording.webm")
  formData.append("model", "qwen3-asr-flash")

  const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/audio/transcription/asr", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`语音转写失败: ${error}`)
  }

  const data = await response.json()
  return data?.output?.text || data?.text || data?.result?.text || ""
}

async function transcribeWithWhisper(audioBlob: Blob, duration: number, apiKey: string): Promise<{ transcript: string; qas: QAPair[] }> {
  const formData = new FormData()
  formData.append("file", audioBlob, "recording.webm")
  formData.append("model", "whisper-1")
  formData.append("language", "zh")

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`语音转写失败: ${error}`)
  }

  const data = await response.json()
  const transcript = data.text || ""
  const qas = await extractQAFromTranscript(transcript)
  return { transcript, qas }
}

async function extractQAFromTranscript(transcript: string): Promise<QAPair[]> {
  const aiKey = process.env.ANTHROPIC_API_KEY
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  const model = process.env.AI_MODEL || "claude-sonnet-4-20250514"

  const prompt = `你是一个面试记录助手。请从以下面试对话转写中，提取面试官的问题和候选人的回答。

返回 JSON 数组，格式：
[
  { "questionText": "问题内容", "userAnswer": "回答内容" }
]

如果某段对话无法清晰分离出 QA 对，请忽略它。

转写内容：
${transcript}`

  if (aiKey) {
    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.content?.[0]?.text
        if (content) {
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) return JSON.parse(jsonMatch[0]) as QAPair[]
        }
      }
    } catch {
      // fallback to simple extraction
    }
  }

  return simpleExtractQA(transcript)
}

function simpleExtractQA(transcript: string): QAPair[] {
  const lines = transcript.split("\n")
  const qas: QAPair[] = []
  let current: QAPair | null = null

  for (const line of lines) {
    if (line.includes("面试官：") || line.includes("面试官:")) {
      if (current?.questionText) qas.push(current)
      current = { questionText: line.replace(/面试官[：:]\s*/, ""), userAnswer: "" }
    } else if (line.includes("我：") || line.includes("我:") || line.includes("候选人：")) {
      if (current) {
        current.userAnswer = (current.userAnswer + line.replace(/(我|候选人)[：:]\s*/, "")).trim()
      }
    }
  }

  if (current?.questionText) qas.push(current)
  return qas
}
