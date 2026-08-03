/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright")
const BASE = "https://47.116.138.61/interview"
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Users/siyua/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe", args: ["--no-proxy-server"] })
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  try {
    await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForSelector('input[type="email"]', { timeout: 15000 })
    await page.fill('input[type="email"]', "testuser@demo.com")
    await page.fill('input[type="password"]', "Test123456")
    await page.click('button[type="submit"]')
    await page.waitForTimeout(8000)
    console.log("登录后URL:", page.url())
    const err = await page.locator("text=邮箱或密码错误").count()
    console.log(`报"邮箱或密码错误": ${err > 0}`)
    const aside = await page.locator("aside").first().innerText().catch(()=>"")
    console.log("侧边栏含测试账号:", aside.includes("测试账号") || aside.includes("testuser"))
  } catch (e) { console.error("ERR:", e.message) } finally { await browser.close() }
})()
