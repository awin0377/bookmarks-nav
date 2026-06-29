# 📚 Bookmarks Nav — AI 驱动全栈书签导航

基于 **Next.js 14 + Neon PostgreSQL + DeepSeek AI** 的私人书签导航系统，将杂乱浏览器书签转化为结构化、可搜索、可 AI 洗数的 SaaS 工具聚合站。

> 在线演示：https://bookmarks-nav.vercel.app

---

## ✨ 功能特性

### 🔍 AI 智能能力
- **自然语言搜索** —— 用「前端开发工具」这样的日常描述来搜索书签，AI 语义匹配而非关键词筛选
- **智能导入** —— 粘贴 URL，AI 自动抓取网页标题、判断所属分类、生成 SEO 描述
- **批量 AI 洗数** —— 后台一键挂机，DeepSeek 逐条分析 1000+ 书签，自动分类 + 打标签 + 写描述

### 🗂️ 分类与导航
- **拖拽排序分类** —— 侧边栏分类按住鼠标上下拖动，松手自动保存排序到数据库
- **批量管理** —— 多选模式：批量删除、批量移动到其他分类
- **面包屑导航** —— `首页 > AI平台` 层级式路径，随分类筛选联动
- **页脚站点地图** —— 按分类网格展示热门工具，一键直达

### 🎨 视觉与交互
- **卡片微渐变** —— 每张卡片使用对应分类的渐变色背景，提升视觉层次
- **常用书签面板** —— `/dashboard` 按分类展示高频书签，Apple 风格清新设计
- **管理按钮** —— 鼠标悬浮卡片显示置顶/删除按钮，React 状态机驱动
- **自适应网格** —— `auto-fill + minmax` 响应式布局，无论宽屏还是手机都整齐

### ⚙️ 工程与运维
- **密码保护** —— 简单密码登录，30 天有效 Cookie
- **死链巡检** —— Vercel Cron 每周自动检测失效链接
- **点击统计** —— 记录点击次数，展示最近访问
- **API 限流** —— AI 接口 5 次/分钟/IP 防滥用
- **骨架屏** —— 加载时优雅的占位动画
- **CSS 无 !important** —— 全局零 `!important` 规则，样式冲突最小化

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 14 (App Router) | React 全栈框架 |
| 语言 | TypeScript | `strict: false` 渐进式 |
| 样式 | Tailwind CSS 3.4 | 原子化 CSS + 内联 style 增强 |
| 数据库 | Neon PostgreSQL (Serverless) | `@neondatabase/serverless` 驱动 |
| AI | DeepSeek API | OpenAI 兼容格式，`deepseek-chat` 模型 |
| 拖拽 | @dnd-kit/core + sortable | 轻量级 React 拖拽库 |
| 部署 | Vercel | 香港节点 `hkg1` |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- Neon 数据库账号（免费额度够用）
- DeepSeek API Key（openai 兼容）

### 1. 克隆项目

```bash
git clone https://github.com/awin0377/bookmarks-nav.git
cd bookmarks-nav
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```bash
# Neon PostgreSQL 连接串
DATABASE_URL=postgresql://neondb_owner:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# DeepSeek API Key
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 后台访问密码
PASSWORD=大轩666

