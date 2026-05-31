# Notification Toast

This document describes the global notification toast component and how to use or extend it.

## Overview

The notification toast is a lightweight, global reminder that appears at the top of the screen.
It auto-shows on a timer, auto-dismisses after a short delay, and supports manual dismissal by:
- Tapping the close icon (X)
- Tapping the "知道了" button
- Swiping upward past a threshold

The component is mounted in the root layout so it is available across all pages.

## File Locations

- Component: src/components/notification-toast.tsx
- Mounted in: src/app/layout.tsx

## Behavior

- First appearance: 15 seconds after the page loads
- Repeat interval: every 45 minutes
- Auto-close: 8 seconds after showing
- Dismiss: click or swipe up

The schedule is stored in localStorage to avoid over-notifying.

## Key Constants

Edit these values to tune the behavior:

- INITIAL_DELAY_MS: time before first appearance (default 15000)
- REPEAT_INTERVAL_MS: time between reminders (default 45 minutes)
- AUTO_CLOSE_MS: auto-dismiss delay after showing (default 8000)
- SWIPE_DISMISS_THRESHOLD: swipe-up distance to dismiss (default 90px)

## Visual Placement

The toast renders at the top of the viewport and uses the project design system tokens:
- Surfaces: surface-container-highest
- Text: on-surface / on-surface-variant
- Accent: secondary

## How It Works

- On mount, a timer is scheduled based on localStorage or the initial delay.
- When visible, an auto-close timer is started.
- Dismiss actions clear the current state and schedule the next appearance.
- Pointer handling supports swipe-up dismissal without blocking button clicks.

## Usage Notes

- The component is a client component and must remain under "use client".
- It assumes a browser environment (uses localStorage). Do not render on the server.
- If you need a manual trigger for debugging, add a button in the component and call show().

## Troubleshooting

- No appearance: clear localStorage key "mindful.notification.nextShowAt" and reload.
- Click does not close: ensure pointer handlers only capture on the card itself.
- Cross-device: verify localStorage availability (private mode can disable it).
