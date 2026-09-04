"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface LoginFormProps {
  /** 登录成功后回跳地址（Server 端从 query 解析，空则回总览） */
  callbackUrl: string
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

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
    <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
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
        登录
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        还没有账号？{" "}
        <Link href="/auth/register" className="font-medium text-primary hover:underline">
          注册
        </Link>
      </p>
    </form>
  )
}
