"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts"

interface TrendData {
  date: string
  score: number
  company: string
  position: string
}

interface Props {
  data: TrendData[]
}

export function ScoreTrend({ data }: Props) {
  if (data.length === 0) return null

  const chartData = data.map((d, i) => ({
    index: i + 1,
    label: `#${i + 1}`,
    score: d.score,
    company: d.company,
    position: d.position,
    date: d.date,
  }))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                  <p className="font-medium">{d.company}</p>
                  <p className="text-xs text-muted-foreground">{d.position}</p>
                  <p className="mt-1">
                    评分：<strong className="text-primary">{d.score.toFixed(1)}</strong>
                  </p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
