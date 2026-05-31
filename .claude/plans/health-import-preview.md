# Plan: Health Import Preview + Time Range Selection

## 目标
上传ZIP后先展示预览（数据时间范围、各指标数量），让用户选择要导入的时间范围，而不是直接全量导入。

## 流程变更

### Before (当前)
```
上传ZIP → 解析全部 → 全量写入DB → 返回结果
```

### After (新)
```
上传ZIP → 解析全部 → 返回预览摘要（不入库）
用户选择时间范围 → 提交确认 → 只写入选定范围内的记录
```

## 实现步骤

### 1. 新增预览 API: POST /api/health/import/preview
- 接收ZIP文件 + 密码（同之前）
- 解析所有记录但不写入DB
- 将解析结果缓存到临时存储（内存Map，带TTL自动清理）
- 返回：`{ previewId, source, totalRecords, dataFrom, dataTo, summary, sampleByMonth }`
- `sampleByMonth` 按月统计各指标条数，帮助用户理解数据分布

### 2. 新增确认导入 API: POST /api/health/import/confirm
- 接收：`{ previewId, dateFrom, dateTo }`
- 从缓存取出解析结果，按时间过滤
- 写入DB（同之前的批量插入逻辑）
- 清除缓存
- 返回导入结果

### 3. 前端改造 (health-connections/page.tsx)
- 上传成功后进入"预览"界面（不是直接显示"导入成功"）
- 预览界面展示：
  - 数据来源（自动识别）
  - 时间范围滑块/日期选择器（from - to）
  - 各指标记录数 + 选定范围内的条数
  - 预估条数随时间范围变化实时更新（本地过滤 sampleByMonth）
- "确认导入"按钮 → 调用 confirm API

### 4. 缓存设计
- 服务端内存 Map<previewId, { records, source, userId, createdAt }>
- TTL: 10分钟后自动清理（避免内存泄漏）
- 预览时算好 monthly breakdown 发给前端，前端选时间范围时可以本地计算条数

## 文件改动
- `src/lib/health-parsers/preview-cache.ts` — 新文件，内存缓存
- `src/app/api/health/import/preview/route.ts` — 新 API
- `src/app/api/health/import/confirm/route.ts` — 新 API
- `src/app/api/health/import/route.ts` — 保留作为兼容（或删除）
- `src/app/profile/health-connections/page.tsx` — 前端改造
