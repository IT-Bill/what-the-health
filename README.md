# WiTH — Quiet Luxury Wellness

WiTH（What the Health）是一款移动优先的 AI 健康陪伴应用，将健康数据、日常记录、个性化对话与家庭关怀连接在一起。界面采用 Quiet Luxury Wellness 设计语言。

## 功能概览

- **AI 健康对话**：支持文字、图片和语音输入，流式回复、工具调用展示、多会话管理，以及温柔陪伴者、健康教练、智慧导师三种角色。
- **个性化健康管理**：设置健康目标与身体参数，记录心情、习惯和饮食偏好，通过对话记录饮食、生成健康计划。
- **健康数据导入**：解析 Apple Health、华为运动健康、小米 / Zepp Life、Samsung Health、Google Fit 导出文件，支持预览、确认导入及记录管理；提供数据接入 API 和可穿戴设备模拟脚本。
- **记忆与报告**：结合健康数据和日常记录生成周报、月报；利用用户画像和向量记忆为后续对话提供上下文。
- **症状与医嘱记录**：记录症状、整理就诊记录、保存治疗方案与医嘱，设置用药、测量和复诊等提醒。
- **好友与家庭**：好友关系、分享权限、家庭成员管理、家庭健康查看与异常关怀通知。
- **社区与发现**：发布文章、评论、点赞和收藏，支持内容检索，并提供商品展示与积分相关功能。
- **通知与提醒**：通知中心、弹出通知、优先级管理，以及定时检查到期提醒的后台进程。

## 技术栈

| 层级 | 实现 |
| --- | --- |
| Web | Next.js 16.2.6 App Router、React 19、TypeScript |
| UI | Tailwind CSS v4、Lucide、Material Design 3 语义色彩 |
| 客户端状态 | Zustand、SWR |
| 数据库 | PostgreSQL 17、Prisma 7、`@prisma/adapter-pg` |
| 检索 | pgvector、pg_trgm、阿里云百炼 `text-embedding-v4` |
| AI Agent | `@earendil-works/pi-agent-core`、`pi-ai`；主对话使用 AI Ping 的 Kimi K2.6 |
| 语音 | 火山引擎（豆包）流式 ASR、TTS，独立 WebSocket 代理 |
| 存储 | MinIO / S3 兼容对象存储，经 `/api/assets/` 代理读取 |
| 登录 | JWT、HttpOnly Cookie、bcrypt 密码哈希 |

## 本地启动

### 1. 准备依赖

- Node.js **22.19+（22.x）或 24+**，满足当前 Agent SDK 与 Prisma 的运行要求。
- pnpm。
- PostgreSQL 17，支持 `vector`、`pgcrypto` 和 `pg_trgm` 扩展。
- 完整图片功能需要 MinIO 或其他 S3 兼容对象存储。

在仓库目录执行：

```bash
pnpm install
cp .env.example .env
```

### 2. 启动数据库

本地可使用带 pgvector 的 PostgreSQL 镜像：

```bash
docker run -d --name what-the-health \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -v wth-postgres:/var/lib/postgresql/data \
  pgvector/pgvector:pg17
```

也可使用支持上述扩展的云端 PostgreSQL。将应用连接填入 `DATABASE_URL`，迁移用的直连地址填入 `DIRECT_URL`；本地两者可相同。迁移会创建所需扩展，数据库账号需要相应权限。

### 3. 配置环境变量

以 [`.env.example`](.env.example) 为起点，按需要补充以下配置。`JWT_SECRET`、`TAVILY_API_KEY` 等部分变量尚未列入模板，可直接添加。

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | 应用数据库连接 / Prisma 迁移直连地址 |
| `SEED_USERS` | 演示用户，格式为 `username1:password1,username2:password2` |
| `JWT_SECRET` | 登录签名密钥；生产环境必须设置独立强随机值 |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | 对象存储地址与凭据 |
| `S3_BUCKET` / `S3_REGION` | 显式设置 bucket（如 `wth`）和 region（如 `us-east-1`） |
| `AIPING_API_KEY` | AI 对话、报告及相关生成能力 |
| `ALIYUN_BAILIAN_API_KEY` | 向量嵌入与语义检索 |
| `TAVILY_API_KEY` | 可选，Agent 联网搜索工具 |
| `ASR_API_KEY` | 可选，ASR API Key 认证；也支持下方 App ID / Token 方式 |
| `ASR_APP_ID` / `ASR_ACCESS_TOKEN` | ASR 的另一种认证方式；TTS 也使用这两个变量 |
| `ASR_RESOURCE_ID` | ASR 资源标识，需匹配已开通服务；未设置时默认 `volc.seedasr.sauc.duration` |
| `ASR_PROXY_PORT` | ASR 代理端口，默认 `3001` |
| `NEXT_PUBLIC_ASR_WS_URL` | 可选，覆盖前端 ASR WebSocket 地址 |
| `NEXT_PUBLIC_APP_URL` | 应用访问地址，用于服务端解析对话图片的相对 URL；默认 `http://localhost:3000` |
| `REMINDER_CHECK_URL` | 提醒进程调用地址，默认 `http://localhost:3000/api/reminders/check` |

