"use client"

// PWA Service Worker 注册：仅生产环境注册（开发/预览注册会干扰 HMR），避免重复注册。

import { useEffect } from "react"
import { apiUrl } from "@/lib/utils"

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    // SW 依赖 HTTPS；localhost 除外
    if (!window.isSecureContext) return

    let cancelled = false
    const swUrl = apiUrl("/sw.js")
    const register = () =>
      navigator.serviceWorker
        .register(swUrl, { scope: "/interview/" })
        .catch(() => {
          // 静默失败：SW 仅是增强能力，不影响主功能
        })

    // 页面加载完成后注册，避免与首屏资源竞争
    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", () => {
        if (!cancelled) register()
      })
    }
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
