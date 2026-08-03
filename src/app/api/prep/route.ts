import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { generatePrepPlan } from "@/lib/ai-prep"

// POST /api/prep - 面试前押题,生成个性化准备方案
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || "default"

  let body: { company?: string; position?: string; roundType?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const company = body?.company?.trim()
  const position = body?.position?.trim()
  if (!company || !position) {
    return Response.json({ error: "请填写公司和岗位" }, { status: 400 })
  }
  const roundType = body?.roundType || "first"

  try {
    const plan = await generatePrepPlan(userId, company, position, roundType)
    return Response.json({ plan })
  } catch (err) {
    console.error("押题生成失败:", err)
    return Response.json({ error: "生成失败,请稍后再试" }, { status: 500 })
  }
}
