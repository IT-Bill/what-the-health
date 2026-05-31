# Notification Toast

This document describes the global notification toast component after the database-backed notification rebuild.

## Overview

The notification toast is a lightweight, global notification surface that appears at the top of the screen.
It no longer creates reminders on a client timer. Instead, it polls the backend for pending notifications and displays them when available.

It auto-dismisses after a short delay and supports manual dismissal by:
- Tapping the close icon (X)
- Tapping the "知道了" button
- Swiping upward past a threshold

The component is mounted in the root layout so it is available across all pages.

## File Locations

- Component: src/components/notification-toast.tsx
- Mounted in: src/app/layout.tsx

## Behavior

- Polls the backend for undelivered notifications while the page is active
- Auto-close: 8 seconds after showing
- Manual dismiss marks the notification as read
- Auto-close leaves the notification unread
- Optional `actionUrl` can render a "查看" action button

## Key Constants

Edit these values to tune the behavior:

- `POLL_INTERVAL_MS`: inbox poll interval for new pending notifications
- `AUTO_CLOSE_MS`: auto-dismiss delay after showing
- `SWIPE_DISMISS_THRESHOLD`: swipe-up distance to dismiss

## Visual Placement

The toast renders at the top of the viewport and uses the project design system tokens:
- Surfaces: surface-container-highest
- Text: on-surface / on-surface-variant
- Accent: secondary

## How It Works

- On mount, the component calls `POST /api/notifications/pull`.
- While the page stays open, it keeps checking for undelivered notifications.
- When one is returned, the toast renders the server-provided title/body.
- Manual dismiss marks the notification as read with `PATCH /api/notifications/[id]`.
- Pointer handling supports swipe-up dismissal without blocking button clicks.

## Usage Notes

- The component is a client component and must remain under `"use client"`.
- Notification content now comes from the database, not localStorage.
- If another system should generate notifications, integrate it with `POST /api/notifications`.
- See `docs/notification-api.md` for the external agent contract.

## Troubleshooting

- No appearance: confirm the user has pending records in the `notifications` table and that `POST /api/notifications/pull` returns a notification.
- Click does not close: ensure pointer handlers only capture on the card itself.
- External sender cannot create notifications: verify `NOTIFICATION_API_SECRET` and the request headers.
