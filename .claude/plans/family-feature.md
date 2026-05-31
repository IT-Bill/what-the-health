# Plan: 家庭功能 (Family Feature)

## 核心场景

老人（被关怀者）+ 子女（关怀者）的远程健康关怀：
1. 子女创建家庭，邀请老人加入
2. 老人通过语音与AI对话（精神陪伴），AI分析老人健康状况
3. 老人的健康数据（穿戴设备同步）自动共享给家庭成员
4. 异常检测：健康指标异常 / 对话中发现不适 → 自动通知子女
5. 老人可设置隐私级别（即使"报喜不报忧"，设备数据仍同步）

## 数据模型设计

### 新模型

```prisma
/// 家庭角色
enum FamilyRole {
  owner       // 创建者/管理员
  caregiver   // 关怀者（子女、配偶等）
  member      // 被关怀者（老人等）
}

/// 家庭关怀级别（决定通知灵敏度）
enum AlertLevel {
  low         // 仅严重异常通知
  medium      // 中等敏感度（默认）
  high        // 高度关注（所有波动都通知）
}

/// 家庭
model Family {
  id          String   @id @default(cuid())
  name        String   // 如 "张家" / "我的家庭"
  description String?
  inviteCode  String   @unique @default(cuid()) // 邀请码
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members FamilyMember[]
  alerts  FamilyAlert[]

  @@map("families")
}

/// 家庭成员
model FamilyMember {
  id         String     @id @default(cuid())
  familyId   String
  userId     String
  role       FamilyRole @default(member)
  nickname   String?    // 在家庭中的昵称（如"爷爷"、"小明"）
  alertLevel AlertLevel @default(medium)
  
  /// 共享设置
  shareHealthData  Boolean @default(true)  // 健康数据对家庭可见
  shareAlerts      Boolean @default(true)  // 异常时通知家庭
  shareMoodHistory Boolean @default(false) // 情绪记录对家庭可见

  joinedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([familyId, userId])
  @@index([userId])
  @@map("family_members")
}

/// 家庭健康预警记录
model FamilyAlert {
  id        String   @id @default(cuid())
  familyId  String
  sourceUserId String  // 触发预警的用户（老人）
  alertType String     // "health-anomaly" | "chat-concern" | "device-alert" | "missed-checkin"
  severity  String     // "info" | "warning" | "critical"
  title     String
  content   String
  metadata  Json?      // 详细数据（哪个指标异常、具体数值等）
  resolved  Boolean @default(false)
  resolvedBy String?
  resolvedAt DateTime?
  
  createdAt DateTime @default(now())

  family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  sourceUser User @relation(fields: [sourceUserId], references: [id], onDelete: Cascade)

  @@index([familyId, createdAt])
  @@index([sourceUserId, createdAt])
  @@map("family_alerts")
}
```

### User 模型扩展

```prisma
model User {
  // ... 已有字段 ...
  familyMembers FamilyMember[]
  familyAlerts  FamilyAlert[]   @relation // 作为 sourceUser
}
```

## API 设计

### 家庭管理
- `POST /api/family` — 创建家庭 `{ name }`
- `GET /api/family` — 获取我所在的家庭列表
- `GET /api/family/[id]` — 获取家庭详情（成员列表、预警历史）
- `PATCH /api/family/[id]` — 更新家庭信息
- `DELETE /api/family/[id]` — 解散家庭（仅owner）

### 成员管理
- `POST /api/family/[id]/invite` — 生成/获取邀请码
- `POST /api/family/join` — 通过邀请码加入 `{ inviteCode, nickname? }`
- `PATCH /api/family/[id]/members/[memberId]` — 更新角色/共享设置/昵称
- `DELETE /api/family/[id]/members/[memberId]` — 移除成员/退出家庭

### 健康数据共享
- `GET /api/family/[id]/health/[userId]` — 查看家庭成员的健康数据（权限检查）
- `GET /api/family/[id]/health/summary` — 家庭健康概览（所有成员摘要）

### 预警
- `GET /api/family/[id]/alerts` — 家庭预警列表
- `PATCH /api/family/[id]/alerts/[alertId]` — 标记已处理
- `POST /api/family/[id]/alerts` — 手动创建预警（内部使用）

## 异常检测机制

### 1. 健康数据异常（定期检查）

触发条件（基于 AlertLevel）：
| 指标 | low | medium | high |
|------|-----|--------|------|
| 心率 >100 持续 >30min | ✓ | ✓ | ✓ |
| 心率 >120 或 <50 | ✓ | ✓ | ✓ |
| 血压 >160/100 | ✓ | ✓ | ✓ |
| 睡眠 <4h 连续3天 | | ✓ | ✓ |
| 步数 = 0 连续2天 | | ✓ | ✓ |
| 血氧 <90% | ✓ | ✓ | ✓ |
| 体重骤变(±3kg/周) | | | ✓ |

实现：在 health import / health record 写入后，触发异常检测。

### 2. 对话异常检测（Chat Agent 扩展）

给 Agent 加一个新 tool `evaluate_health_concern`：
- 对话结束后（或实时），检测用户是否表达了健康不适
- 严重程度评估：info / warning / critical
- 触发：创建 FamilyAlert + 通知所有 caregiver/owner

Prompt 判断维度：
- 用户表达身体疼痛/不适
- 用户提到跌倒、头晕、胸闷等关键症状
- 用户情绪持续低落（连续多次对话负面）
- 用户拒绝就医但症状严重

### 3. 签到异常

如果老人连续 N 天没有任何活动（无对话、无健康数据、无情绪打卡），通知家人。

## 前端页面

### `/profile/family` — 家庭管理页
- 我的家庭列表
- 创建家庭
- 加入家庭（输入邀请码）

### `/profile/family/[id]` — 家庭详情页
- 成员列表（头像、昵称、角色、最后活跃时间）
- 家庭健康概览卡片（每个被关怀成员的今日摘要）
- 预警历史
- 邀请新成员
- 我的共享设置

### `/profile/family/[id]/member/[userId]` — 查看成员健康
- 该成员的健康数据仪表盘
- 最近的情绪记录（如果允许共享）
- 预警历史

## 实现优先级

### P0（核心功能）
- [ ] Family/FamilyMember/FamilyAlert schema + migration
- [ ] 家庭 CRUD API（创建、加入、成员管理）
- [ ] 家庭健康数据查看 API（权限检查）
- [ ] 前端：创建家庭 + 邀请码加入

### P1（预警系统）
- [ ] 健康数据异常检测服务
- [ ] Chat Agent 健康关怀检测 tool
- [ ] 预警 → 通知家庭成员
- [ ] 前端：预警列表 + 标记已处理

### P2（体验优化）
- [ ] 家庭健康概览页
- [ ] 成员健康仪表盘
- [ ] 签到异常检测
- [ ] 邀请码分享（二维码）

## 隐私设计

- 家庭成员可随时退出
- 被关怀者（老人）可控制共享级别：
  - `shareHealthData`: 设备数据是否共享（建议默认开，这是核心功能）
  - `shareAlerts`: 异常时是否通知家人（建议默认开）
  - `shareMoodHistory`: 情绪记录是否共享（建议默认关，保护隐私）
- Owner 可移除成员
- 预警记录保留但可标记"已处理"
