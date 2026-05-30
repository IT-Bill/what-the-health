# 健康数据导入方案

## 研究结果

### 各平台导出方式与格式

| 平台 | 导出方式 | 格式 | 数据内容 | 文件大小 |
|------|---------|------|---------|---------|
| Apple Health | 健康app → 头像 → 导出所有健康数据 | ZIP (export.xml) | 步数、心率、睡眠、运动、血压、体重等 | 50MB-5GB |
| 华为运动健康 | 设置 → 隐私中心 → 请求个人数据 | ZIP (JSON/CSV) | 步数、心率、睡眠、压力、SpO2、运动 | 10-500MB |
| 小米健康/Zepp Life | 设置 → 账号 → 导出数据 | ZIP (JSON/CSV) | 步数、心率、睡眠、运动 | 10-200MB |
| Samsung Health | 设置 → 下载个人数据 | ZIP (JSON/CSV) | 步数、心率、睡眠、运动、血压、血糖 | 10-500MB |
| Google Fit (Takeout) | takeout.google.com → Fit | ZIP (JSON) | 活动、心率、睡眠 | 10-100MB |
| OPPO/一加健康 | 隐私设置 → 导出数据 | JSON | 步数、睡眠、心率 | 5-50MB |

### Apple Health XML 结构（最完整/最常用）

```xml
<HealthData locale="zh_CN">
  <Record type="HKQuantityTypeIdentifierStepCount"
          sourceName="iPhone" unit="count"
          startDate="2024-01-15 07:45:00 +0800"
          endDate="2024-01-15 08:00:00 +0800"
          value="250"/>
  <Record type="HKQuantityTypeIdentifierHeartRate"
          sourceName="Apple Watch" unit="count/min"
          startDate="..." endDate="..." value="72"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis"
          sourceName="Apple Watch"
          startDate="..." endDate="..."
          value="HKCategoryValueSleepAnalysisAsleepCore"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
           duration="30.5" durationUnit="min"
           totalDistance="5.2" totalDistanceUnit="km"
           totalEnergyBurned="320" totalEnergyBurnedUnit="kcal"/>
  <ActivitySummary dateComponents="2024-01-15"
                   activeEnergyBurned="450" appleExerciseTime="30" appleStandHours="10"/>
</HealthData>
```

---

## 设计方案

### 整体架构

```
用户手机导出 ZIP 文件
        ↓
上传到 /api/health/import (multipart/form-data)
        ↓
服务端：解压 → 检测格式 → 流式解析
        ↓
标准化为统一的 HealthRecord 格式
        ↓
批量写入数据库（分批 insert，每批 500 条）
        ↓
生成导入摘要（总记录数、时间范围、数据类型）
        ↓
前端展示导入结果 + 数据可视化
```

### 数据模型

#### 新增枚举

```prisma
enum HealthDataSource {
  appleHealth
  huaweiHealth
  xiaomiHealth
  samsungHealth
  googleFit
  oppoHealth
  manual   // 手动输入
}

enum HealthMetricType {
  steps          // 步数
  heartRate      // 心率
  restingHR      // 静息心率
  sleepAnalysis  // 睡眠
  workout        // 运动
  weight         // 体重
  bloodPressure  // 血压
  bloodOxygen    // 血氧
  calories       // 卡路里
  distance       // 距离
  hrv            // 心率变异性
  stress         // 压力
}
```

#### HealthRecord 表（统一存储所有来源的健康数据）

```prisma
model HealthRecord {
  id         String           @id @default(cuid())
  userId     String
  source     HealthDataSource
  metric     HealthMetricType
  value      Float            // 主值（步数、心率、体重等）
  unit       String           // 单位 (count, bpm, kg, kcal, min, km...)
  startDate  DateTime         // 数据开始时间
  endDate    DateTime         // 数据结束时间
  /// 额外数据（如睡眠阶段、运动类型、收缩压/舒张压等）
  metadata   Json?
  /// 原始数据来源设备名
  sourceName String?
  importId   String?          // 关联到哪次导入

  createdAt  DateTime @default(now())

  user   User          @relation(...)
  import HealthImport? @relation(...)

  @@index([userId, metric, startDate])
  @@index([userId, startDate])
  @@index([importId])
  @@map("health_records")
}
```

#### HealthImport 表（导入记录/审计）

