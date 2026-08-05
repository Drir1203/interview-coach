import { NextRequest } from "next/server"
import { hash, compare } from "bcryptjs"
import { auth } from "@/auth"
import prisma from "@/lib/db"

// 修改密码
// - 邮箱注册用户（passwordHash 存在）：必须校验原密码
// - 微信登录用户（passwordHash 为空）：跳过原密码校验，首次直接设置密码
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || "default"

    const body = await req.json()
    const oldPassword = typeof body?.oldPassword === "string" ? body.oldPassword : undefined
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (newPassword.length < 6) {
      return Response.json({ error: "密码至少 6 位" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 })
    }

    if (user.passwordHash) {
      if (!oldPassword) {
        return Response.json({ error: "请输入原密码" }, { status: 400 })
      }
      const ok = await compare(oldPassword, user.passwordHash)
      if (!ok) {
        return Response.json({ error: "原密码错误" }, { status: 401 })
      }
    }

    const passwordHash = await hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ error: err.message || "修改失败" }, { status: 500 })
  }
}
