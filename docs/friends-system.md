# 好友系统设计文档

## 概述

好友功能让用户可以互相连接，并选择性地分享自己的健康数据。设计核心原则：

- **主动添加**：通过搜索昵称或账号ID发起好友请求
- **双向确认**：对方同意后才成为好友
- **细粒度权限**：精确控制每个好友能查看你的哪些内容
- **默认隐私**：未授权的内容对好友不可见

---

## 数据模型

### Friendship（好友关系）

```prisma
model Friendship {
  id          String           @id
  requesterId String           // 发起方
  addresseeId String           // 接收方
  status      FriendshipStatus // pending → accepted / blocked
  
  @@unique([requesterId, addresseeId])  // 每对用户只有一条记录
}
```

**状态流转：**
```
发送请求 → pending → 对方接受 → accepted
                   → 对方拒绝 → 删除记录
                   → 任一方屏蔽 → blocked
accepted → 任一方删除 → 删除记录 + 权限
```

### FriendPermission（查看权限）

```prisma
model FriendPermission {
  id      String           @id
  ownerId String           // 内容拥有者（被查看方）
  friendId String          // 查看方（好友）
  content ShareableContent // 允许查看的内容类型
  
  @@unique([ownerId, friendId, content])  // 同一权限不重复
}
```

**可分享的内容类型：**

| content | 说明 | 对应数据 |
|---------|------|----------|
| `weeklyReport` | 周报 | Report (periodType=weekly) |
| `monthlyReport` | 月报 | Report (periodType=monthly) |
| `insights` | AI 洞察 | Insight |
| `goals` | 习惯目标进度 | Goal + HabitCompletion |
| `moodHistory` | 情绪记录 | MoodCheckin |
| `posts` | 发布的文章 | Post |

**权限规则：**
- 默认不分享任何内容（最小权限原则）
- 用户可以随时增加或撤销对某个好友的权限
- 解除好友时自动清除双方所有权限
- 权限是单向的：A允许B看A的周报 ≠ B允许A看B的周报

---

## API 接口

### GET /api/friends

返回好友列表 + 待处理请求。

**Response:**
```json
{
  "friends": [
    { "id": "...", "username": "bill", "name": "Bill", "avatarUrl": null, "friendshipId": "...", "since": "..." }
  ],
  "pendingReceived": [
    { "friendshipId": "...", "user": { "id": "...", "username": "...", "name": "..." }, "createdAt": "..." }
  ],
  "pendingSent": [
    { "friendshipId": "...", "user": { "id": "...", "username": "...", "name": "..." }, "createdAt": "..." }
  ]
}
```

### POST /api/friends

发送好友请求。

**Request:**
```json
{ "username": "bill" }
// 或
{ "userId": "cuid..." }
```

**Response (201):**
```json
{ "friendship": { "id": "...", "status": "pending" }, "message": "好友请求已发送" }
```

**Error cases:**
- 404: 用户不存在
- 400: 不能添加自己
- 409: 已是好友 / 请求已存在
- 403: 被屏蔽

### PATCH /api/friends/[id]

接受/拒绝/屏蔽好友请求。

**Request:**
```json
{ "action": "accept" | "reject" | "block" }
```

- `accept`: 仅接收方可操作，status → accepted
- `reject`: 仅接收方可操作，删除记录
- `block`: 任一方可操作，status → blocked

### DELETE /api/friends/[id]

解除好友关系。删除 friendship 记录 + 双方所有 FriendPermission。

### GET /api/friends/search?q=keyword

搜索用户（通过用户名或昵称）。

**Response:**
```json
[
  {
    "id": "...",
    "username": "bill",
    "name": "Bill",
    "avatarUrl": null,
    "friendshipStatus": null | "friend" | "pending_sent" | "pending_received" | "blocked",
    "friendshipId": null | "..."
  }
]
```

### GET /api/friends/permissions?friendId=xxx

查看对某个好友的权限设置。

**Response:**
```json
{
  "granted": ["weeklyReport", "monthlyReport", "posts", "goals"],  // 我允许对方看的
  "received": ["weeklyReport", "posts"]                             // 对方允许我看的
}
```

