import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/db"

// 更新用户昵称（微信登录用户默认"微信用户"，可在此修改）
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || "__anon__"

    const { name } = await req.json()
    const clean = typeof name === "string" ? name.trim().slice(0, 20) : ""
    if (!clean) {
      return Response.json({ error: "昵称不能为空" }, { status: 400 })
    }

    await prisma.user.update({ where: { id: userId }, data: { name: clean } })

    return Response.json({ success: true, name: clean })
  } catch (err) {
    console.error("更新昵称失败:", err)
    return Response.json({ error: "更新失败" }, { status: 500 })
  }
}
