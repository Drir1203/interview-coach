import prisma from "@/lib/db"

// 同步面试标签：删除旧的全部重建，保证与传入一致（去重、截断）
export async function syncInterviewTags(userId: string, interviewId: string, names?: string[]) {
  if (!Array.isArray(names)) return

  await prisma.interviewTag.deleteMany({ where: { interviewId } })

  const cleaned = [...new Set(names.map((n) => String(n).trim().slice(0, 20)).filter(Boolean))]
  for (const name of cleaned) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    })
    await prisma.interviewTag.create({ data: { interviewId, tagId: tag.id } })
  }
}
