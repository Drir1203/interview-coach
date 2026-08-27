"use client"

// 收款设置：配置价格页展示的个人收款码（微信/支付宝图片 URL + 账户提示文案）。
// 数据来自 /api/admin/payment-config；保存走 PUT（清洗校验后端做，非法返回 400）。

import { useCallback, useEffect, useState } from "react"
import { Loader2, QrCode, Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { api, isUnauthenticated } from "@/lib/api"
import type { PaymentConfigData } from "@/lib/payment/payment-config"

interface Props {
  onUnauthenticated: () => void
}

export function PaymentConfigPanel({ onUnauthenticated }: Props) {
  const [wechatQrUrl, setWechatQrUrl] = useState("")
  const [alipayQrUrl, setAlipayQrUrl] = useState("")
  const [accountHint, setAccountHint] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<PaymentConfigData>("/admin/payment-config")
      setWechatQrUrl(data.wechatQrUrl ?? "")
      setAlipayQrUrl(data.alipayQrUrl ?? "")
      setAccountHint(data.accountHint ?? "")
    } catch (err) {
      if (isUnauthenticated(err)) {
        onUnauthenticated()
      } else {
        toast.add({
          title: "加载收款设置失败",
          description: err instanceof Error ? err.message : "请稍后重试",
          type: "error",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [onUnauthenticated])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await api.put<PaymentConfigData>("/admin/payment-config", {
        wechatQrUrl: wechatQrUrl.trim(),
        alipayQrUrl: alipayQrUrl.trim(),
        accountHint: accountHint.trim(),
      })
      setWechatQrUrl(data.wechatQrUrl ?? "")
      setAlipayQrUrl(data.alipayQrUrl ?? "")
      setAccountHint(data.accountHint ?? "")
      toast.add({ title: "收款设置已保存", type: "success" })
    } catch (err) {
      toast.add({
        title: "保存失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="size-4" /> 收款码配置
          </CardTitle>
          <CardDescription>
            配置后，价格页用户下单即展示对应收款码；转账后点「我已转账」通知平台，你在此核对到账并确认开通。
            图片地址须为 http(s):// 开头的链接（可用图床或服务器静态文件）。留空表示该渠道暂不提供。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="wechat-qr">
              微信收款码图片 URL
            </label>
            <Input
              id="wechat-qr"
              placeholder="https://example.com/wechat-qr.png"
              value={wechatQrUrl}
              onChange={(e) => setWechatQrUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="alipay-qr">
              支付宝收款码图片 URL
            </label>
            <Input
              id="alipay-qr"
              placeholder="https://example.com/alipay-qr.png"
              value={alipayQrUrl}
              onChange={(e) => setAlipayQrUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="account-hint">
              收款账户提示文案（≤100 字，可选）
            </label>
            <Input
              id="account-hint"
              placeholder="如：微信收款·张三"
              value={accountHint}
              onChange={(e) => setAccountHint(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void handleSave()} disabled={saving || loading} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "保存中…" : "保存"}
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
