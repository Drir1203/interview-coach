"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Send, Loader2, User, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "你好,我是你的 AI 面试教练 👋 我了解你的面试记录、能力画像和薄弱项。\n\n你可以问我,比如:\n· 根据我的薄弱项,我今天该练什么?\n· 如何用 STAR 法则回答行为面试题?\n· 帮我模拟一下某类面试问题。",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || loading) return
    setError("")
    setInput("")

    const updated: Message[] = [...messages, { role: "user", content }]
    setMessages(updated)
    setLoading(true)

    try {
      const res = await fetch("/interview/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "教练调用失败")
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : "教练暂时开小差了,请稍后再试")
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉,我暂时无法回复,请稍后再试。" }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="size-6 text-primary" />
          AI 面试教练
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          基于你的面试记录和薄弱项,给你一对一的个性化辅导
        </p>
      </div>

      <Card className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col">
        <CardHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">我的教练</CardTitle>
              <CardDescription className="text-xs">记得你的每一场面试</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  m.role === "assistant" ? "bg-primary/10" : "bg-muted"
                )}
              >
                {m.role === "assistant" ? (
                  <Bot className="size-4 text-primary" />
                ) : (
                  <User className="size-4 text-muted-foreground" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  m.role === "assistant"
                    ? "bg-muted/60"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                教练思考中…
              </div>
            </div>
          )}

          {error && <p className="text-center text-xs text-destructive">{error}</p>}
          <div ref={bottomRef} />
        </CardContent>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="向教练提问…(Enter 发送,Shift+Enter 换行)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={1}
            />
            <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
