import { Intent, Script } from "scripting"
import { fetchArticle, safeFileName } from "./extractor"

function resolveURL(): string | null {
  if (typeof Script.queryParameters?.url === "string" && Script.queryParameters.url.trim()) {
    return Script.queryParameters.url.trim()
  }
  if (Intent.urlsParameter?.length) return Intent.urlsParameter[0]
  for (const text of Intent.textsParameter || []) {
    const match = text.match(/https?:\/\/[^\s<>"']+/i)
    if (match) return match[0].replace(/[),.;!?]+$/, "")
  }
  const parameter = Intent.shortcutParameter
  if (parameter?.type === "text" && typeof parameter.value === "string") {
    const match = parameter.value.match(/https?:\/\/[^\s<>"']+/i)
    return match ? match[0].replace(/[),.;!?]+$/, "") : null
  }
  if (parameter?.type === "fileURL" && typeof parameter.value === "string") {
    const match = parameter.value.match(/https?:\/\/[^\s<>"']+/i)
    return match ? match[0].replace(/[),.;!?]+$/, "") : null
  }
  return null
}

async function run() {
  const url = resolveURL()
  if (!url) {
    Script.exit(Intent.text("未接收到有效的网页 URL"))
    return
  }
  try {
    const article = await fetchArticle(url.trim())
    const filePath = `${FileManager.documentsDirectory}/${safeFileName(article.title)}.md`
    await FileManager.writeAsString(filePath, article.markdown)
    Script.exit(Intent.text(article.markdown))
  } catch (error) {
    Script.exit(Intent.text(`提取失败：${error instanceof Error ? error.message : String(error)}`))
  }
}

run()
