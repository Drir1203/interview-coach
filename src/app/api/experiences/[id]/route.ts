import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { auth } from "@/auth"

function getUserId(session: any): string {
  return session?.user?.id || "default"
}

// DELETE /api/experiences/[id] - 撤回自己的贡献（归属校验）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = getUserId(session)

  const exp = await prisma.interviewExperience.findUnique({ where: { id } })
  if (!exp || exp.userId !== userId) {
    return Response.json({ error: "面经不存在或无权限" }, { status: 404 })
  }

  await prisma.interviewExperience.delete({ where: { id } })
  return Response.json({ success: true })
}
