export type Article = {
  url: string
  title: string
  author: string
  date: string
  description: string
  text: string
  markdown: string
  quality: number
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function cleanText(value: string): string {
  return decodeEntities(value).replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

function stripTags(html: string): string {
  return cleanText(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/(div|section|article|li|h[1-6]|blockquote|pre)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
}

function firstMatch(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return cleanText(stripTags(match[1]))
  }
  return ""
}

function removeNoise(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|nav|footer|header|aside|form|button|figure)[^>]*>[\s\S]*?<\/\1>/gi, "")
}

type Candidate = { html: string; score: number; blocks: string[] }

function blocksFrom(html: string): string[] {
  const result: string[] = []
  const pattern = /<(p|h[2-6]|li|blockquote|pre|div)[^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    const text = stripTags(match[2])
    if (text.length >= 25 && text.length <= 3000) {
      if (!result.includes(text)) result.push(text)
    }
  }
  return result
}

function scoreCandidate(html: string, blocks: string[]): number {
  const textLength = blocks.join(" ").length
  const paragraphs = blocks.length
  const punctuation = (html.match(/[，。！？；：,.!?;:]/g) || []).length
  const links = (html.match(/<a\b/gi) || []).length
  const noiseWords = (html.match(/(推荐|相关阅读|热门|评论|登录|注册|广告|subscribe|related|sidebar)/gi) || []).length
  return Math.round(textLength / 20 + paragraphs * 15 + punctuation * 2 - links * 5 - noiseWords * 8)
}

function chooseContent(source: string): { blocks: string[]; quality: number } {
  const candidates: Candidate[] = []
  const patterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<(?:div|section)[^>]+(?:article|entry-content|post-content|article-body|正文|内容)[^>]*>([\s\S]*?)<\/(?:div|section)>/gi,
  ]
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source))) {
      const blocks = blocksFrom(match[1])
      if (blocks.length) candidates.push({ html: match[1], blocks, score: scoreCandidate(match[1], blocks) })
    }
  }
  const fallbackBlocks = blocksFrom(source)
  if (fallbackBlocks.length) candidates.push({ html: source, blocks: fallbackBlocks, score: scoreCandidate(source, fallbackBlocks) })
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  return best ? { blocks: best.blocks, quality: Math.max(1, Math.min(100, best.score)) } : { blocks: [], quality: 0 }
}

function toMarkdown(title: string, author: string, date: string, description: string, blocks: string[]): string {
  const lines = [`# ${title}`]
  if (author) lines.push(`\n作者：${author}`)
  if (date) lines.push(`\n日期：${date}`)
  if (description) lines.push(`\n> ${description.replace(/\n/g, " ")}`)
  lines.push("\n" + blocks.join("\n\n"))
  return lines.join("").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

export function extractArticle(html: string, url: string): Article {
  const source = removeNoise(html)
  const title = firstMatch(source, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || "未命名文章"
  const author = firstMatch(source, [
    /<meta[^>]+(?:name|property)=["'](?:author|article:author)["'][^>]+content=["']([^"']+)/i,
    /(?:class|id)=["'][^"']*(?:author|byline)[^"']*["'][^>]*>([\s\S]*?)<\//i,
  ])
  const date = firstMatch(source, [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i,
    /<time[^>]+datetime=["']([^"']+)/i,
    /<meta[^>]+name=["'](?:date|pubdate|publishdate)["'][^>]+content=["']([^"']+)/i,
  ])
  const description = firstMatch(source, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i,
  ])
  const chosen = chooseContent(source)
  const blocks = chosen.blocks.length ? chosen.blocks : [stripTags(source).slice(0, 12000)]
  const text = blocks.join("\n\n")
  return { url, title, author, date, description, text, quality: chosen.quality, markdown: toMarkdown(title, author, date, description, blocks) }
}

export async function fetchArticle(url: string): Promise<Article> {
  const result = await WebScraper.load({ url, timeout: 30 })
  if (!result.ok || !result.html) throw new Error(`网页请求失败：${result.error?.message || "无法读取 HTML"}`)
  return extractArticle(result.html, result.url || url)
}

export function safeFileName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "article"
}
