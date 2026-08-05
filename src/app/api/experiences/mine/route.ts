import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { auth } from "@/auth"

function getUserId(session: any): string {
  return session?.user?.id || "default"
}

// GET /api/experiences/mine - 我的贡献（供管理/撤回）
export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = getUserId(session)

  const mine = await prisma.interviewExperience.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return Response.json(mine)
}
