# 周报/月报生成技术文档

## 概述

Memory 报告系统通过聚合用户的多维健康数据，结合 LLM（GLM-5.1）生成个性化的健康报告。报告分为**周报**和**月报**两种，支持版本管理（同一周期可多次生成，保留所有历史版本）。

## 架构

```
触发（手动/定时）
       │
       ▼
┌─────────────────────────────┐
│  Step 1: 数据聚合层           │  src/lib/report/aggregator.ts
│  (纯数据库查询，无LLM依赖)    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Step 2: 指标计算层           │  综合评分、环比变化、streak
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Step 3: LLM 生成层          │  src/lib/report/generator.ts
│  (AI Ping GLM-5.1)          │  叙事摘要 + 亮点 + 成就 + 洞察
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Step 4: 存储                │  Report 表 + Insight 表
└─────────────────────────────┘
```

## 数据源

### 1. 健康记录 (HealthRecord)

来源：用户通过 ZIP 导入的 Apple Health / 华为 / 小米 / Samsung / Google Fit 数据，或手动数据。

| 指标 | 字段 | 聚合方式 |
|------|------|---------|
| 步数 (steps) | value=步数, unit=count | 按天求和 → 日均 |
| 心率 (heartRate) | value=bpm | 全周期均值 |
| 静息心率 (restingHR) | value=bpm | 全周期均值 |
| 睡眠 (sleepAnalysis) | value=分钟数, unit=min | 按天求和→小时数组 |
| 运动 (workout) | value=时长, unit=min | 计数 + 总时长 |
| 体重 (weight) | value=kg | 首末差值 |
| 卡路里 (calories) | value=kcal | 按天求和 |
| 血压 (bloodPressure) | value=mmHg | 均值 |
| 血氧 (bloodOxygen) | value=% | 均值 |
| HRV | value=ms | 均值 |

### 2. 情绪打卡 (MoodCheckin)

来源：用户每日情绪记录（calm/anxious/fatigued）+ 可选笔记。

| 聚合方式 | 输出 |
|---------|------|
| 按天映射为 emoji | `["😊","😰","😴",...]` 数组 |
| 分布统计 | `{ calm: 5, anxious: 1, fatigued: 1 }` |
| 与上一周期对比 | 焦虑/疲惫比例变化 |

Emoji 映射：
- `calm` → 😊
- `anxious` → 😰
- `fatigued` → 😴

### 3. 习惯完成 (HabitCompletion + Goal)

来源：用户设定的习惯目标每日完成记录。

| 聚合方式 | 输出 |
|---------|------|
| 完成率 | completions / (goals × days) × 100% |
| 连续天数 (streak) | 每个目标的当前streak和最长streak |
| 全部完成天数 | 某天所有目标都完成的天数 |
| 与上一周期对比 | 完成率变化百分比 |

### 4. 活跃度 (CreditTransaction + ChatSession)

来源：积分交易记录 + 对话会话数。

| 聚合方式 | 输出 |
|---------|------|
| 活跃天数 | 有积分earn操作的天数（去重） |
| 对话次数 | ChatSession 创建数 |
| 积分获取 | 所有earn方向的amount总和 |
| 与上一周期对比 | 活跃天数变化 |

### 5. 用户画像 (UserPersona)

来源：Chat Agent 对话后自动提取的用户特征。

用途：注入 LLM prompt 实现个性化叙事（了解用户的生活方式、偏好、表达习惯等）。

## 周期计算

### 周报
- **默认**：当前周（本周一 00:00 UTC ~ 下周一 00:00 UTC）
- **对比周期**：上一周（上周一 ~ 本周一）
- **可指定**：任意某周的周一日期

### 月报
- **默认**：当前月（本月1号 00:00 UTC ~ 下月1号 00:00 UTC）
- **对比周期**：上一月
- **可指定**：任意某月的1号日期

## 综合评分计算

```
overallScore = 加权平均(
  睡眠分数 × 30%,
  运动分数 × 25%,
  情绪分数 × 20%,
  习惯分数 × 25%
)
```

各项评分规则：

