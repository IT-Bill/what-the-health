# 好友动态与排行榜系统

## 概述

类似微信运动的社交激励机制：通过好友的健康成就和行为变化，激发用户坚持健康习惯。核心是"身边人的正向改变比陌生博主更有说服力"。

---

## 数据模型

### FriendActivity（好友动态事件）

当用户达成某个可分享的成就时，系统自动生成一条 activity。只有好友开启了对应权限才会被推送。

```prisma
enum ActivityType {
  milestone        // 达成里程碑（连续N天、指标突破等）
  goalAchieved     // 完成健康目标
  sleepImproved    // 睡眠质量显著改善
  productPurchased // 购买商品后指标改善
  postBookmarked   // 收藏/多次浏览帖子
  streakReached    // 连续打卡达标
  reportHighScore  // 周报/月报高分
}

model FriendActivity {
  id        String       @id @default(cuid())
  userId    String       // 产生这个动态的用户
  type      ActivityType
  /// AI 生成的推送文案（针对每个接收者可以不同）
  title     String
  content   String
  /// 关联实体（goalId, productId, postId, reportId 等）
  refType   String?      // "goal" | "product" | "post" | "report"
  refId     String?
  /// 是否对好友可见（用户可以选择隐藏某条动态）
  visible   Boolean      @default(true)

  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([userId, visible, createdAt])
  @@map("friend_activities")
}
```

### FriendNotification（好友推送通知）

为每个应该收到推送的好友生成一条通知（已读/未读）。

```prisma
model FriendNotification {
  id         String   @id @default(cuid())
  recipientId String  // 接收推送的用户
  activityId  String  // 关联的动态
  /// AI 针对接收者个性化生成的推送文案
  message    String
  read       Boolean  @default(false)
  dismissed  Boolean  @default(false)
  createdAt  DateTime @default(now())

  recipient User           @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  activity  FriendActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([recipientId, read, createdAt])
  @@map("friend_notifications")
}
```

### WeeklyLeaderboard（周排行快照）

每周生成一次好友圈排行（类似微信运动排行）。

```prisma
model WeeklyLeaderboard {
  id          String   @id @default(cuid())
  userId      String
  weekStart   DateTime @db.Date
  /// 本周综合评分（来自 Report.overallScore）
  score       Int      @default(0)
  /// 本周步数总计
  totalSteps  Int      @default(0)
  /// 本周运动次数
  workoutCount Int     @default(0)
  /// 本周正念次数
  mindfulCount Int     @default(0)
  /// 排名（在好友圈中）
  rank        Int?

  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([weekStart])
  @@map("weekly_leaderboards")
}
```

---

## AI 推送触发时机

| 触发事件 | 对应 ActivityType | 推送文案模板 |
|---------|-----------------|-------------|
| 用户完成连续7天目标 | streakReached | "您的好友{name}连续{n}天完成了{goal}，想看看TA的计划吗？" |
| 周报评分 > 80 | reportHighScore | "您的好友{name}本周健康评分达到{score}，TA的秘诀是..." |
| 睡眠指标连续改善 | sleepImproved | "您的好友{name}最近用{method}显著提高了睡眠质量，是否需要了解详情？" |
| 完成一个健康目标 | goalAchieved | "您的好友{name}最近达成了{goal}健康目标，想看看TA的计划吗？" |
| 购买商品后指标改善 | productPurchased | "您的好友{name}购买了{product}后，{metric}显著改善，点此了解商品信息" |
| 多次浏览/收藏帖子 | postBookmarked | "近日，您的好友{name}收藏了{post}并多次浏览，查看详情？" |

---

## 隐私控制

### 发送方控制（生成动态时）

1. **全局开关**：用户可以在设置中关闭"向好友分享我的动态"（`User.shareActivities: Boolean`）
2. **单条隐藏**：用户可以在动态列表中隐藏某条具体动态（`FriendActivity.visible = false`）
3. **已有权限系统复用**：动态的推送还需要对应的 `FriendPermission`：
   - milestone/goalAchieved/streakReached → 需要 `goals` 权限
   - sleepImproved/reportHighScore → 需要 `weeklyReport` 或 `monthlyReport` 权限
   - productPurchased → 需要新增 `purchases` 权限
   - postBookmarked → 需要 `posts` 权限

### 接收方控制

1. **关闭推送**：接收方可以关闭某个好友的通知
2. **已读/忽略**：点击"已读"或"忽略"后不再展示

---

## API 设计

### GET /api/notifications

获取当前用户的好友动态通知（未读优先）。

```json
{
  "notifications": [
    {
      "id": "...",
      "message": "您的好友Elena连续21天完成了呼吸练习，想看看TA的计划吗？",
      "type": "streakReached",
      "refType": "goal",
      "refId": "...",
      "friend": { "id": "...", "name": "Elena", "avatarUrl": "..." },
      "read": false,
      "createdAt": "..."
    }
  ],
  "unreadCount": 3
}
```

### PATCH /api/notifications/[id]

标记通知已读或忽略。

```json
{ "action": "read" | "dismiss" }
```

### GET /api/friends/leaderboard?week=2025-05-26

获取本周好友排行榜。

```json
{
  "weekStart": "2025-05-26",
  "leaderboard": [
    { "user": { "id": "...", "name": "Elena", "avatarUrl": "..." }, "score": 82, "totalSteps": 56000, "rank": 1 },
    { "user": { "id": "...", "name": "Bill", "avatarUrl": "..." }, "score": 76, "totalSteps": 42000, "rank": 2 }
  ],
  "myRank": 2
}
```

### POST /api/activities/generate (内部调用)

触发 AI 为指定用户生成动态 + 推送好友通知。由后端事件系统或定时任务调用。

---

## UI 位置

1. **通知入口**：TopAppBar 右上角的铃铛图标 + 未读 badge
2. **通知列表**：点击铃铛展开通知面板/页面
3. **排行榜**：Memory 页面新增"排行"tab，或在 Profile/好友 中展示
4. **动态设置**：Profile → 偏好设置中添加"好友动态"开关

---

## 实现计划

### Phase 1（本次）
- [x] Schema: FriendActivity + FriendNotification + WeeklyLeaderboard
- [x] API: GET/PATCH notifications, GET leaderboard
- [x] 种子数据: 示例动态 + 排行
- [x] UI: 通知列表页 + 排行榜组件

### Phase 2（未来）
- [ ] AI 动态生成管线（触发事件 → LLM 生成文案 → 批量推送）
- [ ] 实时通知（WebSocket/SSE）
- [ ] 设置页：动态可见性控制
- [ ] 排行榜 weekly cron job
