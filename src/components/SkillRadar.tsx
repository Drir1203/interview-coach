"use client"

import {
  RadarChart as RechartRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

interface SkillData {
  category: string
  score: number
  count?: number
}

const CATEGORY_LABELS: Record<string, string> = {
  technical: "技术基础",
  behavioral: "行为面试",
  project_deep_dive: "项目深挖",
  system_design: "系统设计",
  hr: "HR 面试",
  custom: "自定义题库",
}

interface Props {
  data: SkillData[]
}

export function SkillRadar({ data }: Props) {
  if (data.length === 0) return null

  const chartData = data.map((d) => ({
    category: CATEGORY_LABELS[d.category] || d.category,
    score: d.score,
    fullMark: 10,
  }))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <RechartRadar data={chartData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tick={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: unknown) => [`${Number(value).toFixed(1)} / 10`, "得分"]}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          />
          <Radar
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RechartRadar>
      </ResponsiveContainer>
    </div>
  )
}
