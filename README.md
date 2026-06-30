# 📚 书签导航网站

一个基于 Next.js 14 + Neon PostgreSQL + DeepSeek AI 的私人书签导航系统，支持 AI 智能搜索、分类管理、编辑模式、置顶排序等功能。

## ✨ 功能特性

- 🔍 **AI 智能搜索** — 用自然语言描述你想找什么，AI 帮你匹配书签
- 🔮 **AI 智能导入** — 输入网址，AI 自动抓取标题、判断分类、生成描述
- ✏️ **编辑模式** — 直接在前端编辑书签、移动分类、置顶/取消置顶
- 📂 **分类管理** — 侧边栏分类导航，支持重命名、拖拽排序
- 📄 **分页浏览** — 每页 100 条，告别上千书签卡顿
- 🛡️ **密码保护** — 私人使用，简单密码认证
- 🔗 **死链巡检** — 定时自动检测失效链接并标记
- 📊 **点击统计** — 记录书签点击次数，展示最近访问
- 📱 **响应式布局** — 桌面侧边栏 + 手机横向滚动分类

## 🛠️ 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS
- **数据库**: Neon PostgreSQL (Serverless)
- **AI**: DeepSeek API (OpenAI 兼容格式)
- **部署**: Vercel
- **语言**: TypeScript

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/bookmarks-nav.git
cd bookmarks-nav
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.local.example` 为 `.env.local`，填写以下变量：

```
DATABASE_URL=postgresql://user:***@xxx.neon.tech/db?sslmode=require
DEEPSEEK_API_KEY=***
PASSWORD=你的密码
CRON_SECRET=定时任务密钥（可选）
```

### 4. 初始化数据库

```bash
node scripts/migrate.js
```

### 5. 导入书签

准备一个 JSON 文件（格式：`{"categories": {"分类名": [{"url": "...", "title": "..."}]}}`），然后运行：

```bash
node scripts/seed2.js
```

### 6. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000` 查看效果。

## 📦 部署

### Vercel 部署（推荐）

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量（同上）
4. 自动部署完成！

### 环境变量说明

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DATABASE_URL` | Neon PostgreSQL 连接串 | ✅ |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | ✅ |
| `PASSWORD` | 后台登录密码 | ✅ |
| `CRON_SECRET` | 定时任务鉴权密钥 | ❌ |

## 📁 项目结构

```
bookmarks-nav/
├── app/
│   ├── api/              # API 路由
│   │   ├── auth/        # 登录认证
│   │   ├── bookmarks/   # 书签 CRUD
│   │   ├── categories/  # 分类管理
│   │   ├── import/      # AI 智能导入
│   │   ├── ai/          # AI 搜索
│   │   ├── clicks/      # 点击统计
│   │   ├── health/      # 健康检查
│   │   └── cron/        # 定时任务
│   ├── admin/           # 后台管理页面
│   ├── login/           # 登录页面
│   └── page.tsx         # 主页
├── lib/                  # 工具库
│   ├── db.ts            # 数据库封装
│   └── ai.ts            # AI 客户端
├── middleware.ts          # 中间件（认证 + 限流）
├── scripts/              # 脚本工具
│   ├── migrate.ts       # 建表
│   └── seed.ts          # 导入书签
└── next.config.js        # Next.js 配置
```

## 🔧 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build       # 构建生产版本
npm run start       # 启动生产服务器
```

## 📝 后台管理

访问 `/admin` 进入后台管理页面，功能包括：

- ➕ 手动添加书签
- 🔮 AI 智能导入（输入网址自动识别）
- 🗑️ 删除书签
- 📊 查看所有书签列表

## 📄 License

MIT

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Neon](https://neon.tech/)
- [DeepSeek](https://www.deepseek.com/)
- [Vercel](https://vercel.com/)
