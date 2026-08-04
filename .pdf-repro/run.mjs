import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, "out")
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: "C:/Users/siyua/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
})
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()
page.on("console", (m) => console.log("[page]", m.type(), m.text()))

await page.goto(`file://${path.join(__dirname, "repro.html").replace(/\\/g, "/")}`)
await page.waitForFunction(() => window.__modes && window.__run)

const results = {}
for (const mode of [0, 1, 2, 3, 5]) {
  const dlPromise = page.waitForEvent("download", { timeout: 60000 })
  await page.evaluate((m) => window.__run(m), mode)
  const dl = await dlPromise
  const dest = path.join(outDir, dl.suggestedFilename())
  await dl.saveAs(dest)
  const size = fs.statSync(dest).size
  results[mode] = { file: dl.suggestedFilename(), size }
  console.log(`mode${mode}: saved ${dl.suggestedFilename()} (${size} bytes)`)
}
await browser.close()

// 分析每个 PDF 是否有实质内容
import { extractText } from "unpdf"
for (const mode of [0, 1, 2, 3, 5]) {
  const r = results[mode]
  const buf = fs.readFileSync(path.join(outDir, r.file))
  try {
    const { totalPages, text } = await extractText(new Uint8Array(buf))
    const joined = text.map((t) => t).join("\n").trim()
    r.pages = totalPages
    r.textLength = joined.length
    r.textPreview = joined.slice(0, 120).replace(/\s+/g, " ")
    console.log(`mode${mode}: pages=${totalPages} textLen=${joined.length} preview="${r.textPreview}"`)
  } catch (e) {
    r.error = String(e)
    console.log(`mode${mode}: extract error ${e}`)
  }
}

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(results, null, 2))
console.log("done")