# 定时任务密钥（可选，死链巡检用）
CRON_SECRET=your-random-secret-here
```

### 4. 数据库建表

```bash
npm run db:migrate
```

创建 `categories`、`bookmarks`、`clicks` 三张表及索引。

### 5. 导入初始数据

将浏览器导出书签 HTML 放到项目根目录，或使用 `scripts/seed.js` 从 JSON 导入：

```bash
npm run db:seed
```

### 6. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

---

## 📦 部署到 Vercel

1. 推送代码到 GitHub
2. Vercel 导入仓库 → 自动识别 Next.js 框架
3. 在 Vercel Dashboard 配置上面的 4 个环境变量
4. 部署完成后设置 Vercel Cron Job（死链巡检）

已配置 `vercel.json`：
- 区域：香港 `hkg1`（大陆访问快）
- 定时任务：每周一凌晨 3 点死链巡检

---

## 📁 项目结构

```
bookmarks-nav/
├── app/
│   ├── api/                        # 后端 API（Next.js Route Handlers）
│   │   ├── ai/
│   │   │   ├── search/route.ts     # AI 语义搜索
│   │   │   ├── summary/route.ts    # AI 生成描述
│   │   │   ├── classify/route.ts   # AI 批量分类
│   │   │   └── classify-single/
│   │   │       └── route.ts        # AI 单条洗数（自动写回 DB）
│   │   ├── auth/login/route.ts     # 密码登录
│   │   ├── bookmarks/
│   │   │   ├── route.ts            # 书签列表 / 新增
│   │   │   └── [id]/
│   │   │       ├── route.ts        # 书签编辑 / 删除
│   │   │       └── feature/
│   │   │           └── route.ts    # 常用书签切换
│   │   ├── batch-bookmarks/
│   │   │   └── route.ts            # 批量删除 / 批量移动分类
│   │   ├── categories/
│   │   │   ├── route.ts            # 分类列表 / 新增
│   │   │   └── reorder/route.ts    # 分类拖拽排序
│   │   ├── save-bookmarks/
│   │   │   └── route.ts            # 批量同步（删除+排序）
│   │   ├── clicks/route.ts         # 点击统计
│   │   ├── cron/check-links/
│   │   │   └── route.ts            # 死链巡检
│   │   ├── fetch-title/route.ts    # 抓取网页标题
│   │   ├── health/route.ts         # 健康检查
│   │   └── import/route.ts         # AI 智能导入
│   ├── admin/page.tsx              # 后台管理 + AI 洗数控制台
│   ├── dashboard/page.tsx          # 常用书签面板
│   ├── tools/page.tsx              # 工具集（分类管理 + 批量操作）
│   ├── login/page.tsx              # 登录页面
│   ├── page.tsx                    # 主页（书签浏览 + AI 搜索）
│   ├── layout.tsx                  # 根布局
│   └── globals.css                 # 全局样式
├── lib/
│   ├── db.ts                       # Neon 数据库封装（tagged template）
│   └── ai.ts                       # DeepSeek AI 客户端（OpenAI 兼容）
├── scripts/
│   ├── migrate.js                  # 数据库建表脚本
│   ├── seed.js                     # 书签导入脚本
│   ├── migrate-featured.js         # 常用书签字段迁移
│   └── migrate-seo-fields.js       # SEO 字段迁移
├── middleware.ts                    # 认证中间件 + API 限流
├── next.config.js                  # Next.js 配置
├── tailwind.config.js              # Tailwind CSS 配置
├── tsconfig.json                   # TypeScript 配置
├── vercel.json                     # Vercel 部署配置
├── .env.local.example              # 环境变量模板
└── package.json
```

---

## 🗄️ 数据库设计

### categories（分类）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 主键 |
| name | TEXT UNIQUE | 分类名称 |
| icon | TEXT | 图标（emoji） |
| sort_order | INTEGER | 拖拽排序序号 |

### bookmarks（书签）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 主键 |
| url | TEXT UNIQUE | 网址 |
| title | TEXT | 标题 |
| domain | TEXT | 域名 |
| category_id | FK → categories | 所属分类 |
| icon | TEXT | favicon 地址 |
| summary | TEXT | AI 生成的简要描述 |
| description | TEXT | AI 生成的 SEO 描述 |
| tags | TEXT[] | AI 标签数组 |
| is_featured | BOOLEAN | 是否常用 |
| sort_order | INTEGER | 排序序号 |
| is_dead | BOOLEAN | 是否死链 |
| last_checked | TIMESTAMPTZ | 最后检测时间 |
| created_at | TIMESTAMPTZ | 创建时间 |

### clicks（点击统计）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 主键 |
| bookmark_id | FK → bookmarks | 书签 |
| clicked_at | TIMESTAMPTZ | 点击时间 |

---

## 🔌 API 接口速查

| 方法 | 路径 | 说明 | 需认证 |
|------|------|------|--------|
| GET | `/api/bookmarks` | 获取书签列表（支持分页/搜索/分类/排序） | ✅ |
| POST | `/api/bookmarks` | 新增书签 | ✅ |
| PATCH | `/api/bookmarks/[id]` | 编辑书签字段 | ✅ |
| DELETE | `/api/bookmarks/[id]` | 删除书签 | ✅ |
| GET | `/api/categories` | 获取分类列表（含书签数） | ✅ |
| GET | `/api/ai/search?q=自然语言` | AI 语义搜索 | ✅ |
| POST | `/api/ai/summary` | AI 生成书签描述 | ✅ |
| POST | `/api/ai-classify` | AI 批量分类 | ✅ |
| POST | `/api/ai-classify-single` | AI 单条洗数（写入 DB） | ✅ |
| POST | `/api/import` | AI 智能导入 | ✅ |
| POST | `/api/save-bookmarks` | 批量同步（删除+排序） | ✅ |
| POST | `/api/batch-bookmarks` | 批量操作（删除/移动分类） | ✅ |
| POST | `/api/categories/reorder` | 分类拖拽排序 | ✅ |
| POST | `/api/fetch-title` | 抓取网页标题 | ✅ |
| GET | `/api/cron/check-links` | 死链巡检（CRON_SECRET） | 🔐 |
| GET | `/api/health` | 健康检查 | ❌ |

---

## 🎯 使用指南

### 日常浏览（主页 `/`）

- 左侧分类栏切换分类，顶部搜索框输入关键词实时过滤
- 按 `/` 键打开全屏搜索，输入自然语言：「视频生成工具」「API 平台」
- 鼠标悬浮卡片可以复制链接或查看描述

### 工具管理（`/tools`）

- **分类拖拽**：左侧分类栏鼠标按住拖拽排序，松手自动保存
- **批量管理**：点击顶部「✏️ 批量管理」，勾选卡片 → 批量删除或移动到其他分类
- **保存修改**：拖拽排序后点击「💾 保存修改」同步到数据库

### 后台洗数（`/admin`）

- **AI 智能导入**：粘贴网址，AI 自动抓取标题、匹配分类、写描述
- **一键挂机洗数**：点击「▶️ 开始洗数」，DeepSeek 逐条分析「其他存档」分类的书签，自动归类 + 打标签 + 写 SEO 描述。支持暂停/继续/停止，进度实时显示

### 常用面板（`/dashboard`）

- 按分类分组展示已标记为「常用」的书签
- 快速添加新书签，AI 自动生成描述

---

## ⚙️ 配置说明

| 环境变量 | 必填 | 说明 |
|----------|------|------|
| DATABASE_URL | ✅ | Neon 数据库连接串 |
| DEEPSEEK_API_KEY | ✅ | DeepSeek/OpenAI 兼容 API Key |
| PASSWORD | ✅ | 后台访问密码 |
| CRON_SECRET | 可选 | Vercel Cron 鉴权密钥 |

### 切换到 OpenAI / 其他兼容模型

编辑 `lib/ai.ts`，修改 `baseURL` 和 `model`：

```typescript
_client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',    // 换成你的 API 地址
});
// ...
model: 'gpt-4o-mini',                       // 换成你的模型名
```

---

## 🔧 常用命令

```bash
npm run dev           # 启动开发服务器 → http://localhost:3000
npm run build         # 生产构建
npm run start         # 启动生产服务器
npm run db:migrate    # 初始化数据库表
npm run db:seed       # 导入书签数据
```

---

## 📝 License

MIT

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) · React 全栈框架
- [Neon](https://neon.tech/) · Serverless PostgreSQL
- [DeepSeek](https://www.deepseek.com/) · 高性价比 AI 模型
- [Vercel](https://vercel.com/) · 边缘部署平台
- [dnd-kit](https://dndkit.com/) · React 拖拽库
