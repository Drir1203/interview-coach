import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  test: {
    environment: "node",
    // Windows + Node 24 下默认 threads pool 报 "Vitest failed to find the runner"，改用 forks 稳定
    pool: "forks",
    // 只收集 tests/unit/ 下单测，避免扫到 Next.js App Router 源码
    include: ["tests/unit/**/*.test.ts"],
    clearMocks: true,
  },
  resolve: {
    alias: { "@": r("./src") },
  },
})
