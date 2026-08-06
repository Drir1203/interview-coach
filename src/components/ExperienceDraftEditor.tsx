"use client"

import { useState } from "react"
import { Eye, EyeOff, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUND_TYPES } from "@/types"
import { maskCompany } from "@/lib/ai-experience"

// ────────── 类型（供面经库页 / 详情页复用） ──────────

export interface DraftEntry {
  key: string
  position: string
  round: string
  question: string
  answer: string
  originalQuestion: string
  originalAnswer: string | null
}

export interface ExperienceDraftItem {
  company: string
  position: string
  round: string
  question: string
  answer?: string
  sourceInterviewId?: string
}

interface ExperienceDraftEditorProps {
  company: string
  industry?: string | null
  sourceInterviewId?: string | null
  entries: DraftEntry[]
  submitting: boolean
  onChange: (entries: DraftEntry[]) => void
  onSubmit: (items: ExperienceDraftItem[]) => void
  onCancel: () => void
}

/**
 * AI 抽象面经草稿编辑器（面经库页 / 详情页共用）
 * - A｜原文 vs 脱敏对比：每条草稿可展开查看 AI 脱敏前的原题/原回答
 * - D｜公司名匿名化：默认匿名，可切换为真实公司名
 * - 每条草稿可编辑岗位/轮次/题目/回答，可删除；确认后批量提交
 */
export default function ExperienceDraftEditor({
  company,
  industry,
  sourceInterviewId,
  entries,
  submitting,
  onChange,
  onSubmit,
  onCancel,
}: ExperienceDraftEditorProps) {
  // D｜是否匿名公司名（默认匿名）
  const [anonymousCompany, setAnonymousCompany] = useState(true)
  // A｜已展开对比原稿的 key 集合
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const masked = maskCompany(company, industry ?? null)
  const finalCompany = anonymousCompany ? masked : company

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const updateEntry = (key: string, patch: Partial<DraftEntry>) => {
    onChange(entries.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  const removeEntry = (key: string) => {
    onChange(entries.filter((e) => e.key !== key))
  }

  const validEntries = entries.filter((e) => e.question.trim())
  const canSubmit = validEntries.length > 0 && !submitting

  const handleSubmit = () => {
    if (!canSubmit) return
    const items: ExperienceDraftItem[] = validEntries.map((e) => ({
      company: finalCompany,
      position: e.position.trim() || "未知岗位",
      round: e.round,
      question: e.question.trim(),
      ...(e.answer.trim() ? { answer: e.answer.trim() } : {}),
      ...(sourceInterviewId ? { sourceInterviewId } : {}),
    }))
    onSubmit(items)
  }

  return (
    <div className="space-y-4">
      {/* D｜公司名匿名化开关 */}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-muted/40 p-3">
        <Checkbox
          checked={anonymousCompany}
          onCheckedChange={(v) => setAnonymousCompany(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-4 text-green-600" />
            匿名公司名
          </span>
          <span className="mt-0.5 block text-muted-foreground">
            {anonymousCompany
              ? `公开时将展示为「${masked}」，不暴露真实公司名`
              : `公开时将展示为「${company}」`}
          </span>
        </span>
      </label>

      {/* 草稿列表 */}
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          没有可提交的草稿，请返回勾选题目
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div key={entry.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  面经 {idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleReveal(entry.key)}
                    className="gap-1 text-xs"
                  >
                    {revealed.has(entry.key) ? (
                      <>
                        <EyeOff className="size-3.5" />
                        隐藏原文
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" />
                        查看原文对比
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEntry(entry.key)}
                    className="text-destructive"
                    aria-label="删除这条草稿"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* A｜原文 vs 脱敏对比 */}
              {revealed.has(entry.key) && (
                <div className="space-y-2 rounded-md bg-muted/60 p-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      原题（脱敏前）：
                    </span>
                    <p className="mt-0.5 whitespace-pre-wrap">{entry.originalQuestion}</p>
                  </div>
                  {entry.originalAnswer && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        原回答（脱敏前）：
                      </span>
                      <p className="mt-0.5 whitespace-pre-wrap">{entry.originalAnswer}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">岗位</label>
                  <Input
                    value={entry.position}
                    onChange={(e) => updateEntry(entry.key, { position: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">轮次</label>
                  <Select
                    value={entry.round}
                    onValueChange={(v) => v && updateEntry(entry.key, { round: v })}
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">题目 *</label>
                <Textarea
                  rows={2}
                  value={entry.question}
                  onChange={(e) => updateEntry(entry.key, { question: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  参考答案（可选）
                </label>
                <Textarea
                  rows={3}
                  value={entry.answer}
                  onChange={(e) => updateEntry(entry.key, { answer: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          确认提交{validEntries.length > 0 ? `（${validEntries.length} 条）` : ""}
        </Button>
      </div>
    </div>
  )
}
