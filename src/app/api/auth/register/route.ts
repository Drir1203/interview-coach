import { NextRequest } from "next/server"
import { hash } from "bcryptjs"
import prisma from "@/lib/db"
import { ensureTrialOnRegister } from "@/lib/tier"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!email || !password) {
      return Response.json({ error: "邮箱和密码必填" }, { status: 400 })
    }

    if (password.length < 6) {
      return Response.json({ error: "密码至少 6 位" }, { status: 400 })
    }

    // 检查邮箱是否已被注册
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return Response.json({ error: "该邮箱已被注册" }, { status: 409 })
    }

    const passwordHash = await hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        passwordHash,
      },
    })

    // 注册即送 7 天 Pro 试用（内部吞错，不阻断注册）
    await ensureTrialOnRegister(user.id)

    return Response.json({
      id: user.id,
      name: user.name,
      email: user.email,
    })
  } catch (err: any) {
    return Response.json({ error: err.message || "注册失败" }, { status: 500 })
  }
}
