# Anthropic AI 新闻门户

中文报纸风 Anthropic 新闻聚合站，每日自动抓取、翻译、部署。

## 在线访问

- **Vercel**: [anthropic-ai-news.vercel.app](https://anthropic-ai-news.vercel.app)

## 架构

```
anthropic.com/sitemap.xml
  ↓ 解析 URL + lastmod
scripts/scraper.js
  ↓ 增量抓取（只处理新文章）
scripts/fetcher.js → cheerio 解析 HTML
  ↓ 提取标题、日期、正文、描述
scripts/translate.js → translatte 翻译为中文
  ↓ 写入 JSON
public/data/*.json
  ↓ 纯静态前端读取
public/index.html + app.js + styles.css
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | 纯 HTML/CSS/JS，无框架 |
| 爬虫 | cheerio + node-fetch + xml2js |
| 翻译 | translatte（Google Translate 免费接口） |
| 样式 | 报纸风：serif 字体、米色纸张底色、双栏排版 |
| 部署 | Vercel 静态站 |
| 自动化 | GitHub Actions（每日 CST 09:00） |

## 项目结构

```
├── scripts/
│   ├── scraper.js       # 主入口：调度抓取+翻译+存储
│   ├── sitemap.js        # 解析 sitemap.xml
│   ├── fetcher.js        # 单篇文章抓取+解析
│   └── translate.js      # 翻译+要点提取
├── public/
│   ├── index.html        # 门户首页
│   ├── styles.css        # 报纸风样式
│   ├── app.js            # 前端交互（侧边栏、数据卡片）
│   └── data/
│       ├── blog.json     # 博客文章数据
│       └── research.json # 研究文章数据
├── .github/workflows/
│   └── daily.yml         # 每日定时抓取
├── vercel.json
└── package.json
```

## 本地运行

```bash
npm install
npm run scrape    # 抓取最新文章
npm run serve     # 启动本地服务器 http://localhost:3000
```

## 自动更新流程

1. GitHub Actions 每日 CST 09:00 触发
2. 运行 `npm run scrape`（增量：对比 sitemap lastmod，只处理新文章）
3. Git commit + push 更新的 JSON
4. Vercel 检测到 push → 自动重新部署

## 功能特点

- **增量抓取**：对比 sitemap lastmod，只处理新增/更新的文章
- **全文翻译**：标题、描述、正文、关键要点全部翻译为中文
- **结构化展示**：核心要点（编号卡片）、关键数据（指标+口径）、原文摘录（引用块）
- **报纸美学**：首字下沉、serif 字体、双栏排版、侧边栏滑入阅读
- **响应式**：移动端单栏、侧边栏全屏

## 数据来源

所有内容来自 [anthropic.com](https://www.anthropic.com)，自动抓取 + 机器翻译，仅供参考。