| 维度 | 满分条件 | 中等 | 较低 |
|------|---------|------|------|
| 睡眠 | 7-9h → 100 | 6-7h → 70 | 5-6h → 40, <5h → 20 |
| 运动 | ≥3次/周 → 100 | 2次 → 75, 1次 → 50 | 0次 → 20 |
| 情绪 | calm占比% 直接作为分数 | — | — |
| 习惯 | completionRate% 直接作为分数 | — | — |

如果某个维度没有数据，则该维度不参与计算（权重重新归一化）。

## LLM 生成

### API 调用

- **端点**: `https://aiping.cn/api/v1/chat/completions`
- **模型**: GLM-5.1
- **max_tokens**: 16000（GLM-5.1 是 reasoning 模型，reasoning 消耗较多token）
- **认证**: Bearer token (AIPING_API_KEY)

### System Prompt

```
你是一个温暖专业的健康报告分析师。根据用户的健康数据生成个性化报告内容。

要求：
- 语言简洁温暖，像朋友一样鼓励用户
- 基于数据说话，不编造没有的数据
- 如果某项数据为null，完全忽略该维度
- highlights 是本期最值得注意的3个亮点
- achievements 是本期达成的成就（streak、新纪录、显著改善等），没有就返回空数组
- insights 是AI洞察（模式发现、趋势预警、因素关联、里程碑），生成2-4条
- summary 是2-3句话的整体总结叙事

{如有用户画像，在此注入}
```

### User Prompt

```
请根据以下健康数据生成报告内容：

{
  "period": "2026-05-24 ~ 2026-05-30 周报",
  "sleep": { "avg": 7.4, "prevAvg": 7.5 },
  "steps": { "avg": 8803, "prevAvg": 8749 },
  "heartRate": { "avg": 64, "resting": 64, "prevAvg": 65 },
  "workout": { "count": 1, "totalMinutes": 45, "prevCount": 3 },
  "mood": { "calm": 5, "anxious": 0, "fatigued": 2 },
  "habits": { "completionRate": 82, "streaks": [...], "allCompleteDays": 3 },
  "engagement": { "activeDays": 6, "chatSessions": 2, "creditsEarned": 120 },
  "overallScore": 77
}

请严格返回以下JSON格式（不要包含markdown代码块标记）：
{
  "summary": "2-3句整体总结",
  "highlights": [
    {"icon": "material_icon_name", "label": "标签", "value": "具体数值或描述"}
  ],
  "achievements": [
    {"icon": "emoji", "title": "成就描述", "date": "YYYY-MM-DD"}
  ],
  "insights": [
    {"type": "pattern|prediction|correlation|milestone", "title": "标题", "content": "详细描述", "metadata": {"confidence": 0.8}}
  ]
}
```

### LLM 输出示例

```json
{
  "summary": "这周你展现出了极佳的情绪状态，0焦虑和5次平静的记录令人欣慰，饮食习惯更是创下了连续21天的傲人纪录！虽然运动次数稍显不足，但整体步数稳步提升，继续保持这份从容与坚持吧。",
  "highlights": [
    {"icon": "sentiment_very_satisfied", "label": "情绪状态", "value": "0次焦虑"},
    {"icon": "restaurant", "label": "饮食习惯", "value": "连续21天"},
    {"icon": "directions_walk", "label": "日均步数", "value": "8803步"}
  ],
  "achievements": [
    {"icon": "🏆", "title": "饮食习惯连续21天", "date": "2026-05-30"}
  ],
  "insights": [
    {
      "type": "milestone",
      "title": "习惯养成的里程碑",
      "content": "你的饮食习惯已连续坚持21天，这不仅是新纪录，更是习惯真正扎根的标志！",
      "metadata": {"confidence": 0.95}
    },
    {
      "type": "correlation",
      "title": "情绪与运动的正向关联",
      "content": "本周情绪状态极佳（0焦虑），与稳定的步行量可能存在正向关联。",
      "metadata": {"confidence": 0.78, "strength": 72}
    }
  ]
}
```

## 输出格式 (Report.data JSON)

存入数据库的 `Report.data` 字段完整结构：

