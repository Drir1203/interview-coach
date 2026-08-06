import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

const VALID_STATUS = ["applied", "interviewing", "offer", "rejected", "closed"]
const VALID_ROUND = ["first", "second", "third", "final", "hr", "written", "other"]

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id || "__anon__"

  const applications = await prisma.jobApplication.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  })

  return Response.json(applications)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || "__anon__"
    const body = await req.json()

    const company = typeof body.company === "string" ? body.company.trim() : ""
    const position = typeof body.position === "string" ? body.position.trim() : ""
    if (!company || !position) {
      return Response.json({ error: "公司和岗位必填" }, { status: 400 })
    }

    const status = VALID_STATUS.includes(body.status) ? body.status : "applied"
    const currentRound = VALID_ROUND.includes(body.currentRound) ? body.currentRound : "first"

    const application = await prisma.jobApplication.create({
      data: {
        userId,
        company: company.slice(0, 60),
        position: position.slice(0, 60),
        status,
        currentRound,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : null,
        appliedAt: body.appliedAt ? new Date(body.appliedAt) : new Date(),
      },
    })

    return Response.json(application, { status: 201 })
  } catch (err) {
    console.error("创建求职进度失败:", err)
    return Response.json({ error: "创建失败" }, { status: 500 })
  }
}
