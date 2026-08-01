// 用 Playwright 真实浏览器测试登录后侧边栏显示
const { chromium } = require("playwright")

const BASE = "https://47.116.138.61/interview"
const EMAIL = "e2e@e2e.com"
const PASSWORD = "e2e123"

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/siyua/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe",
  })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  const logs = []

  page.on("request", (req) => { if (req.url().includes("session") || req.url().includes("auth")) console.log("[request]", req.method(), req.url()) })
  page.on("console", (msg) => logs.push(`[console] ${msg.type()}: ${msg.text()}`))
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`))
  page.on("requestfailed", (req) => logs.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`))

  try {
    // 1. 打开登录页
    console.log("=== 1. 打开登录页 ===")
    await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" })
    console.log("页面标题:", await page.title())
    console.log("URL:", page.url())

    // 2. 填写并提交登录
    console.log("\n=== 2. 登录 ===")
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    // 等待跳转
    await page.waitForURL("**/interview/**", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)
    console.log("登录后 URL:", page.url())

    // 3. 检查侧边栏显示的文本
    console.log("\n=== 3. 侧边栏内容 ===")
    const sidebarText = await page.locator("aside").first().innerText().catch(() => "获取失败")
    console.log("侧边栏文本:")
    console.log(JSON.stringify(sidebarText))

    // 4. 检查是否显示"登录"按钮
    const hasLoginBtn = await page.locator("aside", { hasText: "登录" }).count()
    const hasEmail = await page.locator("aside", { hasText: EMAIL }).count()
    console.log(`\n侧边栏含"登录": ${hasLoginBtn > 0}`)
    console.log(`侧边栏含邮箱 ${EMAIL}: ${hasEmail > 0}`)

    // 5. 检查 session 请求
    console.log("\n=== 4. 控制台日志 ===")
    logs.forEach((l) => console.log(l))
  } catch (err) {
    console.error("测试出错:", err.message)
    logs.forEach((l) => console.log(l))
  } finally {
    await browser.close()
  }
})()