```prisma
model HealthImport {
  id           String           @id @default(cuid())
  userId       String
  source       HealthDataSource
  fileName     String
  fileSize     Int              // bytes
  status       ImportStatus     // processing, completed, failed
  recordCount  Int              @default(0)
  /// 数据时间范围
  dataFrom     DateTime?
  dataTo       DateTime?
  /// 错误信息（如果失败）
  error        String?
  /// 导入的数据类型统计 { steps: 1200, heartRate: 5000, ... }
  summary      Json?

  createdAt    DateTime @default(now())
  completedAt  DateTime?

  user    User           @relation(...)
  records HealthRecord[]

  @@index([userId, createdAt])
  @@map("health_imports")
}

enum ImportStatus {
  processing
  completed
  failed
}
```

---

### 解析器设计

每个平台一个解析器，实现统一接口：

```typescript
interface HealthParser {
  /** 检测文件是否是该格式 */
  detect(files: string[]): boolean;
  /** 流式解析，yield 标准化的 HealthRecord */
  parse(zipBuffer: Buffer): AsyncGenerator<ParsedRecord[]>;
}

interface ParsedRecord {
  metric: HealthMetricType;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  metadata?: Record<string, unknown>;
  sourceName?: string;
}
```

#### Apple Health 解析器

Apple Health 的 XML 可能非常大（几GB），必须用 **SAX/流式解析**，不能用 DOM 解析。

```typescript
// 使用 sax 或 xml2js 的流式模式
import { createReadStream } from 'fs';
import sax from 'sax';

async function* parseAppleHealth(xmlStream: Readable): AsyncGenerator<ParsedRecord[]> {
  const parser = sax.createStream(true);
  let batch: ParsedRecord[] = [];

  parser.on('opentag', (node) => {
    if (node.name === 'Record') {
      const record = mapAppleRecord(node.attributes);
      if (record) batch.push(record);
      if (batch.length >= 500) {
        // yield batch and reset
      }
    }
  });
  // ...
}
```

**Apple Health type 映射：**

| Apple Type | 我们的 metric | unit |
|-----------|--------------|------|
| HKQuantityTypeIdentifierStepCount | steps | count |
| HKQuantityTypeIdentifierHeartRate | heartRate | bpm |
| HKQuantityTypeIdentifierRestingHeartRate | restingHR | bpm |
| HKCategoryTypeIdentifierSleepAnalysis | sleepAnalysis | - |
| HKQuantityTypeIdentifierBodyMass | weight | kg |
| HKQuantityTypeIdentifierBloodPressureSystolic | bloodPressure | mmHg |
| HKQuantityTypeIdentifierOxygenSaturation | bloodOxygen | % |
| HKQuantityTypeIdentifierActiveEnergyBurned | calories | kcal |
| HKQuantityTypeIdentifierDistanceWalkingRunning | distance | km |
| HKQuantityTypeIdentifierHeartRateVariabilitySDNN | hrv | ms |

#### 华为/小米/Samsung 解析器

这些平台导出的是 JSON/CSV，解析相对简单：

```typescript
// 华为格式示例
// motion/step/step_xxx.json: [{ startTime, endTime, value, ... }]
// sleep/sleep_xxx.json: [{ startTime, endTime, sleepType, ... }]

async function* parseHuaweiHealth(zip: AdmZip): AsyncGenerator<ParsedRecord[]> {
  const entries = zip.getEntries();
  for (const entry of entries) {
    if (entry.entryName.includes('motion/step/')) {
      const data = JSON.parse(entry.getData().toString());
      // map to ParsedRecord...
    }
  }
}
```

---

### API 设计

#### POST /api/health/import

上传文件并开始解析。

```
Content-Type: multipart/form-data
Body: file (ZIP), source? (auto-detect if not provided)
```

**处理流程：**
1. Auth check
2. 接收文件（限制大小：500MB max）
3. 创建 HealthImport 记录 (status: processing)
4. 解压 → 自动检测来源格式
5. 流式解析 → 批量 insert (500条/批)
6. 更新 HealthImport (status: completed, recordCount, dataFrom, dataTo, summary)
7. 返回导入结果

**大文件处理策略：**
- 对于 < 50MB 的文件：同步处理，等待完成后返回
- 对于 > 50MB 的文件：异步处理，立即返回 importId，前端轮询状态

```typescript
// Response (small file, sync)
{ importId: "...", status: "completed", recordCount: 15000, summary: {...} }

// Response (large file, async)
{ importId: "...", status: "processing" }
```

