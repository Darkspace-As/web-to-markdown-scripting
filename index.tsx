import { Script } from "scripting"
import { fetchArticle, safeFileName } from "./extractor"

async function main() {
  const input = await Dialog.prompt({
    title: "网页转 Markdown",
    message: "输入文章 URL",
    placeholder: "https://example.com/article",
    confirmLabel: "提取",
    cancelLabel: "取消",
    keyboardType: "URL",
  })
  if (!input?.trim()) {
    Script.exit()
    return
  }

  const mode = await Dialog.prompt({
    title: "输出方式",
    message: "输入 copy、save 或 both（默认 both）",
    defaultValue: "both",
    placeholder: "both",
    confirmLabel: "继续",
    cancelLabel: "取消",
  })
  if (mode === null) {
    Script.exit()
    return
  }

  try {
    const article = await fetchArticle(input.trim())
    const selected = mode.trim().toLowerCase() || "both"
    const shouldCopy = selected === "copy" || selected === "both"
    const shouldSave = selected === "save" || selected === "both"
    if (!shouldCopy && !shouldSave) throw new Error("输出方式只能是 copy、save 或 both")

    let saved = ""
    if (shouldCopy) await Pasteboard.setString(article.markdown)
    if (shouldSave) {
      const stamp = new Date().toISOString().slice(0, 10)
      saved = `${safeFileName(article.title)}-${stamp}.md`
      await FileManager.writeAsString(`${FileManager.documentsDirectory}/${saved}`, article.markdown)
    }
    await Dialog.alert({
      title: article.quality < 25 ? "提取完成（质量较低）" : "提取完成",
      message: `${article.title}\n质量评分：${article.quality}/100\n${shouldCopy ? "已复制到剪贴板。\n" : ""}${saved ? `已保存：${saved}` : ""}`,
      buttonLabel: "好",
    })
  } catch (error) {
    await Dialog.alert({
      title: "提取失败",
      message: `${error instanceof Error ? error.message : String(error)}\n\n页面可能需要登录、JavaScript 渲染或受到反爬限制。`,
      buttonLabel: "好",
    })
  }
  Script.exit()
}

main()
