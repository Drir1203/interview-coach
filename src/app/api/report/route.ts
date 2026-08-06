import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { generateGrowthReport } from "@/lib/ai-report"

// POST /api/report - 生成成长报告
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || "__anon__"

  try {
    const { report, data } = await generateGrowthReport(userId)
    return Response.json({ report, data })
  } catch (err) {
    console.error("成长报告生成失败:", err)
    return Response.json({ error: "报告生成失败,请稍后再试" }, { status: 500 })
  }
}
