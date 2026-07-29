"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CalendarEvent {
  date: string
  company: string
  position: string
  id: string
  score?: number | null
}

interface Props {
  events: CalendarEvent[]
}

export function InterviewCalendar({ events }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = e.date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events])

  const monthEvents: { day: number; events: CalendarEvent[] }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const evts = eventMap.get(dateStr) || []
    monthEvents.push({ day: d, events: evts })
  }

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0) }
    else setMonth(month + 1)
  }

  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]
  const dayNames = ["日","一","二","三","四","五","六"]

  const isToday = (d: number) => {
    const t = new Date()
    return d === t.getDate() && month === t.getMonth() && year === t.getFullYear()
  }

  return (
    <div className="space-y-3">
      {/* 月份导航 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">{year}年 {monthNames[month]}</span>
        <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* 星期 */}
      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
        {dayNames.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      {/* 日期 */}
      <div className="grid grid-cols-7 text-center text-sm">
        {/* 空白格 */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square p-1" />
        ))}

        {monthEvents.map(({ day, events: evts }) => (
          <div
            key={day}
            className={cn(
              "relative aspect-square rounded-lg p-1 transition-colors",
              isToday(day) && "ring-1 ring-primary",
              evts.length > 0 && "bg-primary/5"
            )}
          >
            <span className={cn(
              "text-xs",
              isToday(day) && "font-bold text-primary"
            )}>
              {day}
            </span>
            {evts.length > 0 && (
              <div className="mt-0.5 space-y-0.5">
                {evts.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    className="h-1 rounded-full bg-primary/60"
                    title={`${e.company} - ${e.position}`}
                  />
                ))}
                {evts.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{evts.length - 2}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 当天面试列表 */}
      <div className="space-y-1">
        {monthEvents
          .filter((d) => d.events.length > 0 && d.day === today.getDate() && month === today.getMonth() && year === today.getFullYear())
          .flatMap((d) => d.events)
          .slice(0, 3)
          .map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs">
              <span className="font-medium">{e.company}</span>
              <span className="text-muted-foreground">{e.position}</span>
              {e.score && <span className="font-bold text-primary">{e.score.toFixed(1)}</span>}
            </div>
          ))}
      </div>
    </div>
  )
}
