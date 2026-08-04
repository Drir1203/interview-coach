"use client"

import { useEffect, useState } from "react"
import { Briefcase, PlusCircle, Sparkles, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"
import { ROUND_TYPE_LABELS, ROUND_TYPES } from "@/types"

interface Application {
  id: string
  company: string
  position: string
  status: string
  currentRound: string
  notes: string | null
  appliedAt: string
  nextStep: string | null
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  applied: { label: "已投递", variant: "secondary" },
  interviewing: { label: "面试中", variant: "default" },
  offer: { label: "已拿Offer", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
  closed: { label: "已结束", variant: "outline" },
}

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
}))

const STATUS_TABS = [
  { value: "all", label: "全部" },
  { value: "applied", label: "已投递" },
  { value: "interviewing", label: "面试中" },
  { value: "offer", label: "已拿Offer" },
  { value: "rejected", label: "已拒绝" },
  { value: "closed", label: "已结束" },
]

const EMPTY_FORM = {
  company: "",
  position: "",
  status: "applied",
  currentRound: "first",
  notes: "",
  appliedAt: "",
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")

  // 新建弹窗
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  // AI 策略
  const [strategies, setStrategies] = useState<Record<string, string>>({})
  const [strategyLoading, setStrategyLoading] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch("/interview/api/applications")
      .then((r) => r.json())
      .then((data) => {
        setApplications(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = applications.filter((a) => tab === "all" || a.status === tab)

  const handleCreate = async () => {
    if (!form.company.trim() || !form.position.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch("/interview/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: form.company.trim(),
          position: form.position.trim(),
          status: form.status,
          currentRound: form.currentRound,
          notes: form.notes.trim() || undefined,
          appliedAt: form.appliedAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "创建失败")
      setApplications((prev) => [data, ...prev])
      setCreateOpen(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败，请重试")
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (id: string, patch: Partial<Pick<Application, "status" | "currentRound">>) => {
    try {
      const res = await fetch(`/interview/api/applications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("更新失败")
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败，请重试")
    }
  }

  const handleStrategy = async (app: Application) => {
    setStrategyLoading((prev) => ({ ...prev, [app.id]: true }))
    try {
      const res = await fetch(`/interview/api/applications/${app.id}/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "生成失败")
      setStrategies((prev) => ({ ...prev, [app.id]: data.strategy }))
      setExpanded((prev) => ({ ...prev, [app.id]: true }))
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成策略失败，请稍后再试")
    } finally {
      setStrategyLoading((prev) => ({ ...prev, [app.id]: false }))
    }
  }

  const handleDelete = async (app: Application) => {
    if (!window.confirm(`确定删除「${app.company} · ${app.position}」这条求职进度吗？`)) return
    try {
      const res = await fetch(`/interview/api/applications/${app.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("删除失败")
      setApplications((prev) => prev.filter((a) => a.id !== app.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败，请重试")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">求职进度</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="size-4" />
          新建求职
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Briefcase className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">{tab === "all" ? "还没有求职进度，点击右上角开始记录" : "该状态下暂无求职记录"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const statusCfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.applied
            const strategy = strategies[app.id] ?? app.nextStep ?? null
            const isStrategyLoading = strategyLoading[app.id]
            const isExpanded = expanded[app.id]

            return (
              <Card key={app.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="size-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{app.company}</span>
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </div>
                        <div className="mt-0.5 text-sm text-muted-foreground">{app.position}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(app)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>投递日期：{formatDate(app.appliedAt)}</span>
                    <span>当前轮次：{ROUND_TYPE_LABELS[app.currentRound] || app.currentRound}</span>
                    {app.notes && (
                      <span className="max-w-[60%] truncate" title={app.notes}>
                        备注：{app.notes}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">状态</span>
                      <Select
                        value={app.status}
                        onValueChange={(v) => v && handleUpdate(app.id, { status: v })}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">轮次</span>
                      <Select
                        value={app.currentRound}
                        onValueChange={(v) => v && handleUpdate(app.id, { currentRound: v })}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROUND_TYPES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleStrategy(app)}
                      disabled={isStrategyLoading}
                    >
                      {isStrategyLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5 text-primary" />
                      )}
                      {isStrategyLoading ? "生成中…" : "生成策略"}
                    </Button>
                    {strategy && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => setExpanded((prev) => ({ ...prev, [app.id]: !prev[app.id] }))}
                      >
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                        {isExpanded ? "收起" : "展开策略"}
                      </Button>
                    )}
                  </div>

                  {strategy && isExpanded && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Sparkles className="size-3.5 text-primary" />
                        AI 下一步行动建议
                      </div>
                      <div className="prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                        {strategy}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 新建求职弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建求职进度</DialogTitle>
            <DialogDescription>记录一条新的求职投递，公司和岗位必填</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                公司 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="如：字节跳动"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                岗位 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="如：后端开发工程师"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">状态</label>
                <Select value={form.status} onValueChange={(v) => v && setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">当前轮次</label>
                <Select
                  value={form.currentRound}
                  onValueChange={(v) => v && setForm((f) => ({ ...f, currentRound: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">投递日期</label>
              <Input
                type="date"
                value={form.appliedAt}
                onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <Textarea
                rows={3}
                placeholder="如：内推、薪资预期、岗位 JD 要点等"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.company.trim() || !form.position.trim()}
            >
              {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
