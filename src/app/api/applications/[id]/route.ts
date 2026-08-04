import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

const VALID_STATUS = ["applied", "interviewing", "offer", "rejected", "closed"]
const VALID_ROUND = ["first", "second", "third", "final", "hr", "written", "other"]

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const userId = session?.user?.id || "default"
    const body = await req.json()

    const existing = await prisma.jobApplication.findFirst({ where: { id, userId } })
    if (!existing) {
      return Response.json({ error: "求职进度不存在" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.company === "string" && body.company.trim()) data.company = body.company.trim().slice(0, 60)
    if (typeof body.position === "string" && body.position.trim()) data.position = body.position.trim().slice(0, 60)
    if (VALID_STATUS.includes(body.status)) data.status = body.status
    if (VALID_ROUND.includes(body.currentRound)) data.currentRound = body.currentRound
    if (typeof body.notes === "string") data.notes = body.notes.slice(0, 1000)
    if (body.appliedAt) data.appliedAt = new Date(body.appliedAt)

    const updated = await prisma.jobApplication.update({ where: { id }, data })

    return Response.json(updated)
  } catch (err) {
    console.error("更新求职进度失败:", err)
    return Response.json({ error: "更新失败" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const userId = session?.user?.id || "default"

    const existing = await prisma.jobApplication.findFirst({ where: { id, userId } })
    if (!existing) {
      return Response.json({ error: "求职进度不存在" }, { status: 404 })
    }

    await prisma.jobApplication.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (err) {
    console.error("删除求职进度失败:", err)
    return Response.json({ error: "删除失败" }, { status: 500 })
  }
}
