// 用 Playwright 端到端验证 PDF 导出功能
// 用法: node scripts/test-pdf-export.js
// 环境变量: PDF_TEST_BASE 覆盖目标地址（默认生产，本地调试: PDF_TEST_BASE=http://localhost:3000/interview）
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright")
const fs = require("fs")

const BASE = process.env.PDF_TEST_BASE || "https://47.116.138.61/interview"
const EMAIL = "e2e@e2e.com"
const PASSWORD = "e2e123"
const EXECUTABLE =
  "C:/Users/siyua/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe"

let PASS = 0
let FAIL = 0
const check = (name, ok) => {
  if (ok) { PASS++; console.log(`  ✅ ${name}`) }
  else { FAIL++; console.log(`  ❌ ${name}`) }
}

// 校验下载文件是合法 PDF
function validatePdf(buf) {
  return buf.length > 200 && buf.subarray(0, 5).toString("latin1") === "%PDF-"
}

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE })
  const context = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true })
  const page = await context.newPage()

  try {
    // 1. 登录
    console.log("=== 1. 登录 ===")
    await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" })
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/interview/**", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    console.log("  登录后 URL:", page.url())
    check("登录成功", page.url().includes("/interview"))

    // 2. 列表页
    console.log("\n=== 2. 列表页导出 PDF ===")
    await page.goto(`${BASE}/interviews`, { waitUntil: "networkidle" })
    // 等待列表渲染完成（数据加载或空状态）
    await page.waitForSelector("a[href*='/interviews/']:not([href*='/new']), text=还没有面试记录", { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(800)

    // 确保至少有一条数据（无则通过 API 创建一条）
    const cardCount = await page.locator("a[href*='/interviews/']:not([href*='/new'])").count()
    console.log(`  现有面试卡片: ${cardCount}`)
    if (cardCount === 0) {
      console.log("  无数据，创建一条测试面试...")
      const res = await context.request.post(`${BASE}/api/interviews`, {
        data: {
          companyName: "PDF测试公司",
          position: "后端开发",
          roundType: "first",
          questions: [{ order: 1, questionText: "请介绍你的项目经验", userAnswer: "我负责了核心模块开发" }],
        },
      })
      console.log("  创建结果:", res.status())
      await page.reload({ waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
    }

    // 列表页点击「导出 PDF」并捕获下载
    const [listDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      page.click('button:has-text("导出 PDF")'),
    ])
    const listPath = await listDownload.path()
    const listBuf = fs.readFileSync(listPath)
    console.log(`  文件名: ${listDownload.suggestedFilename()}, 大小: ${listBuf.length} bytes`)
    check("列表页导出为 .pdf", listDownload.suggestedFilename().endsWith(".pdf"))
    check("列表页 PDF 魔数与大小合法", validatePdf(listBuf))

    // 3. 详情页
    console.log("\n=== 3. 详情页导出 PDF ===")
    await page.goto(`${BASE}/interviews`, { waitUntil: "networkidle" })
    // 显式等待卡片出现（dev server 首次访问需按需编译，固定等待不可靠）
    const firstCard = page.locator("a[href*='/interviews/']:not([href*='/new']):not([href*='/edit'])").first()
    await firstCard.waitFor({ state: "visible", timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(500)
    await firstCard.click()
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1000)
    console.log("  详情页 URL:", page.url())
    check("进入详情页", page.url().match(/\/interviews\/[^/]+$/) !== null)

    const [detailDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      page.click('button:has-text("导出 PDF")'),
    ])
    const detailPath = await detailDownload.path()
    const detailBuf = fs.readFileSync(detailPath)
    console.log(`  文件名: ${detailDownload.suggestedFilename()}, 大小: ${detailBuf.length} bytes`)
    check("详情页导出为 .pdf", detailDownload.suggestedFilename().endsWith(".pdf"))
    check("详情页 PDF 魔数与大小合法", validatePdf(detailBuf))

    // 4. CSV 导出链接验证（basePath 修复回归）
    console.log("\n=== 4. CSV 导出链接（basePath 回归） ===")
    await page.goto(`${BASE}/interviews`, { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    const csvHref = await page.locator('a[href*="/api/export?format=csv"]').getAttribute("href")
    console.log("  CSV 链接 href:", csvHref)
    check("CSV 链接含 /interview 前缀", csvHref && csvHref.includes("/interview/api/export"))
    const [csvDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.click('a[href*="/api/export?format=csv"]'),
    ])
    const csvPath = await csvDownload.path()
    const csvBuf = fs.readFileSync(csvPath)
    console.log(`  CSV 文件名: ${csvDownload.suggestedFilename()}, 大小: ${csvBuf.length} bytes`)
    check("CSV 可正常下载", csvDownload.suggestedFilename().endsWith(".csv") && csvBuf.length > 0)
  } catch (err) {
    FAIL++
    console.error("测试出错:", err.message)
  } finally {
    await browser.close()
  }

  console.log(`\n============= 结果 =============`)
  console.log(`  通过: ${PASS} | 失败: ${FAIL}`)
  console.log(`=================================`)
  process.exit(FAIL > 0 ? 1 : 0)
})()
