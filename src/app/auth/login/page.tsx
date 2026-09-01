"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle } from "lucide-react"
import { Logo } from "@/components/Logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

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

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const callbackUrl = searchParams.get("callbackUrl") || ""
  const featureName = featureNameFromCallback(callbackUrl)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("邮箱或密码错误")
        setLoading(false)
        return
      }

      window.location.href = callbackUrl || "/interview/dashboard"
    } catch {
      setError("登录失败，请重试")
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <Logo size="md" />
        </div>
        <CardTitle className="text-xl">登录</CardTitle>
        <CardDescription>
          {featureName ? `登录后继续使用「${featureName}」` : "登录后可在多设备同步面试数据"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">邮箱</label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">密码</label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="size-3" />
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            登录
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link href="/auth/register" className="text-primary hover:underline">
            注册
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={
        <Card className="w-full max-w-sm">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
