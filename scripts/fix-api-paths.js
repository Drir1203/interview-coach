const fs = require("fs")

const files = [
  "src/app/page.tsx",
  "src/app/interviews/page.tsx",
  "src/app/interviews/[id]/page.tsx",
  "src/app/interviews/new/page.tsx",
  "src/app/interviews/[id]/edit/page.tsx",
  "src/app/companies/page.tsx",
  "src/app/analysis/page.tsx",
  "src/app/practice/page.tsx",
  "src/app/practice/session/page.tsx",
  "src/app/auth/register/page.tsx",
  "src/components/AudioRecorder.tsx",
]

for (const f of files) {
  let c = fs.readFileSync(f, "utf8")

  // 替换所有 fetch 调用的 /api/ 为 /interview/api/
  c = c.replace(/fetch\("\/api\//g, 'fetch("/interview/api/')
  c = c.replace(/fetch\(`\/api\//g, "fetch(`/interview/api/")

  fs.writeFileSync(f, c)
  console.log("✅", f)
}

console.log("完成")
