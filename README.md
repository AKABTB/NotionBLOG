# NotionBLOG

一个由 **Notion 官方 API** + **Next.js（Pages Router）** 驱动的个人博客：内容全部存在 Notion 数据库里，网站实时拉取并渲染，配合 ISR 保持新鲜——**改完 Notion 无需重新部署**。

> ## 关于本项目
>
> 本项目基于 **[Codgi-123/Notion-Blog](https://github.com/Codgi-123/Notion-Blog)** 进行**二次开发**，在其基础上做了本地化改造与若干修复（见下方[「二开改动」](#二开改动)）。原项目本身又受 [notion-next](https://github.com/tangly1024/NotionNext) 启发——但与 notion-next 通过非官方的 `notion-client` 抓取公开页面不同，本项目使用官方的 `@notionhq/client` 按数据库结构读取内容，并用自写的 React 渲染器渲染 Notion 的内容块（block）。
>
> 特此致谢原作者 [Codgi-123](https://github.com/Codgi-123) 与 [tangly1024](https://github.com/tangly1024)。

---

## 目录

- [架构](#架构)
- [快速开始](#快速开始)
- [Notion 数据库标准](#notion-数据库标准)
  - [属性（列）标准](#属性列标准)
  - [`type` 的语义](#type-的语义)
  - [`status` 与可见性](#status-与可见性)
  - [导航（Menu / SubMenu）规则](#导航menu--submenu规则)
  - [分类与标签](#分类与标签)
  - [Config 配置中心](#config-配置中心)
- [导航顺序的维护](#导航顺序的维护)
- [常用命令](#常用命令)
- [部署（Vercel）](#部署vercel)
- [二开改动](#二开改动)

---

## 架构

```
blog.config.js          站点配置 + Notion 属性名映射（改动最频繁）
lib/notion.ts           官方 Notion API 数据层（含网络重试）
lib/notionOrder.ts      导航拖拽顺序：构建时快照，运行时读 menu-order.json
lib/types.ts            归一化的 Post 类型 + 内容块辅助函数
lib/menu-order.json     导航顺序快照（由 npm run snapshot:order 生成）
components/
  NotionBlock.tsx       内容块分发器（段落、标题、列表、代码、公式…）
  RichText.tsx          富文本注解 + 颜色 + 链接
  Layout / PostCard     UI 外壳
pages/
  index.tsx             首页 / 文章列表（getStaticProps + ISR）
  article/[slug].tsx    文章详情（getStaticPaths + ISR）
  [slug].tsx            独立页面（type=Page）
  category/、tag/        分类页、标签页（动态生成）
  api/notion-image/     Notion 图片代理
scripts/                Notion 工具脚本（探查结构、定位库、抓顺序快照…）
```

---

## 快速开始

1. **创建 Notion 集成**：前往 <https://www.notion.so/my-integrations>，新建 Internal 集成，复制其密钥（`ntn_...` 或 `secret_...`）。
2. **把数据库连接到集成**：打开你的博客数据库页面 → 右上角 `•••` → **「+ Add connections（连接）」** → 选中你的集成。
   > ⚠️ 这一步最容易漏，且绕不开——授权是按工作区授予的。不连接会报 `403 / object_not_found`。
3. **配置环境变量**：
   ```bash
   cp .env.local.example .env.local
   # 填入 NOTION_TOKEN；NOTION_DATABASE_ID 可用下方 notion:find 自动写入
   ```
4. **安装依赖，自动定位数据库并核对结构**：
   ```bash
   npm install
   npm run notion:find     # 用 search API 定位数据库，写回 NOTION_DATABASE_ID
   npm run notion:schema   # 打印列名/类型，核对是否与 blog.config.js 一致
   ```
5. **本地运行**：
   ```bash
   npm run dev             # http://localhost:3000
   ```

> 详细的一键部署流程（含模板复制、Vercel CLI 部署）见 [SETUP-GUIDE-FOR-AI.md](SETUP-GUIDE-FOR-AI.md)。

---

## Notion 数据库标准

整个博客只用**一个 Notion 数据库**。每一行代表一条内容，靠 **`type` 属性**区分它是文章、页面、菜单还是配置。以下是本项目约定的字段标准。

### 属性（列）标准

官方 API **按名称**返回属性，因此列名必须与 [blog.config.js](blog.config.js) 的 `properties` 映射一致（默认同名）。缺失的列会被优雅降级，不影响运行。

| 属性名 | Notion 类型 | 作用 | 备注 |
|--------|-------------|------|------|
| `title` | **Title** | 标题 | 每个库必有的标题列 |
| `slug` | Rich text | URL 片段 | 文章 → `/article/<slug>`；为空时回退到页面 id |
| `status` | Select | 发布状态 | 仅特定值可见，见下 |
| `type` | Select | **内容类型** | 决定这行是什么，见下 |
| `summary` | Rich text | 摘要 | 显示在卡片/首页 |
| `category` | Select | 分类（单选） | 动态生成 `/category/<值>` |
| `tags` | Multi-select | 标签（多选） | 动态生成 `/tag/<值>` |
| `date` | Date | 发布日期 | 文章按此**降序**排列；为空回退到创建时间 |
| `icon` | Rich text | 图标 | FontAwesome 类名，如 `fas fa-home`，用于菜单 |
| `password` | Rich text | （预留） | 当前未启用 |

> 可选：给库加一个 **Number** 列（如 `order`），并在 `blog.config.js` 的 `properties.order` 填入其列名，即可用数字**精确控制菜单顺序**（官方 API 读不到拖拽顺序，见[导航顺序的维护](#导航顺序的维护)）。

### `type` 的语义

`type`（Select）是核心字段，取值及其效果：

| type | 含义 | 出现在哪里 / 路由 |
|------|------|-------------------|
| **Post** | 📝 博客文章 | 首页文章列表、`/article/<slug>` |
| **Page** | 📄 独立页面 | 不进文章列表，靠 `/<slug>` 访问；**同时会出现在顶部导航** |
| **Menu** | 🔗 顶级导航项 | 网站顶部导航栏 |
| **SubMenu** | 🔽 二级下拉项 | 挂在紧邻其前的顶级项（Menu 或 Page）下 |
| **Notice** | 📢 站点公告 | 公告区 |
| **Config** | ⚙️ 配置中心 | 不显示，内嵌 CONFIG-TABLE 子表，见下 |
| **Friends** | 🤝 友情链接 | 首页友链区 |
| **About** | 👤 关于我 | 首页「关于我」区 |

> 注意：`Page` 与 `Menu` 在导航栏里被同等对待，都会成为一个可带下拉的顶级项——区别只是 `Page` 还能作为独立页面被 `/<slug>` 访问。

### `status` 与可见性

**只有 `status` ∈ {`Published`, `Public`, `已发布`} 的行才会出现在网站上**（可在 `blog.config.js` 的 `publishedStatuses` 调整）。其余状态（如 `Draft`）会被完全隐藏。若某行没有 `status` 列，则默认视为已发布。

### 导航（Menu / SubMenu）规则

- 顶级导航项 = 所有 `Menu` 和 `Page` 类型的已发布行。
- 每个 `SubMenu` 会自动挂到**在它之前、离它最近的那个顶级项**下面（沿用 notion-next 规则）。
- 因此**行的排列顺序很重要**——想让某几个 SubMenu 归到某个 Menu 下，就把它们排在那个 Menu 的正下方。
- `slug` 解析：`http(s)://` 开头视为外链；`/` 开头视为站内绝对路径；`#` 表示纯下拉不跳转；空表示首页。

### 分类与标签

`category`（单选）与 `tags`（多选）的值**完全从 Notion 动态读取，无硬编码**：

- 每个不同的 `category` 值自动生成 `/category/<值>` 聚合页，`/category` 为总览。
- 每个不同的 `tag` 值自动生成 `/tag/<值>` 聚合页，`/tag` 为总览。
- 你在 Notion 里随意增删改这些值即可，网站会自动跟上（ISR 刷新后生效），无需改代码。
- 文章卡片在 `category` 为空时兜底显示「随笔」。

### Config 配置中心

`type=Config` 的行内嵌一个子数据库 **CONFIG-TABLE**，用于在 Notion 里覆盖 `blog.config.js` 的默认值（优先级最高）。其列（可在 `blog.config.js` 的 `configTable` 调整）：

| 列名 | 类型 | 作用 |
|------|------|------|
| `配置名` | Title | 配置键，如 `TITLE` / `AUTHOR` / `DESCRIPTION` / `LINK` / `KEYWORDS` / `BLOG_FAVICON` / `BIO` / `GLOBAL_CSS` |
| `配置值` | Rich text | 对应的值 |
| `启用` | Checkbox | **仅勾选的行生效** |

用 `npm run notion:config` 可打印当前 CONFIG-TABLE 的全部行。

---

## 导航顺序的维护

官方 API **读不到数据库视图的手动拖拽顺序**，所以本项目在**构建时**（`prebuild`）用私有 API 抓取一次顺序，烘焙进 [lib/menu-order.json](lib/menu-order.json)；运行时只读这个快照，从不实时请求（那样在 serverless 上太不稳定）。

**维护流程（改顺序时）：**

```
① 在 Notion 的「Table」视图里拖动行，调整顺序
   （只有 blog.config.js 里 orderViewName 指定的那个视图算数，默认 Table）
② npm run snapshot:order    # 重新生成 menu-order.json
③ 重启 dev / 重新部署        # 快照在启动/构建时读入，方能生效
```

抓快照需要私有 API 凭证，在 `.env.local` 里填 `NOTION_TOKEN_V2` + `NOTION_ACTIVE_USER`（浏览器 cookie，会过期）；或改用上文提到的 `order` 数字列来绕开。

---

## 常用命令

```bash
npm run dev            # 本地开发（http://localhost:3000）
npm run build          # 生产构建（prebuild 会跑 snapshot:order）
npm start              # 启动生产服务
npm run typecheck      # tsc --noEmit 类型检查
npm run lint           # ESLint

# Notion 工具脚本
npm run notion:find    # 用 search API 定位数据库，写回 NOTION_DATABASE_ID
npm run notion:schema  # 打印数据库列名/类型
npm run notion:views   # 列出数据库视图名（用于 orderViewName）
npm run notion:config  # 打印 CONFIG-TABLE 现状
npm run snapshot:order # 重新抓取导航顺序快照
```

---

## 部署（Vercel）

**方式一（推荐，自动部署）**：把本仓库导入 Vercel（Import Project），设置环境变量 `NOTION_TOKEN` 和 `NOTION_DATABASE_ID`，之后每次 `git push` 都会自动重新部署。

**方式二（CLI 本地部署）**：`npx vercel login` → `vercel link` → `vercel env add` → `npx vercel --prod`。详见 [SETUP-GUIDE-FOR-AI.md](SETUP-GUIDE-FOR-AI.md)。

> 环境变量只需 `NOTION_TOKEN` + `NOTION_DATABASE_ID`。导航顺序用本地已生成的 `menu-order.json`，无需把 cookie（`NOTION_TOKEN_V2` 等）传上 Vercel。
>
> ISR（`blog.config.js` 的 `revalidate`，默认 60 秒）让内容在不重新部署的情况下保持新鲜。

---

## 二开改动

相对 [Codgi-123/Notion-Blog](https://github.com/Codgi-123/Notion-Blog) 原项目，本仓库做了以下改动：

- **网络重试**：[lib/notion.ts](lib/notion.ts) 给 Notion 客户端注入带指数退避的 `fetch`，自动重试 `ECONNRESET` / 超时等瞬时网络错误，缓解跨境访问 `api.notion.com` 的抖动。
- **脚本环境变量修复**：`scripts/notion-views.ts`、`scripts/snapshot-order.ts` 原先未加载 `.env.local`，补上 `dotenv` 加载后 `notion:views` / `snapshot:order` 才能正常运行。
- **导航顺序快照修正**：原 `menu-order.json` 存的是上游库的行 id，与新库对不上导致导航退化为 API 默认序；重新抓取生成了属于本库的快照，导航恢复正确顺序。
- **文档**：README 重写为中文，补充上述 Notion 数据库标准与维护流程。
