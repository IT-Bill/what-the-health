# Memory 报告生成管线设计

## 现状

- **Persona系统**：完整实现，对话后台提取用户特征→注入下次对话，但对用户不可见
- **Memory页面**：UI完整（周报/月报/洞察三个tab），但数据全来自seed硬编码
- **缺失**：没有任何管线把真实数据转化为报告/洞察

## 数据源

| 来源 | 数据 | 频率 | 当前有查询逻辑 |
|------|------|------|--------------|
| HealthRecord | 步数、心率、睡眠、运动、体重等15种指标 | 批量导入 | ✓ groupBy聚合 |
| HabitCompletion | 每日习惯完成 | 每日 | 仅count |
| MoodCheckin | 情绪(calm/anxious/fatigued)+笔记 | 每日1次 | 仅列表 |
| ChatMessage | 对话内容 | 多次/日 | 无 |
| CreditTransaction | 积分活动记录(11种action) | 多次/日 | 无 |
| UserPersona | 用户画像(4维度JSON) | 每次对话后更新 | 完整读写 |

## 目标输出格式（Report.data JSON）

```json
{
  "moodEmojis": ["😊", "😐", ...],          // 每天一个情绪emoji
  "stats": [
    { "icon": "bedtime", "label": "睡眠均值", "value": "6.8h", "change": "↑0.3h", "positive": true }
  ],
  "sleepData": [6.3, 6.8, ...],              // 每天睡眠小时数
  "highlights": [
    { "icon": "trending_up", "label": "最大改善", "value": "入睡时间提前30分钟" }
  ],
  "achievements": [
    { "icon": "🏆", "title": "连续7天完成呼吸练习", "date": "2025-05-26" }
  ],
  "overallScore": 76                          // 0-100综合分
}
```

## 设计方案

### 触发机制

1. **定时生成**：每周一凌晨生成上周的周报，每月1号生成上月月报
2. **手动触发**：用户在 /memory 页面点击"生成报告"
3. **实现方式**：API route + 可选的外部 cron 调用

### 管线架构

```
┌─ 触发 (cron / 手动) ─┐
│                       │
▼                       │
Step 1: 数据聚合层       │
├── 睡眠: HealthRecord(sleepAnalysis) → 每日时长数组
├── 心率: HealthRecord(heartRate) → 均值/静息HR
├── 步数: HealthRecord(steps) → 日均
├── 运动: HealthRecord(workout) → 次数+时长
├── 体重: HealthRecord(weight) → 趋势
├── 情绪: MoodCheckin → emoji数组 + 分布
├── 习惯: HabitCompletion → 完成率/连续天数
├── 活跃度: CreditTransaction → 参与天数
│
▼
Step 2: 指标计算层
├── 环比变化: 本期 vs 上期（步数↑12%、睡眠↓0.3h）
├── 连续记录: 习惯streak、活跃streak
├── 综合评分: 加权(睡眠30% + 运动25% + 情绪20% + 习惯25%)
├── 成就检测: 里程碑触发（7天连续、新纪录等）
│
▼
Step 3: LLM 生成层 (Agent)
├── 输入: Step1+2的结构化数据 + UserPersona
├── 生成: summary叙事文本 + highlights + 个性化建议
├── 生成: insights (pattern/prediction/correlation/milestone)
│
▼
Step 4: 存储
├── Report表: data JSON + summary
├── Insight表: 关联到该report
└── 可选: 发送 Notification 通知用户报告已生成
```

### 核心模块

#### `src/lib/report-generator.ts` — 聚合 + 计算

```typescript
interface PeriodData {
  period: { start: Date; end: Date; type: 'weekly' | 'monthly' };
  sleep: { daily: number[]; avg: number; change: number };
  steps: { daily: number[]; avg: number; change: number };
  heartRate: { avg: number; resting: number; change: number };
  workout: { count: number; totalMinutes: number; change: number };
  weight: { latest: number; change: number };
  mood: { emojis: string[]; distribution: Record<string, number> };
  habits: { completionRate: number; streaks: Record<string, number>; allComplete: number };
  engagement: { activeDays: number; chatSessions: number; credits: number };
}
```

纯数据库查询，不依赖LLM。可独立测试。

#### `src/lib/report-ai.ts` — LLM 生成

复用 persona-service 的模式：
- 输入: PeriodData + UserPersona
- 输出: summary文本 + highlights数组 + achievements数组 + insights数组
- 用同一个 GLM-5.1 模型，prompt设计为"健康报告分析师"角色

#### `src/app/api/memory/generate/route.ts` — 触发API

```
POST /api/memory/generate
Body: { type: "weekly" | "monthly", periodStart?: string }
```

- 鉴权后计算周期
- 调用 report-generator 聚合
- 调用 report-ai 生成叙事
- 写入 Report + Insight 表
- 返回生成的报告

### 数据不足时的降级策略

| 情况 | 处理 |
|------|------|
| 没有健康数据导入 | 跳过睡眠/心率/步数等指标，只展示习惯+情绪 |
| 没有情绪打卡 | moodEmojis为空，不展示情绪分布 |
| 没有习惯记录 | 跳过习惯统计 |
| 全部数据都没有 | 不生成报告，提示用户"数据不足" |
| LLM调用失败 | 保存纯数据报告（stats/sleep有，summary为空） |

### "AI理解度" 计算

替换硬编码的 Level 3 / 78%：

```typescript
function calculateAiUnderstanding(persona: UserPersona): { level: number; percentage: number } {
  const fields = [persona.identity, persona.behavior, persona.expression, persona.preferences];
  const totalItems = fields.reduce((sum, f) => sum + Object.values(f).flat().length, 0);
  const percentage = Math.min(100, Math.round(totalItems / 120 * 100)); // 120 items = 100%
  const level = percentage < 20 ? 1 : percentage < 40 ? 2 : percentage < 60 ? 3 : percentage < 80 ? 4 : 5;
  return { level, percentage };
}
```

### Persona 可视化

在洞察tab加一个"AI对你的理解"卡片：
- 展示persona的关键标签（生活方式、行为模式、偏好等）
- 理解度进度条
- "基于 N 次对话学习" 标注

## 实现优先级

1. **P0**: 数据聚合层（纯查询，可独立测试）
2. **P0**: 生成API + 手动触发
3. **P1**: LLM 叙事/洞察生成
4. **P1**: AI理解度 + Persona可视化
5. **P2**: 定时自动生成（cron）
6. **P2**: 通知用户报告已生成
