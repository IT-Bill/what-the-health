# Notification API

This project now stores notifications in PostgreSQL via Prisma. The frontend notification center and global toast read from the database; they do not create notifications on their own.

## Overview

- Storage: `notifications` table in Prisma / PostgreSQL
- Current user inbox: `/api/notifications`
- Toast delivery endpoint: `/api/notifications/pull`
- Mutation endpoints: `/api/notifications/[id]`, `/api/notifications/clear`
- External agent send endpoint: `POST /api/notifications`

## Data Model

Each notification stores:

- `id`: notification id
- `userId`: recipient user id
- `title`: short title shown in toast and center
- `body`: full message content
- `source`: optional sender label, e.g. `health-agent`
- `actionUrl`: optional app route or URL for a follow-up action
- `metadata`: optional JSON payload for agent-specific context
- `deliveredAt`: set when the frontend toast first pulls the notification
- `readAt`: set when the user manually dismisses or opens the notification
- `createdAt`, `updatedAt`: timestamps

## Authentication Modes

There are two supported ways to create notifications:

1. Session auth
   Use the logged-in user's cookie. If `userId` / `username` is omitted, the notification is sent to the current user.

2. Internal agent secret
   Set `NOTIFICATION_API_SECRET` in the environment, then send either:
   - `Authorization: Bearer <secret>`
   - `x-notification-secret: <secret>`

The secret is required when an external agent wants to send a notification to another user.

## Endpoints

### `GET /api/notifications`

Returns the current logged-in user's notifications.

Query parameters:

- `limit`: optional, default `50`, max `100`
- `unreadOnly=true`: optional unread filter

Response:

```json
{
  "notifications": [
    {
      "id": "cm...",
      "title": "今日步数达标",
      "body": "你今天已经走了 8,000 步。",
      "unread": true,
      "source": "health-agent",
      "actionUrl": "/profile/health-data",
      "metadata": { "metric": "steps" },
      "deliveredAt": null,
      "readAt": null,
      "createdAt": "2026-05-31T12:00:00.000Z",
      "updatedAt": "2026-05-31T12:00:00.000Z"
    }
  ]
}
```

### `POST /api/notifications`

Creates a notification.

Request body:

```json
{
  "userId": "optional-recipient-id",
  "username": "optional-recipient-username",
  "title": "今日步数达标",
  "body": "你今天已经走了 8,000 步。",
  "source": "health-agent",
  "actionUrl": "/profile/health-data",
  "metadata": {
    "metric": "steps",
    "value": 8000
  }
}
```

Rules:

- `title` and `body` are required.
- If no recipient is provided and the caller has a session cookie, the notification goes to the current user.
- To target another user, provide `userId` or `username` and authenticate with `NOTIFICATION_API_SECRET`.

Example with secret:

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NOTIFICATION_API_SECRET" \
  -d '{
    "username": "demo_user",
    "title": "睡眠建议",
    "body": "昨晚睡眠偏短，今晚建议提前 30 分钟休息。",
    "source": "sleep-agent",
    "actionUrl": "/memory",
    "metadata": {"sleepHours": 5.8}
  }'
