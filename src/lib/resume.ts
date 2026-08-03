import { extractText, getDocumentProxy } from "unpdf"

export const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_RESUME_PAGES = 20

/**
 * 将 PDF 二进制解析为纯文本（全部页面合并为一段）。
 * 仅支持文本型 PDF；扫描件（图片型）解析不出文本会抛错。
 */
export async function parsePdfToText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  // 页数校验必须在 extractText 之前，避免整份解析完再报错
  if (pdf.numPages > MAX_RESUME_PAGES) {
    throw new Error(`PDF 页数过多（最多 ${MAX_RESUME_PAGES} 页）`)
  }
  const { text } = await extractText(pdf, { mergePages: true })
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("未能从 PDF 中提取到文本，请确认是文本型 PDF 而非扫描件")
  }
  return trimmed
}
