"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Bot,
  Send,
  Loader2,
  User,
  Sparkles,
  Plus,
  Search,
  Paperclip,
  Trash2,
  Pencil,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/layout/PageHeader"
import { Markdown } from "@/components/ui/markdown"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn, apiUrl, formatDateTime } from "@/lib/utils"

interface ChatMessage {
  id?: string
  role: "user" | "assistant"
  content: string
}

interface ConversationItem {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage?: { role: string; content: string; createdAt: string } | null
}

interface Attachment {
  name: string
  content: string
}

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "你好,我是你的 AI 面试教练 👋 我了解你的面试记录、能力画像和薄弱项。\n\n你可以问我,比如:\n· 根据我的薄弱项,我今天该练什么?\n· 如何用 STAR 法则回答行为面试题?\n· 帮我模拟一下某类面试问题。",
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "pdf", "json", "js", "ts", "tsx", "jsx",
  "css", "html", "htm", "xml", "yaml", "yml", "csv", "sql",
  "py", "java", "go", "rb", "php", "c", "cpp", "h", "hpp",
  "sh", "bash", "ps1", "ini", "conf", "log", "env", "toml", "cfg",
])

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
  }
  return formatDateTime(d)
}

export default function CoachPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [search, setSearch] = useState("")
  const [loadingList, setLoadingList] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [renaming, setRenaming] = useState<ConversationItem | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRenderRef = useRef(true)

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // 加载/搜索对话列表(实时搜索带 300ms 防抖)
  const loadConversations = useCallback(async (q: string) => {
    setLoadingList(true)
    try {
      const res = await fetch(
        apiUrl(`/api/coach/conversations?limit=50${q ? `&q=${encodeURIComponent(q)}` : ""}`)
      )
      if (!res.ok) throw new Error("加载对话列表失败")
      const data = (await res.json()) as ConversationItem[]
      setConversations(data)
    } catch (err) {
      console.error("加载对话列表失败:", err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      loadConversations("")
      return
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      loadConversations(search)
    }, 300)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [search, loadConversations])

  // 打开历史对话
  const openConversation = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/coach/conversations/${id}`))
      if (!res.ok) throw new Error("加载对话失败")
      const data = (await res.json()) as {
        id: string
        title: string
        messages: ChatMessage[]
      }
      setCurrentId(data.id)
      setCurrentTitle(data.title)
      setMessages(data.messages.length > 0 ? data.messages : [GREETING])
      setAttachment(null)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载对话失败")
    }
  }

  // 新对话
  const startNewConversation = () => {
    setCurrentId(null)
    setCurrentTitle("")
    setMessages([GREETING])
    setAttachment(null)
    setError("")
    setInput("")
  }

  // 发送消息
  const handleSend = async () => {
    const content = input.trim()
    if (!content || loading) return
    const wasNew = !currentId
    setError("")
    setInput("")

    const updated: ChatMessage[] = [...messages, { role: "user", content }]
    setMessages(updated)
    setLoading(true)

    const attachmentPayload = attachment && attachment.content ? attachment : null

    try {
      const res = await fetch(apiUrl("/api/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          conversationId: currentId || undefined,
          attachment: attachmentPayload || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "教练调用失败")

      if (typeof data.conversationId === "string") {
        setCurrentId(data.conversationId)
        if (wasNew) setCurrentTitle(content.slice(0, 20) || "新对话")
      }
      setAttachment(null)
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
      loadConversations(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : "教练暂时开小差了,请稍后再试")
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉,我暂时无法回复,请稍后再试。" }])
    } finally {
      setLoading(false)
    }
  }

  // 附件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (TEXT_EXTENSIONS.has(ext)) {
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : ""
        setAttachment({ name: file.name, content: text })
        setError("")
      }
      reader.onerror = () => setError("读取文件失败,请重试")
      reader.readAsText(file)
    } else {
      // 二进制/图片:只提示文件名,不读取内容
      setAttachment({ name: file.name, content: "" })
      setError("图片/二进制文件暂不支持解析,请粘贴文字内容")
    }
  }

  // 重命名
  const openRename = (item: ConversationItem) => {
    setRenaming(item)
    setRenameValue(item.title)
  }

  const confirmRename = async () => {
    if (!renaming) return
    const title = renameValue.trim()
    if (!title) return
    try {
      const res = await fetch(apiUrl(`/api/coach/conversations/${renaming.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error("重命名失败")
      if (currentId === renaming.id) setCurrentTitle(title)
      setRenaming(null)
      loadConversations(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : "重命名失败")
    }
  }

  // 删除
  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除这个对话吗?删除后不可恢复。")) return
    try {
      const res = await fetch(apiUrl(`/api/coach/conversations/${id}`), { method: "DELETE" })
      if (!res.ok) throw new Error("删除失败")
      if (currentId === id) startNewConversation()
      loadConversations(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败")
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="animate-fade-up">
        <PageHeader
          icon={Sparkles}
          title="AI 面试教练"
          description="基于你的面试记录和薄弱项，给你一对一的个性化辅导"
        />
      </div>

      <div className="animate-fade-up flex items-stretch gap-4" style={{ animationDelay: "50ms" }}>
        {/* 左侧历史列表 */}
        <Card className="flex h-[calc(100vh-140px)] min-h-[560px] w-[240px] shrink-0 flex-col">
          <CardHeader className="border-b pb-3">
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={startNewConversation}>
                <Plus className="size-4" /> 新对话
              </Button>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索历史对话…"
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            {loadingList && conversations.length === 0 ? (
              <p className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> 加载中…
              </p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">还没有历史对话</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => {
                  const active = c.id === currentId
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "group relative cursor-pointer rounded-lg px-2.5 py-2 transition-colors",
                        active ? "bg-primary/10" : "hover:bg-muted"
                      )}
                      onClick={() => openConversation(c.id)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn("truncate text-sm font-medium", active && "text-primary")}>
                          {c.title || "新对话"}
                        </p>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="重命名"
                            onClick={(e) => {
                              e.stopPropagation()
                              openRename(c)
                            }}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="删除"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(c.id)
                            }}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {c.lastMessage ? c.lastMessage.content.slice(0, 30) : `${c.messageCount} 条消息`}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">{timeLabel(c.updatedAt)}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 右侧聊天 */}
        <Card className="flex h-[calc(100vh-140px)] min-h-[560px] flex-1 flex-col">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{currentTitle || "我的教练"}</CardTitle>
                <CardDescription className="text-xs">记得你的每一场面试</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) =>
              i === 0 && m.role === "assistant" && messages.length <= 1 ? (
                <div
                  key={m.id || i}
                  className="w-full max-w-[85%] rounded-2xl bg-gradient-to-br from-indigo-50 to-card p-5 ring-1 ring-primary/15"
                >
                  <div className="mb-2 flex items-center gap-2 font-medium text-primary">
                    <Sparkles className="size-4" />
                    AI 面试教练 · 已了解你的面试数据
                  </div>
                  <Markdown content={m.content} />
                </div>
              ) : (
                <div key={m.id || i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
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
                  {m.role === "assistant" ? (
                    <div className="max-w-[80%] rounded-2xl bg-muted/60 px-4 py-2.5">
                      <Markdown content={m.content} />
                    </div>
                  ) : (
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {m.content}
                    </div>
                  )}
                </div>
              )
            )}

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
            {attachment && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                  <Paperclip className="size-3 shrink-0" />
                  已附加: {attachment.name}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setAttachment(null)}
                  title="移除附件"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="icon"
                title="附加文件"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf,.json,.js,.ts,.tsx,.jsx,.css,.html,.htm,.xml,.yaml,.yml,.csv,.sql,.py,.java,.go,.rb,.php,.c,.cpp,.h,.hpp,.sh,.bash,.ini,.conf,.log,.toml,.cfg,.ps1"
                className="hidden"
                onChange={handleFileChange}
              />
              <Textarea
                className="min-h-[44px] flex-1 resize-none"
                placeholder="向教练提问…（Enter 发送，Shift+Enter 换行）"
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

      {/* 重命名对话框 */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名对话</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                confirmRename()
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              取消
            </Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