```

### `POST /api/notifications/pull`

Used by the frontend toast. Returns the oldest notification for the current user whose `deliveredAt` is still `null`, and marks that record as delivered.

Response:

```json
{
  "notification": {
    "id": "cm...",
    "title": "休息提醒",
    "body": "久坐已超过 60 分钟，建议起身活动。",
    "unread": true,
    "source": "wellness-agent",
    "actionUrl": "/chat",
    "metadata": null,
    "deliveredAt": "2026-05-31T12:15:00.000Z",
    "readAt": null,
    "createdAt": "2026-05-31T12:14:58.000Z",
    "updatedAt": "2026-05-31T12:15:00.000Z"
  }
}
```

If there is no pending notification:

```json
{
  "notification": null
}
```

### `PATCH /api/notifications/[id]`

Updates the current user's notification read state.

Request body:

```json
{
  "action": "read"
}
```

Also supports:

```json
{
  "action": "unread"
}
```

### `DELETE /api/notifications/[id]`

Deletes one notification belonging to the current user.

### `POST /api/notifications/clear`

Deletes all notifications belonging to the current user.

## Frontend Behavior

- The notification center reads from `GET /api/notifications`.
- The toast no longer generates notifications locally.
- The toast periodically checks `POST /api/notifications/pull` for undelivered notifications.
- If the user manually closes a toast, the frontend marks it as read through `PATCH /api/notifications/[id]`.
- If the toast disappears automatically, it stays unread.

## Collaboration Contract For Other Agents

If another agent wants to send a notification, it only needs to call `POST /api/notifications` with:

- recipient: `userId` or `username`
- content: `title`, `body`
- optional routing: `actionUrl`
- optional structured payload: `metadata`
- optional agent name: `source`

This keeps scheduling and message generation fully outside the frontend.

### Agent Example

There is a runnable sender example at `scripts/notification-agent-example.ts`.

Run help:

```bash
pnpm example:notification-agent --help
```

Typical usage:

```bash
NOTIFICATION_API_BASE_URL=http://localhost:3000 \
NOTIFICATION_API_SECRET=your-secret \
NOTIFICATION_TARGET_USERNAME=elena \
NOTIFICATION_TITLE="睡眠建议" \
NOTIFICATION_BODY="昨晚睡眠偏短，今晚建议提前 30 分钟休息。" \
NOTIFICATION_SOURCE=sleep-agent \
NOTIFICATION_ACTION_URL=/memory \
NOTIFICATION_METADATA_JSON='{"sleepHours":5.8,"severity":"medium"}' \
pnpm example:notification-agent
```

The script sends this shape:

```json
{
  "username": "elena",
  "title": "睡眠建议",
  "body": "昨晚睡眠偏短，今晚建议提前 30 分钟休息。",
  "source": "sleep-agent",
  "actionUrl": "/memory",
  "metadata": {
    "sleepHours": 5.8,
    "severity": "medium"
  }
}
```

For cooperators building their own agent, the minimal flow is:

1. Decide the recipient with `userId` or `username`.
2. Generate `title`, `body`, and optional `actionUrl`.
3. Send `POST /api/notifications` with `Authorization: Bearer $NOTIFICATION_API_SECRET`.
4. Let the frontend toast and notification center handle delivery and read state.

## Testbench

There is a runnable integration testbench at `scripts/notification-api-testbench.ts`.

Run the smoke flow:

```bash
NOTIFICATION_TEST_USERNAME=test_user \
NOTIFICATION_TEST_PASSWORD=test_pass \
pnpm test:notifications
```

Run the full flow against a disposable account:

```bash
NOTIFICATION_TEST_USERNAME=test_user \
NOTIFICATION_TEST_PASSWORD=test_pass \
pnpm test:notifications --full
```

Leave a pending notification for the browser toast to display:

```bash
NOTIFICATION_TEST_USERNAME=test_user \
NOTIFICATION_TEST_PASSWORD=test_pass \
pnpm test:notifications --keep
```

Optional secret-backed create flow:

```bash
NOTIFICATION_TEST_USERNAME=test_user \
NOTIFICATION_TEST_PASSWORD=test_pass \
NOTIFICATION_API_SECRET=your-secret \
pnpm test:notifications --use-secret
```

The smoke flow checks:

- unauthenticated access rejection
- login/session auth
- create notification
- list notification
- mark read / unread
- delete notification

With `--keep`, the created notification is not deleted, so a browser session logged in as the same user can pull it and show the popup.

The full flow additionally checks:

- pull endpoint delivery behavior
- clear-all endpoint

Use a dedicated test account for `--full`, because it clears the inbox before and after the run.