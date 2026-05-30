# 积分系统设计文档

## 概述

Mindful 积分系统旨在通过正向激励，鼓励用户养成健康习惯。积分（Credits, Cr）可通过完成各种健康行为获取，并在积分商城中兑换精选好物。

系统设计原则：
- **透明**：所有规则在UI中明确展示，用户清楚每个行为能获得多少积分
- **公平**：设有每日上限，防止刷分
- **可持续**：奖励日常坚持而非短期冲刺

---

## 积分获取规则

| 行为 | 积分 | 每日上限 | 说明 |
|------|------|----------|------|
| 每日签到 | +5 Cr | 1次 | 每天和Mindful对话即可获得 |
| 完成习惯目标 | +10 Cr | 不限 | 每完成一个今日习惯目标 |
| 全部目标完成 | +20 Cr | 1次 | 当天所有习惯目标全部完成的额外奖励 |
| 情绪记录 | +5 Cr | 1次 | 完成每日情绪打卡 |
| 连续7天达标 | +50 Cr | 1次 | 连续7天完成至少一个习惯目标 |
| 正念练习 | +10 Cr | 3次 | 完成一次正念/冥想/深呼吸练习 |
| 发布文章 | +30 Cr | 2次 | 在发现页发布一篇原创文章 |
| 文章被赞 | +2 Cr | 不限 | 你的文章每获得一个赞 |

### 每日最大收入估算

一个完美的一天（4个习惯全完成 + 所有日常行为）：
- 签到: 5
- 4个习惯: 40
- 全部完成bonus: 20
- 情绪记录: 5
- 正念练习 x3: 30
- **日计: 100 Cr**

加上 streak bonus（每周一次 50Cr）和社区互动，月均可获取约 **2500-3500 Cr**。

---

## 积分消耗（兑换）

### 商品分层

| 层级 | 价格区间 | 示例 |
|------|----------|------|
| 日常小物 | 30-100 Cr | 手工面包、有机麦片 |
| 中档好物 | 100-500 Cr | 香薰扩散器、智能体重秤 |
| 高端奖品 | 800-1500 Cr | Oura Ring、智能手表 |

### 兑换流程

1. 用户在商城 tab 浏览商品
2. 确认兑换 → 扣除积分 → 生成兑换订单 (status: pending)
3. 后台处理发货 → 更新状态为 fulfilled
4. 积分不足时商品显示"积分不足"，按钮置灰

### 退换规则

- 兑换后 24h 内可取消（积分返还）
- 已发货商品不可退换
- 取消的订单 status 标记为 cancelled

---

## 数据模型

### CreditRule（积分规则表）

```prisma
model CreditRule {
  id          String       @id
  action      CreditAction @unique  // 行为类型枚举
  name        String                // 显示名称
  description String                // 详细说明
  amount      Int                   // 每次获得积分
  dailyCap    Int                   // 每日上限（0=不限）
  icon        String?               // Material Symbol icon name
  active      Boolean               // 是否启用
  sortOrder   Int                   // 显示排序
}
```

### CreditTransaction（积分流水表）

```prisma
model CreditTransaction {
  id        String          @id
  userId    String
  action    CreditAction    // 触发行为
  direction CreditDirection // earn | spend
  amount    Int             // 绝对值
  balance   Int             // 交易后余额
  refId     String?         // 关联实体ID（如postId, goalId）
  note      String?         // 人类可读描述
  createdAt DateTime
}
```

### 余额一致性

- `User.credits` 字段存储当前余额（快速读取）
- `CreditTransaction.balance` 记录每笔交易后的余额（审计追溯）
- 发放积分时：原子操作更新 User.credits + 插入 Transaction
- 如有不一致，以 Transaction 表最后一条记录的 balance 为准

---

## 防滥用机制

1. **每日上限**：每种行为有 dailyCap，通过查询当天已有相同 action 的 transaction 数来判断
2. **行为验证**：积分发放由后端触发（不是前端调API直接加分）
   - 习惯完成 → HabitCompletion 创建时触发
   - 签到 → ChatMessage 创建时检查今天是否已签到
   - 情绪记录 → MoodCheckin 创建时触发
   - 正念练习 → 通过对话识别完成正念练习时触发
3. **Streak 计算**：后端定时任务每天检查前7天的 HabitCompletion 是否连续
4. **文章审核**：发布文章的积分可延迟发放（审核通过后）

---

## API 接口

### GET /api/shop

返回商城页面所需的所有数据：

```json
{
  "balance": 2450,
  "rules": [
    { "action": "dailyCheckin", "name": "每日签到", "amount": 5, "dailyCap": 1, ... }
  ],
  "products": [
    { "id": "...", "name": "Smart Watch", "priceCredits": 1200, ... }
  ],
  "recentTransactions": [
    { "action": "habitComplete", "direction": "earn", "amount": 10, "balance": 2450, ... }
  ]
}
```

### POST /api/shop/redeem (待实现)

```json
// Request
{ "productId": "..." }

// Response (success)
{ "redemption": { "id": "...", "status": "pending" }, "newBalance": 1250 }

// Response (insufficient credits)
{ "error": "积分不足", "required": 1200, "current": 800 }
```

### POST /api/credits/award (内部调用，待实现)

后端服务调用，用于发放积分：

```json
// Request
{ "userId": "...", "action": "habitComplete", "refId": "goal_xxx" }

// Response
{ "awarded": true, "amount": 10, "newBalance": 2460 }
// or
{ "awarded": false, "reason": "daily_cap_reached" }
```

---

## UI 位置

积分商城作为 Discover 页面的一个 tab（"商城"），包含：

1. **余额展示** — 大字体显示当前积分
2. **赚取规则** — 可展开的透明规则列表，每条显示行为名、说明、积分数、每日上限
3. **积分明细** — 可展开的最近交易记录，显示来源、时间、金额
4. **商品网格** — 2列产品卡片，显示图片、名称、价格；余额不足时灰显

---

## 实现路线图

### Phase 1（当前）✅
- [x] Schema: CreditRule + CreditTransaction 表
- [x] Seed: 8条积分规则 + 示例交易记录
- [x] API: GET /api/shop
- [x] UI: Discover 商城 tab（余额、规则、商品、明细）

### Phase 2
- [ ] POST /api/shop/redeem — 兑换接口（扣分 + 创建 Redemption）
- [ ] 积分发放 hooks — 在各业务操作时自动发放积分
- [ ] 每日签到逻辑嵌入 chat 路由

### Phase 3
- [ ] Streak 检测 + 自动发放 streak bonus
- [ ] 积分过期机制（可选：90天未使用的积分过期）
- [ ] 管理后台：调整规则、手动发放/扣除
- [ ] 积分排行榜（可选：社区激励）
