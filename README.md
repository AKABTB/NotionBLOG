# notionblog

一个从零搭建的博客，由 **Notion 官方 API** + **Next.js（Pages Router）** 驱动，灵感来自 [notion-next](https://github.com/tangly1024/NotionNext)。与 notion-next 不同（它通过非官方的 `notion-client` 抓取公开页面），本项目使用官方的 `@notionhq/client` 读取你的数据库，并用自写的 React 渲染器来渲染 Notion 的内容块（block）。

## 架构

```
blog.config.js          站点配置 + Notion 属性名映射
lib/notion.ts           官方 Notion API 数据层（文章、内容块）
lib/types.ts            归一化的 Post 类型 + 内容块辅助函数
components/
  NotionBlock.tsx       内容块分发器（段落、标题、列表、代码…）
  RichText.tsx          富文本注解 + 颜色 + 链接
  Layout / PostCard     UI 外壳
pages/
  index.tsx             文章列表（getStaticProps + ISR）
  [slug].tsx            文章详情（getStaticPaths + ISR）
scripts/introspect.ts   打印你的数据库结构，用于填写 blog.config.js
```

## 配置步骤

1. **创建 Notion 集成**：前往 <https://www.notion.so/my-integrations>，复制它的密钥（secret）。
2. **把数据库共享给该集成**：打开数据库 → `•••` → *Connections（连接）* → 添加你的集成。
3. 复制环境变量文件并填写：
   ```bash
   cp .env.local.example .env.local
   # 设置 NOTION_TOKEN；NOTION_DATABASE_ID 已为你的空间预填
   ```
4. 安装依赖并查看数据库结构，然后更新 `blog.config.js` 里的属性名使其匹配：
   ```bash
   npm install
   npm run notion:schema
   ```
5. 运行：
   ```bash
   npm run dev
   ```

## 部署（Vercel）

推送到一个 Git 仓库，在 Vercel 上导入，并把 `NOTION_TOKEN` 和 `NOTION_DATABASE_ID` 设为环境变量。ISR（`blog.config.js` 里的 `revalidate`）会在无需重新构建的情况下保持内容新鲜。

## 属性映射

官方 API 是**按名称**返回属性的，所以 `blog.config.js` 里的 `properties` 必须和你的列名完全一致。默认假设为：`Name`（标题）、`slug`、`status`、`summary`、`tags`、`category`、`date`、`type`。运行 `npm run notion:schema` 可查看你自己的列名；缺失的列会被优雅降级处理（不影响运行）。
