// 录音转写 + QA 提取

export interface QAPair {
  questionText: string
  userAnswer: string
}

// Mock 转写
function mockTranscribe(audioDuration: number): { transcript: string; qas: QAPair[] } {
  const mockTranscripts = [
    "面试官：请先做个自我介绍。\n我：我是XX大学毕业，有3年后端开发经验...\n面试官：你为什么想来我们公司？\n我：因为贵公司在技术栈和业务方向上都很匹配...\n面试官：讲一个你最有成就感的项目。\n我：我在上一家公司负责了一个高并发系统的重构...",
    "面试官：介绍一下你最近做的项目。\n我：最近在做的是一个电商订单系统...\n面试官：你们系统是怎么处理高并发的？\n我：主要用了消息队列和缓存...\n面试官：如果让你设计一个秒杀系统，你怎么做？\n我：首先从流量入口做限流...",
  ]

  const idx = Math.floor(Math.random() * mockTranscripts.length)
  const transcript = mockTranscripts[idx]

  // 模拟提取 QA
  const qas: QAPair[] = [
    {
      questionText: "请做自我介绍",
      userAnswer: "我是XX大学计算机专业毕业，有3年后端开发经验，熟悉Java和Go语言，参与过多个高并发项目的开发。",
    },
    {
      questionText: "你为什么想来我们公司？",
      userAnswer: "因为贵公司在技术栈上使用Java和微服务架构，和我的技术背景很匹配，而且业务发展方向我也很看好。",
    },
    {
      questionText: "讲一个你最有成就感的项目",
      userAnswer: "我在上一家公司负责了一个高并发系统的重构，将系统从单机架构升级为分布式架构，支持了QPS从1000提升到50000。",
    },
  ]

  return { transcript, qas }
}

export async function transcribeAudio(
  audioBlob: Blob,
  duration: number,
  apiKey?: string
): Promise<{ transcript: string; qas: QAPair[] }> {
  // Mock 模式
  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 2000))
    return mockTranscribe(duration)
  }

  // 调用 Whisper API
  const formData = new FormData()
  formData.append("file", audioBlob, "recording.webm")
  formData.append("model", "whisper-1")
  formData.append("language", "zh")

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Whisper API 调用失败: ${error}`)
  }

  const data = await response.json()
  const transcript = data.text || ""

  // 用 Claude 从转写中提取 QA 对
  const qas = await extractQAFromTranscript(transcript, apiKey)

  return { transcript, qas }
}

async function extractQAFromTranscript(
  transcript: string,
  apiKey: string
): Promise<QAPair[]> {
  const prompt = `你是一个面试记录助手。请从以下面试对话转写中，提取面试官的问题和候选人的回答。

返回 JSON 数组，格式：
[
  { "questionText": "问题内容", "userAnswer": "回答内容" }
]

如果某段对话无法清晰分离出 QA 对，请忽略它。

转写内容：
${transcript}`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    // 失败时简单解析
    return simpleExtractQA(transcript)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text

  if (!content) return simpleExtractQA(transcript)

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as QAPair[]
    }
  } catch {
    // fallback
  }

  return simpleExtractQA(transcript)
}

function simpleExtractQA(transcript: string): QAPair[] {
  const lines = transcript.split("\n")
  const qas: QAPair[] = []
  let current: QAPair | null = null

  for (const line of lines) {
    if (line.includes("面试官：") || line.includes("面试官:")) {
      if (current && current.questionText) {
        qas.push(current)
      }
      current = {
        questionText: line.replace(/面试官[：:]\s*/, ""),
        userAnswer: "",
      }
    } else if (line.includes("我：") || line.includes("我:") || line.includes("候选人：")) {
      if (current) {
        current.userAnswer = (current.userAnswer + line.replace(/(我|候选人)[：:]\s*/, "")).trim()
      }
    }
  }

  if (current && current.questionText) {
    qas.push(current)
  }

  return qas
}
