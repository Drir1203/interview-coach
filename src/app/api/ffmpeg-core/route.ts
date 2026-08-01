import { NextRequest } from "next/server"
import fs from "fs"
import path from "path"

// 本地提供 FFmpeg.wasm 核心文件（避免从 CDN 加载）
export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get("file") || "ffmpeg-core.js"
  const filePath = path.resolve(process.cwd(), "node_modules/@ffmpeg/core/dist/esm", filename)

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 })
  }

  const content = fs.readFileSync(filePath)
  const ext = path.extname(filename)
  const mimeTypes: Record<string, string> = {
    ".js": "text/javascript",
    ".wasm": "application/wasm",
  }

  return new Response(content, {
    headers: {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
