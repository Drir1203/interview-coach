"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Loader2, AlertCircle, Gift } from "lucide-react"
import { AuthShell } from "@/components/auth/AuthShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (password.length < 6) {
      setError("密码至少 6 位")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/interview/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "注册失败")
        setLoading(false)
        return
      }

      // 自动登录（用 signIn 正确处理 CSRF token）
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (signInRes?.error) {
        // 登录失败也跳登录页手动登录（必须带 /interview 前缀，否则落到根路径=其他项目）
        window.location.href = "/interview/auth/login"
        return
      }
      window.location.href = "/interview/dashboard"
      router.refresh()
    } catch {
      setError("注册失败，请重试")
      setLoading(false)
    }
  }

  return (
    <AuthShell title="注册" description="创建账号，让 AI 教练陪你复盘每一场">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">昵称</label>
          <Input
            id="name"
            placeholder="你的昵称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">邮箱</label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">密码</label>
          <Input
            id="password"
            type="password"
            placeholder="至少 6 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>

        {error && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="size-3" />
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          注册
        </Button>
      </form>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Gift className="size-3.5 text-primary" />
        注册即享 <span className="font-medium text-foreground">7 天 Pro 试用</span>
        <span className="text-muted-foreground">· 含 AI 语音 1 场</span>
      </p>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        已有账号？{" "}
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          登录
        </Link>
      </p>
    </AuthShell>
  )
}
