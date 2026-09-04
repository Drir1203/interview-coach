import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/AuthShell"
import { LoginForm } from "@/components/auth/LoginForm"

export const metadata: Metadata = {
  title: "登录",
}

// callbackUrl 功能路径 → 功能名（登录页提示「登录后继续使用「XX」」）
const FEATURE_NAMES: Record<string, string> = {
  "/coach": "AI 教练",
  "/prep": "面试押题",
  "/report": "成长报告",
  "/analysis": "深入分析",
  "/applications": "投递管理",
  "/interviews": "面试记录",
  "/companies": "公司管理",
  "/experiences": "经历管理",
  "/practice": "模拟面试",
  "/settings": "设置",
}

// 从 callbackUrl（如 /interview/coach、/interview/interviews/new）解析功能名；识别不出返回 null
function featureNameFromCallback(callbackUrl: string): string | null {
  if (!callbackUrl) return null
  const path = callbackUrl.replace(/^\/interview/, "") // 去掉 basePath
  const matched = Object.keys(FEATURE_NAMES)
    .sort((a, b) => b.length - a.length) // 长 key 优先，命中子路径如 /interviews/new
    .find((key) => path === key || path.startsWith(`${key}/`))
  return matched ? FEATURE_NAMES[matched] : null
}

interface SearchParams {
  callbackUrl?: string | string[]
}

// Server Component：在服务端读 query 算出回跳提示，避免在客户端组件里用
// useSearchParams（静态预渲染下会让整页退化成 Suspense 兜底，SSR 丢失正文）。
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { callbackUrl: rawCallbackUrl } = await searchParams
  const callbackUrl = Array.isArray(rawCallbackUrl) ? (rawCallbackUrl[0] ?? "") : (rawCallbackUrl ?? "")
  const featureName = featureNameFromCallback(callbackUrl)

  return (
    <AuthShell
      title="登录"
      description={featureName ? `登录后继续使用「${featureName}」` : "欢迎回来，继续你的面试进阶之旅"}
    >
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  )
}
