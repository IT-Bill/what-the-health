# Plan: S3-Compatible Object Storage (MinIO)

## 概述
将所有图片资源从外部 URL（lh3.googleusercontent.com）迁移到自托管 MinIO 对象存储，并支持用户上传头像等功能。

## 环境变量
```env
S3_ENDPOINT=http://8.138.228.37:59000
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_BUCKET=mindful
S3_REGION=us-east-1
S3_PUBLIC_URL=http://8.138.228.37:59000/mindful
```

## Bucket 结构
```
mindful/
├── static/              # seed 时上传的静态资源
│   ├── posts/           # 文章封面 (post-1.webp ... post-6.webp)
│   ├── products/        # 商品图片 (smart-watch.webp ... stone-diffuser.webp)
│   └── pages/           # 登录/注册/onboarding 页面图片
├── avatars/             # 用户头像 (用户上传)
│   └── {userId}.webp
└── uploads/             # 未来扩展（用户帖子图片等）
```

## URL 设计
- 数据库存储相对路径：`static/posts/post-1.webp`
- 前端拼接完整 URL：`${S3_PUBLIC_URL}/${path}`
- 创建工具函数 `getObjectUrl(path)` 统一生成 URL

## 实现步骤

### 1. S3 客户端库 (`src/lib/s3.ts`)
- 使用 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- 配置 MinIO endpoint
- 导出：putObject, getObjectUrl, deleteObject, generateUploadUrl

### 2. 下载静态图片到本地 (`prisma/seed-assets/`)
- 从 lh3.googleusercontent.com 下载所有图片保存为本地文件
- 6 张 post covers + 6 张 product images + 1 张 login/signup hero + 3 张 onboarding
- 共 16 张图片，提交到 git（seed 依赖）

### 3. 改造 Seed (`prisma/seeders/`)
- seed 时先上传图片到 MinIO（如果不存在）
- 数据库存相对路径而非完整 URL

### 4. 前端 URL 工具 (`src/lib/storage.ts`)
- `getObjectUrl(path)` — 客户端拼接公开 URL
- 通过 `NEXT_PUBLIC_S3_PUBLIC_URL` env var 暴露给客户端

### 5. 更新引用图片的组件
- posts seed → 相对路径
- products seed → 相对路径
- login/signup/onboarding → 用 getObjectUrl()
- discover page → 动态拼接
- 配置 next.config.ts images.remotePatterns 加 MinIO host

### 6. 头像上传 API (`/api/upload/avatar`)
- 接收图片 → 处理/压缩 → 上传到 MinIO → 更新 User.avatarUrl
- 返回相对路径

### 7. next.config.ts 更新
- images.remotePatterns 加 MinIO 的 host

## 文件清单
- `src/lib/s3.ts` — S3 client 封装
- `src/lib/storage.ts` — getObjectUrl 工具（客户端可用）
- `src/app/api/upload/avatar/route.ts` — 头像上传 API
- `prisma/seed-assets/` — 16 张静态图片
- `prisma/seeders/upload-assets.ts` — seed 时上传图片
- 更新: `prisma/seeders/posts.ts`, `prisma/seeders/products.ts`
- 更新: login, signup, onboarding/goal 页面
- 更新: discover, profile 等展示图片的组件
- 更新: `next.config.ts`, `.env`
