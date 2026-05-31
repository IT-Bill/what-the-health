export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  unread: boolean;
  source: string | null;
  actionUrl: string | null;
  metadata: unknown | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationListResponse = {
  notifications: NotificationItem[];
};

export type PullNotificationResponse = {
  notification: NotificationItem | null;
};

export type NotificationMutationResponse = {
  notification: NotificationItem;
};

export type CreateNotificationRequest = {
  userId?: string;
  username?: string;
  title: string;
  body: string;
  source?: string;
  actionUrl?: string | null;
  metadata?: unknown | null;
};

type NotificationRecordLike = {
  id: string;
  title: string;
  body: string;
  source: string | null;
  actionUrl: string | null;
  metadata: unknown | null;
  deliveredAt: Date | string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function toNotificationItem(notification: NotificationRecordLike): NotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    unread: notification.readAt == null,
    source: notification.source,
    actionUrl: notification.actionUrl,
    metadata: notification.metadata,
    deliveredAt: toIsoString(notification.deliveredAt),
    readAt: toIsoString(notification.readAt),
    createdAt: toIsoString(notification.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(notification.updatedAt) ?? new Date(0).toISOString(),
  };
}

export function formatNotificationTime(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMinutes = Math.max(Math.round(diffMs / 60000), 0);

  if (diffMinutes < 1) {
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} 天前`;
}