Prisma CLI 与 ASR 代理读取 `.env`，Next.js 还会读取 `.env.local`。建议将共享配置放在 `.env`，避免两份配置指向不同数据库。提醒进程不会自动加载 `.env`，自定义地址需通过进程环境传入，或使用下文的 dotenv 启动命令。

### 4. 初始化数据库

```bash
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

Seed 会创建商品、用户、文章、目标、报告、好友与家庭等演示数据。配置对象存储后，还会创建 bucket 并上传种子图片；缺少存储凭据时会跳过图片上传，相应图片不可用。

可使用 `SEED_USERS` 中的账号登录。演示账号仅用于本地体验。

### 5. 启动应用

```bash
pnpm dev
```

访问 [localhost:3000](http://localhost:3000)。该命令自动生成 Prisma Client，并同时启动：

- Next.js 开发服务器：`3000`，监听 `0.0.0.0`。
- ASR WebSocket 代理：`3001`。
- 提醒检查进程：每 5 分钟检查一次到期提醒。

手机 / 局域网联调可使用：

```bash
pnpm db:generate
pnpm dev:lan
```

`dev:lan` 将 `/api/asr` 转发到内部 ASR 代理，但不启动提醒进程。手机浏览器录音需要 HTTPS；仅通过局域网 HTTP 地址访问时无法使用麦克风。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器 + ASR 代理 + 提醒进程 |
| `pnpm dev:lan` | 带同源 ASR 转发的开发服务器 |
| `pnpm build` / `pnpm start` | 生产构建 / 启动 Next.js；均自动生成 Prisma Client |
| `pnpm lint` | ESLint 检查 |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:migrate` | 开发环境创建并应用迁移 |
| `pnpm db:deploy` | 应用已有迁移 |
| `pnpm db:seed` | 写入演示数据 |
| `pnpm db:studio` | 打开 Prisma Studio |
| `pnpm vector:backfill-posts` | 回填文章向量 |
| `pnpm vector:backfill-chats` | 回填聊天向量 |
| `pnpm simulate:wearable:list` | 查看可穿戴数据模拟场景 |
| `pnpm simulate:report:list` | 查看报告数据模拟场景 |
| `pnpm test:notifications` | 通知 API 测试脚本 |

数据模拟、回填和通知测试可能写入数据；具体参数请查看 [scripts](scripts) 中对应脚本，并在开发数据库上运行。

## 生产运行

```bash
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
pnpm start
```

`pnpm start` 仅运行 Next.js。需要语音与定时提醒时，使用进程管理器分别运行：

```bash
# ASR WebSocket 代理
pnpm exec tsx src/server/asr-proxy.ts

# 提醒检查进程（加载 .env）
pnpm exec tsx -r dotenv/config src/server/reminder-cron.ts
```

反向代理需将普通 HTTP 请求转发到 `3000`，将 `/api/asr` 的 WebSocket 请求转发到 `3001` 并保留 Upgrade 头。通过 HTTPS 暴露应用，前端会使用同源 `wss://域名/api/asr`。独立后台进程需要持续运行；部署时也需配置上述服务凭据和应用访问地址。

## 项目结构

```text
src/
├── app/
│   ├── api/                 # 对话、健康数据、家庭、报告、通知等 API
│   ├── chat/                # AI 对话与会话管理
│   ├── discover/            # 社区、好友、家庭、商品展示
│   ├── memory/              # 健康记忆与报告
│   ├── reminders/           # 提醒管理
│   ├── notifications/       # 通知中心
│   ├── onboarding/          # 目标与心情引导
│   └── profile/             # 个人中心
├── components/              # 页面共享组件与聊天组件
├── lib/                     # 画像、记忆、向量检索、报告、数据解析等服务
├── generated/prisma/        # 自动生成的 Prisma Client（不入库）
└── server/                  # ASR 代理、提醒调度、局域网开发服务器
prisma/
├── schema.prisma            # 数据模型
├── migrations/              # 增量迁移
├── assets/                  # 种子图片
├── seeders/                 # 分模块种子脚本
└── seed.ts                  # Seed 入口
scripts/                     # 数据模拟、向量回填与调试脚本
docs/                        # 功能与开发文档
```

## 开发文档

- [Agent 开发指南](docs/agent-development-guide.md)
- [健康数据导入](docs/health-data-import.md)
- [记忆数据管线](docs/memory-data-pipeline.md)
- [健康报告生成](docs/memory-report-generation.md)
- [好友系统](docs/friends-system.md)
- [通知 API](docs/notification-api.md) · [弹出通知](docs/notification-toast.md)
- [积分系统](docs/credits-system.md)

已有迁移文件只增不删，数据模型变更应追加新迁移。Prisma 7 的连接与迁移配置位于 `prisma.config.ts`。开发说明和历史文档中的模型、命令等信息如有差异，以当前代码与 `package.json` 为准。
