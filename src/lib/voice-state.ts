// 语音状态分析：根据转写文本与录音时长判断紧张/犹豫/语速
// 与 miniprogram/utils/voice.js 逻辑保持一致

export interface VoiceState {
  charCount: number // 转写字数（不含空白）
  durationSec: number // 录音时长
  speechRate: number // 字/秒
  fillerCount: number // 填充词数量
  fillerWords: string[] // 命中的填充词列表
  summary: string // 一句话状态总结
  score: number // 1-10 语音状态分
}

const FILLER_WORDS = [
  "嗯",
  "呃",
  "啊",
  "然后",
  "就是",
  "那个",
  "这个",
  "就是说",
  "反正",
  "其实",
  "的话",
  "对吧",
]

function countOccurrences(text: string, word: string): number {
  let count = 0
  let idx = text.indexOf(word)
  while (idx !== -1) {
    count++
    idx = text.indexOf(word, idx + word.length)
  }
  return count
}

export function analyzeVoiceState(
  transcript: string,
  durationSec: number
): VoiceState {
  const text = transcript || ""
  const charCount = text.replace(/\s+/g, "").length
  const duration = Math.max(1, durationSec || 0)
  const speechRate = charCount / duration

  let fillerCount = 0
  const fillerWords: string[] = []
  for (const word of FILLER_WORDS) {
    const n = countOccurrences(text, word)
    if (n > 0) {
      fillerCount += n
      fillerWords.push(word)
    }
  }

  const fillerDensity = charCount > 0 ? (fillerCount / charCount) * 100 : 0

  // 从 10 分起扣
  let score = 10
  if (fillerDensity > 8) score -= 3 // 填充词密度 >8%（每 10 字超 1 个）
  if (speechRate < 1.5) score -= 2 // 语速太慢/犹豫
  if (duration < 5 && charCount < 20) score -= 2 // 回答太短
  if (speechRate > 7) score -= 1 // 语速太快
  score = Math.max(1, Math.min(10, score))

  let summary: string
  if (fillerDensity > 8) {
    summary = `口头禅偏多（${fillerCount} 个），不够利落`
  } else if (speechRate < 1.5) {
    summary = "语速偏慢，可能紧张/犹豫"
  } else if (duration < 5 && charCount < 20) {
    summary = "回答偏短，信息量不足"
  } else {
    summary = "语速适中，表达较自然"
  }

  return {
    charCount,
    durationSec: Math.round(duration),
    speechRate,
    fillerCount,
    fillerWords,
    summary,
    score,
  }
}