#### GET /api/health/import/[id]

查询导入状态（用于轮询大文件）。

#### GET /api/health/records?metric=steps&from=2024-01-01&to=2024-01-31

查询已导入的健康数据（用于可视化）。

---

### 前端入口

在 `/profile/health-connections` 页面添加：

1. **导入按钮**：每个平台卡片上加"导入数据"操作
2. **上传对话框**：拖拽/选择 ZIP 文件 + 自动检测来源
3. **进度显示**：解析进度条 + 完成后显示摘要
4. **导入历史**：已导入的文件列表 + 数据范围 + 记录数

---

### 技术选型

| 环节 | 方案 |
|------|------|
| ZIP 解压 | `adm-zip` (同步, < 50MB) / `unzipper` (流式, 大文件) |
| XML 流式解析 | `sax` (SAX parser, 极低内存) |
| JSON 解析 | 原生 `JSON.parse`（分文件读取） |
| 文件上传 | Next.js Route Handler + `formidable` 或原生 Request.formData() |
| 批量写入 | Prisma `createMany` (500条/批, 事务) |
| 大文件异步 | 后台任务 (inngest / bullmq / 简单 setTimeout) |

### 文件大小限制

```typescript
// next.config.ts
export const config = {
  api: { bodyParser: { sizeLimit: '500mb' } }
};
```

---

### 隐私与安全

1. **文件不持久存储**：解析完立即删除临时文件
2. **服务端解析**：文件不传到第三方
3. **用户可删除**：提供"删除导入数据"功能（按 importId 批量删除）
4. **仅自己可见**：健康数据不在好友分享权限中（除非未来显式添加）

---

### 实现分期

#### Phase 1 ✅
- [x] Schema: HealthRecord + HealthImport 表 + 枚举（增量 migration）
- [x] Apple Health XML 流式解析器（SAX, 15+ HK 指标）
- [x] POST /api/health/import (同步解析，500条/批入库)
- [x] GET /api/health/import (导入历史列表)
- [x] GET /api/health/import/[id] (导入状态)
- [x] DELETE /api/health/import/[id] (删除导入+记录)
- [x] GET /api/health/records (按 metric/日期范围查询 + 聚合统计)
- [x] 前端：上传对话框 + 导入历史 + 删除功能
- [x] 文档

#### Phase 2 ✅
- [x] 华为运动健康解析器 (JSON, 自动检测 motion/ 目录)
- [x] 小米/Zepp Life 解析器 (JSON + CSV 双格式)
- [x] Samsung Health 解析器 (CSV, com.samsung.health.* 文件名)
- [x] 自动检测文件来源格式（registry 按优先级匹配）

#### Phase 3 ✅
- [x] Google Fit 解析器 (Takeout JSON, bucket/dataset/point 结构)
- [x] 数据可视化页面 (/profile/health-data: 指标概览 + 趋势条形图 + 记录列表)
- [x] 数据去重 API (POST /api/health/dedup, SQL ROW_NUMBER 窗口函数)
- [x] Profile 菜单加入"健康数据"入口

#### 未来可选
- [ ] 大文件异步处理 (> 50MB 文件的后台队列)
- [ ] 导入进度实时更新 (WebSocket/SSE)
- [ ] 数据与 Memory 报告系统集成（HealthRecord → Report 聚合因子）
- [ ] OPPO/一加健康解析器
- [ ] 手动输入健康数据（表单）

---

### 代码结构

```
src/lib/health-parsers/
├── index.ts           # Registry: 自动检测 + dispatch
├── types.ts           # ParsedRecord, ParseResult, HealthParser 接口
├── apple-health.ts    # Apple Health XML (SAX 流式)
├── huawei-health.ts   # 华为运动健康 (JSON)
├── xiaomi-health.ts   # 小米/Zepp Life (JSON + CSV)
├── samsung-health.ts  # Samsung Health (CSV)
└── google-fit.ts      # Google Fit Takeout (JSON)

src/app/api/health/
├── import/
│   ├── route.ts       # POST (上传解析) + GET (导入列表)
│   └── [id]/route.ts  # GET (状态) + DELETE (删除)
├── records/route.ts   # GET (查询记录 + 聚合)
└── dedup/route.ts     # POST (去重)

src/app/profile/
├── health-connections/page.tsx  # 连接管理 + 导入入口
└── health-data/page.tsx         # 数据可视化仪表盘
```
