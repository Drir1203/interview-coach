import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || "default"
  const format = req.nextUrl.searchParams.get("format") || "csv"

  const interviews = await prisma.interview.findMany({
    where: { userId },
    include: {
      company: true,
      questions: { orderBy: { order: "asc" } },
    },
    orderBy: { date: "desc" },
  })

  if (format === "csv") {
    const header = "日期,公司,岗位,轮次,结果,评分,问题,回答,AI评分,AI反馈\n"
    const rows = interviews.flatMap((iv) =>
      iv.questions.map((q) => {
        const roundLabel: Record<string, string> = {
          first: "一面", second: "二面", third: "三面",
          final: "终面", hr: "HR面", written: "笔试", other: "其他",
        }
        const dateStr = iv.date.toISOString().slice(0, 10)
        const resultLabel: Record<string, string> = {
          pass: "通过", fail: "未通过", waiting: "等待中", unknown: "未知",
        }
        const escape = (s: string | null) => {
          if (!s) return ""
          return `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`
        }
        return [
          dateStr,
          escape(iv.company.name),
          escape(iv.position),
          roundLabel[iv.roundType] || iv.roundType,
          resultLabel[iv.result || ""] || "",
          iv.overallScore?.toFixed(1) || "",
          escape(q.questionText),
          escape(q.userAnswer),
          q.aiScore?.toFixed(1) || "",
          escape(q.aiFeedback),
        ].join(",")
      })
    )

    const csv = "﻿" + header + rows.join("\n") // BOM for Excel

    const datePart = new Date().toISOString().slice(0, 10)
    const asciiName = `interviews_${datePart}.csv`
    const utf8Name = `面试记录_${datePart}.csv`
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // 中文文件名需用 RFC 5987 filename*（HTTP 头仅允许 ASCII）
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
      },
    })
  }

  return Response.json({ error: "不支持的格式" }, { status: 400 })
}
