# Mindful — Quiet Luxury Wellness

移动优先的健康管理应用，基于 Next.js 16 App Router + React 19 + Tailwind CSS v4 + Prisma 7。

## Tech Stack

- **框架**: Next.js 16 (Turbopack), React 19
- **样式**: Tailwind CSS v4, Material Design 3 色彩系统
- **数据库**: PostgreSQL 17 + pgvector + Prisma 7 (driver adapter)
- **对象存储**: MinIO (S3 兼容)
- **AI Chat**: AI Ping GLM-5.1 (OpenAI 兼容接口)
- **语音识别**: 火山引擎 (豆包) Streaming ASR

## 前置依赖

- Node.js >= 20
- pnpm
- PostgreSQL 17 + pgvector (本地 Docker 或云端如 Neon、Supabase 均可)
- MinIO 实例 (S3 兼容对象存储)

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备 PostgreSQL

**方式 A：本地 Docker**

```bash
docker run -d --name what-the-health \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg17
```

**方式 B：云端 (Neon / Supabase 等)**

在云平台创建 PostgreSQL 实例，获取连接字符串填入 `.env` 即可。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，参照 `.env.example` 中的注释填入必要的值。

### 4. 生成 Prisma Client

```bash
pnpm exec prisma generate
```

### 5. 应用数据库迁移

```bash
pnpm exec prisma migrate deploy
```

### 6. Seed 数据库

会创建种子用户、文章、商品等数据，并自动上传图片到 MinIO（bucket 不存在会自动创建）：

```bash
pnpm exec prisma db seed
```

### 7. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000，局域网设备可通过本机IP:3000 访问。

## 常用命令

```bash
pnpm dev           # 启动开发服务器 (Next.js + ASR Proxy)
pnpm build         # 生产构建
pnpm lint          # ESLint 检查
```

## 数据库操作

```bash
pnpm exec prisma generate       # 重新生成 Prisma Client
pnpm exec prisma migrate deploy  # 应用迁移
pnpm exec prisma db seed         # 运行 Seed
pnpm exec prisma migrate reset --force  # 完全重置 (drop → migrate → seed)
```

> ⚠️ `migrate reset` 会清空所有数据，仅用于开发环境。

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── api/                # API Routes
│   │   ├── assets/[...path]/ # S3 资源代理 (缓存1年)
│   │   ├── health/import/    # 健康数据导入 (preview + confirm)
│   │   ├── upload/avatar/    # 头像上传
│   │   └── ...
│   ├── chat/               # AI 对话
│   ├── discover/           # 社区文章 + 商城
│   ├── memory/             # 健康报告
│   └── profile/            # 个人中心
├── components/             # 共享组件
├── lib/                    # 工具库 (auth, prisma, s3, health-parsers)
└── server/                 # ASR WebSocket 代理
prisma/
├── schema.prisma           # 数据模型
├── migrations/             # 迁移文件 (只增不删)
├── assets/                 # Seed 静态资源 (图片)
├── seeders/                # Seed 脚本
└── seed.ts                 # Seed 入口
```

## 注意事项

- **迁移文件只增不删**，永远在已有迁移后追加新的
- 图片通过 `/api/assets/` 代理从 MinIO 读取，前端不直连 MinIO
- 确保 shell 中没有 `DATABASE_URL` / `DIRECT_URL` 环境变量覆盖 `.env`