### PUT /api/friends/permissions

更新我对某个好友的权限（全量替换）。

**Request:**
```json
{
  "friendId": "...",
  "permissions": ["weeklyReport", "monthlyReport", "insights"]
}
```

---

## 权限检查逻辑

当好友尝试查看我的内容时，后端需检查：

```typescript
async function canFriendView(ownerId: string, friendId: string, content: ShareableContent): Promise<boolean> {
  // 1. 确认是好友关系（status=accepted）
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: ownerId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: ownerId },
      ],
    },
  });
  if (!friendship) return false;

  // 2. 检查是否有对应权限
  const permission = await prisma.friendPermission.findUnique({
    where: { ownerId_friendId_content: { ownerId, friendId, content } },
  });
  return !!permission;
}
```

此函数应在 `/api/memory`、`/api/posts` 等接口中调用，当请求带有 `?viewAs=userId` 参数时进行权限校验。

---

## 查看好友分享内容

### GET /api/friends/[id]/shared

获取好友分享给我的所有内容。`[id]` 为好友的 userId。

后端逻辑：
1. 验证登录态
2. 确认双方是好友（status=accepted）
3. 查询对方授予我的所有 FriendPermission
4. 仅返回有权限的内容类型对应的数据

**Response:**
```json
{
  "friend": { "id": "...", "username": "bill", "name": "Bill", "avatarUrl": null },
  "permissions": ["weeklyReport", "monthlyReport", "goals", "posts"],
  "weeklyReport": { "id": "...", "periodStart": "...", "summary": "...", "data": {...} },
  "monthlyReport": { "id": "...", "periodStart": "...", "summary": "...", "data": {...} },
  "goals": [
    { "id": "...", "title": "Mindful Breath", "icon": "air", "completionsThisWeek": 5 }
  ],
  "posts": [
    { "id": "...", "title": "...", "excerpt": "...", "publishedAt": "..." }
  ]
}
```

未授权的字段不会出现在响应中（如 `insights`、`moodHistory` 未被 `permissions` 包含则不返回）。

---

## UI 页面

### /profile/friends

好友管理页面，包含三个 tab：

| Tab | 功能 |
|-----|------|
| 好友 | 已添加的好友列表，每个好友有"查看分享"和"权限设置"两个操作 |
| 添加 | 搜索用户（username/name），显示关系状态，一键发送请求 |
| 请求 | 收到的请求（接受/拒绝）+ 已发送的请求（等待中）|

**查看分享**（点击👁图标）：
- 弹出面板展示好友授权给你的内容
- 周报/月报：综合评分 + emoji 情绪行 + 概括
- AI 洞察：标题 + 内容摘要
- 目标进度：图标 + 标题 + 本周完成次数
- 情绪记录：emoji + 日期
- 文章：可点击跳转到 /discover/[id]

**权限设置**（点击⚙图标）：
- 6个 toggle 开关控制你分享给对方的内容
- 只读展示对方分享给你的内容标签
- "保存权限" + "解除好友"操作

### /profile 主页

显示 `@username` + 复制按钮，方便分享给好友添加。

---

## Seed 数据

默认 seed 中，elena 和 bill 互为好友，双方互相分享：
- weeklyReport（周报）
- monthlyReport（月报）
- posts（文章）
- goals（目标进度）

其他内容（insights、moodHistory）默认不分享，需要手动开启。

---

## 实现路线图

### Phase 1 ✅
- [x] Schema: Friendship + FriendPermission 表
- [x] API: 搜索、添加、接受/拒绝、删除、权限管理
- [x] Seed: elena ↔ bill 好友 + 默认权限

### Phase 2 ✅
- [x] 好友页面 UI（/profile/friends，3个tab）
- [x] 查看好友分享的内容（SharedContentView 面板）
- [x] GET /api/friends/[id]/shared 端点
- [x] Profile 显示 @username + 复制按钮

### Phase 3
- [ ] 推送通知：好友请求、好友达成里程碑
- [ ] 好友动态 feed（好友最近的文章/成就）
- [ ] 好友排行榜（可选，积分/streak对比）
- [ ] 批量权限模板（"分享全部" / "仅报告" / "自定义"）
