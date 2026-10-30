import {
  Button,
  List,
  Navigation,
  NavigationStack,
  Picker,
  ProgressView,
  ScrollView,
  Section,
  Text,
  TextField,
  VStack,
  useState,
  Script,
} from "scripting"
import { Article, fetchArticle, safeFileName } from "./extractor"

type OutputMode = "both" | "copy" | "save"

type MainViewProps = {
  initialURL?: string
}

function MainView({ initialURL = "" }: MainViewProps) {
  const dismiss = Navigation.useDismiss()
  const [url, setURL] = useState(initialURL)
  const [mode, setMode] = useState<OutputMode>("both")
  const modeIndex = mode === "both" ? 0 : mode === "copy" ? 1 : 2
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [article, setArticle] = useState<Article | null>(null)

  async function extract() {
    const target = url.trim()
    if (!target) {
      setMessage("请先输入网页 URL")
      return
    }
    if (!/^https?:\/\//i.test(target)) {
      setMessage("URL 必须以 http:// 或 https:// 开头")
      return
    }
    setLoading(true)
    setMessage("正在读取网页并提取正文…")
    setArticle(null)
    try {
      const result = await fetchArticle(target)
      setArticle(result)
      setMessage(`提取完成 · 质量评分 ${result.quality}/100`)
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : String(error)}\n可能需要登录、JavaScript 渲染或受到反爬限制。`)
    } finally {
      setLoading(false)
    }
  }

  async function output() {
    if (!article) return
    const shouldCopy = mode === "copy" || mode === "both"
    const shouldSave = mode === "save" || mode === "both"
    if (shouldCopy) await Pasteboard.setString(article.markdown)
    if (shouldSave) {
      const stamp = new Date().toISOString().slice(0, 10)
      const name = `${safeFileName(article.title)}-${stamp}.md`
      await FileManager.writeAsString(`${FileManager.documentsDirectory}/${name}`, article.markdown)
      setMessage(`${shouldCopy ? "已复制并" : "已"}保存：${name}`)
    } else {
      setMessage("Markdown 已复制到剪贴板")
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="网页转 Markdown"
        navigationBarTitleDisplayMode="inline"
        toolbar={{ cancellationAction: <Button title="关闭" action={dismiss} /> }}
      >
        <Section title="输入网页">
          <TextField
            title="URL"
            value={url}
            onChanged={setURL}
            onSubmit={loading ? undefined : extract}
            prompt="https://example.com/article"
          />
          {!loading ? <Button title="提取正文" action={extract} /> : null}
          {loading ? <ProgressView /> : null}
          {message ? <Text foregroundStyle="secondaryLabel">{message}</Text> : null}
        </Section>

        <Section title="输出方式">
          <Picker title="处理完成后" value={modeIndex} onChanged={(value: number) => setMode(value === 1 ? "copy" : value === 2 ? "save" : "both")} pickerStyle="segmented">
            <Text tag={0}>复制并保存</Text>
            <Text tag={1}>只复制</Text>
            <Text tag={2}>只保存</Text>
          </Picker>
          {article ? <Button title="输出 Markdown" action={output} /> : null}
        </Section>

        {article ? (
          <Section title="文章信息">
            <Text font="headline">{article.title}</Text>
            {article.author ? <Text foregroundStyle="secondaryLabel">作者：{article.author}</Text> : null}
            {article.date ? <Text foregroundStyle="secondaryLabel">日期：{article.date}</Text> : null}
            <Text foregroundStyle="secondaryLabel">正文质量：{article.quality}/100</Text>
          </Section>
        ) : null}

        {article ? (
          <Section title="Markdown 预览">
            <ScrollView>
              <VStack spacing={8}>
                <Text>{article.markdown}</Text>
              </VStack>
            </ScrollView>
          </Section>
        ) : null}
      </List>
    </NavigationStack>
  )
}

export { MainView }
export default MainView

async function run() {
  const initialURL = typeof Script.queryParameters?.url === "string" ? Script.queryParameters.url : ""
  await Navigation.present(<MainView initialURL={initialURL} />)
  Script.exit()
}

run()
