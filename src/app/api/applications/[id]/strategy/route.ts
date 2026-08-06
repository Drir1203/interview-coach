import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"
import { generateApplicationStrategy } from "@/lib/ai-application"

// POST /api/applications/[id]/strategy - 为求职进度生成 AI 下一步行动策略
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const userId = session?.user?.id || "__anon__"

    const app = await prisma.jobApplication.findFirst({ where: { id, userId } })
    if (!app) {
      return Response.json({ error: "求职进度不存在" }, { status: 404 })
    }

    const strategy = await generateApplicationStrategy(userId, {
      company: app.company,
      position: app.position,
      status: app.status,
      currentRound: app.currentRound,
      notes: app.notes || undefined,
    })

    // 把 AI 建议写入 nextStep，供下次查看
    await prisma.jobApplication.update({
      where: { id },
      data: { nextStep: strategy.slice(0, 2000) },
    })

    return Response.json({ strategy })
  } catch (err) {
    console.error("生成求职策略失败:", err)
    return Response.json({ error: "生成失败，请稍后再试" }, { status: 500 })
  }
}
