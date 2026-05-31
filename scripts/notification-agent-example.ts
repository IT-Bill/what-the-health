export {};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type CreateNotificationRequest = {
  userId?: string;
  username?: string;
  title: string;
  body: string;
  source?: string;
  actionUrl?: string | null;
  metadata?: JsonValue;
};

type NotificationResponse = {
  notification: {
    id: string;
    title: string;
    body: string;
    unread: boolean;
    source: string | null;
    actionUrl: string | null;
    metadata: JsonValue;
    deliveredAt: string | null;
    readAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

function printHelp() {
  console.log(`Notification agent example

This script shows how an external agent or automation can send a notification
into Mindful through POST /api/notifications.

Usage:
  pnpm example:notification-agent

Required environment variables:
  NOTIFICATION_API_BASE_URL     Example: http://localhost:3000
  NOTIFICATION_API_SECRET       Shared secret for agent access
  NOTIFICATION_TARGET_USERNAME  Recipient username
  NOTIFICATION_TITLE            Notification title
  NOTIFICATION_BODY             Notification body

Optional environment variables:
  NOTIFICATION_TARGET_USER_ID   Use this instead of username if preferred
  NOTIFICATION_SOURCE           Example: sleep-agent
  NOTIFICATION_ACTION_URL       Example: /memory
  NOTIFICATION_METADATA_JSON    JSON string, example: {"sleepHours":5.8}

Example:
  NOTIFICATION_API_BASE_URL=http://localhost:3000 \
  NOTIFICATION_API_SECRET=dev-secret \
  NOTIFICATION_TARGET_USERNAME=elena \
  NOTIFICATION_TITLE="睡眠建议" \
  NOTIFICATION_BODY="昨晚睡眠偏短，今晚建议提前 30 分钟休息。" \
  NOTIFICATION_SOURCE=sleep-agent \
  NOTIFICATION_ACTION_URL=/memory \
  NOTIFICATION_METADATA_JSON='{"sleepHours":5.8,"severity":"medium"}' \
  pnpm example:notification-agent
`);
}

function parseMetadata(raw: string | undefined): JsonValue | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as JsonValue;
  } catch (error) {
    throw new Error(`NOTIFICATION_METADATA_JSON is not valid JSON: ${String(error)}`);
  }
}

function buildPayload(): CreateNotificationRequest {
  const userId = process.env.NOTIFICATION_TARGET_USER_ID?.trim();
  const username = process.env.NOTIFICATION_TARGET_USERNAME?.trim();
  const title = process.env.NOTIFICATION_TITLE?.trim();
  const body = process.env.NOTIFICATION_BODY?.trim();

  if (!title || !body) {
    throw new Error("NOTIFICATION_TITLE and NOTIFICATION_BODY are required.");
  }

  if (!userId && !username) {
    throw new Error("Provide NOTIFICATION_TARGET_USER_ID or NOTIFICATION_TARGET_USERNAME.");
  }

  return {
    userId: userId || undefined,
    username: username || undefined,
    title,
    body,
    source: process.env.NOTIFICATION_SOURCE?.trim() || "example-agent",
    actionUrl: process.env.NOTIFICATION_ACTION_URL?.trim() || null,
    metadata: parseMetadata(process.env.NOTIFICATION_METADATA_JSON),
  };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const baseUrl = process.env.NOTIFICATION_API_BASE_URL?.trim();
  const secret = process.env.NOTIFICATION_API_SECRET?.trim();

  if (!baseUrl || !secret) {
    throw new Error("NOTIFICATION_API_BASE_URL and NOTIFICATION_API_SECRET are required.");
  }

  const payload = buildPayload();

  const response = await fetch(new URL("/api/notifications", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) as NotificationResponse | { error: string } : null;

  if (!response.ok) {
    throw new Error(
      `Notification send failed with ${response.status}: ${JSON.stringify(data)}`
    );
  }

  const result = data as NotificationResponse;
  console.log("Notification sent successfully:");
  console.log(JSON.stringify(result.notification, null, 2));
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exitCode = 1;
});