```typescript
interface ReportData {
  moodEmojis: string[];           // 每天一个情绪emoji ["😊","😰","😴",...]
  stats: {                        // 核心统计指标卡片
    icon: string;                 // Material Symbols icon name
    label: string;                // 指标名称
    value: string;                // 当前值
    change: string;               // 环比变化 "↑0.3h" / "↓2次" / ""
    positive: boolean;            // 变化是否正面
  }[];
  sleepData: (number | null)[];   // 每天睡眠小时数 (null=无数据)
  highlights: {                   // LLM生成的亮点 (3个)
    icon: string;
    label: string;
    value: string;
  }[];
  achievements: {                 // LLM生成的成就
    icon: string;                 // emoji
    title: string;
    date: string;                 // YYYY-MM-DD
  }[];
  overallScore: number;           // 0-100 综合健康评分
}
```

## 洞察类型 (Insight)

| type | 含义 | 示例 |
|------|------|------|
| `pattern` | 发现的行为模式 | "周三低状态模式" |
| `prediction` | 趋势预警 | "睡眠下降预警" |
| `correlation` | 因素关联 | "运动提升情绪" |
| `milestone` | 里程碑达成 | "习惯连续21天" |

每条洞察的 `metadata` 包含：
- `confidence`: 0-1，AI 对该洞察的置信度
- `strength`: 关联强度（correlation 类型）
- `triggerWindow`: 预警时间窗口（prediction 类型）
- `improvement`: 改善百分比（milestone 类型）

## 版本管理

同一周期可多次生成报告：
- 每次生成创建新版本（version +1）
- 所有历史版本保留，不删除
- 前端默认展示最新版本，可通过下拉框切换历史版本
- 版本显示格式：`v3 · 5/31 17:43 (最新)`

## 降级策略

| 情况 | 处理 |
|------|------|
| 无健康数据 | 跳过 sleep/steps/heartRate/workout/weight 统计 |
| 无情绪打卡 | moodEmojis 为空数组 |
| 无习惯记录 | 跳过习惯完成率统计 |
| 所有数据源都为空 | 返回 400 + "该周期暂无数据" |
| LLM 调用失败 | 报告仍有纯数据部分（stats/sleepData/score），summary/highlights/insights 为空 |
| AIPING_API_KEY 未配置 | 同上，跳过 LLM 生成 |
| 用户无 Persona | LLM 生成时不注入个性化上下文，使用通用语气 |

## API

### 生成报告

```
POST /api/memory/generate
Content-Type: application/json

{
  "type": "weekly" | "monthly",   // 报告类型
  "periodStart": "2026-05-24"     // 可选，默认当前周/月
}
```

响应：
```json
{
  "status": "generated",
  "report": { ...Report对象, "insights": [...Insight对象] }
}
```

### 查询报告

```
GET /api/memory?type=weekly&periodStart=2026-05-24&version=3
```

响应：
```json
{
  "report": { ...最新版本报告 },
  "globalInsights": [...],
  "available": ["2026-05-24T00:00:00.000Z", "2026-05-17T00:00:00.000Z"],
  "versions": [
    { "version": 3, "createdAt": "2026-05-31T09:43:00.000Z" },
    { "version": 2, "createdAt": "2026-05-29T14:20:00.000Z" }
  ],
  "aiUnderstanding": { "level": 3, "percentage": 45, "conversationCount": 12 },
  "demo": false
}
```

## 文件结构

```
src/lib/report/
├── aggregator.ts    # 数据聚合层（8个并行查询 + 综合评分）
├── generator.ts     # LLM 生成层（直接调 AI Ping API）
└── index.ts         # 统一导出

src/app/api/memory/
├── route.ts         # GET 查询报告
└── generate/
    └── route.ts     # POST 生成报告
```

## TODO

- [ ] **替换纯 LLM 调用为 pi-agent 工具调用模式**：当前 `generator.ts` 直接 fetch AI Ping API 获取 JSON 输出。未来应改为使用 `@earendil-works/pi-agent-core` 的 Agent，注册数据查询工具（如 `query_health_records`、`get_habit_streaks`、`get_mood_trends` 等），让 Agent 自主决定需要查询哪些数据、如何组合分析，而不是预先聚合好所有数据再喂给 LLM。这样可以实现更灵活的洞察发现（Agent 可以追问、交叉验证），也更容易扩展新的数据维度。
