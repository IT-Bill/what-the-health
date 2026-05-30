# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev         # Start dev server at localhost:3000
pnpm build       # Production build (uses Turbopack)
pnpm lint        # ESLint
```

## Architecture

This is a **Next.js 16** App Router project (React 19, Tailwind CSS v4, TypeScript) implementing a "Quiet Luxury Wellness" mobile-first health app called **Mindful**.

### Design System

The design system is defined in `design/quiet_luxury_wellness/DESIGN.md` and implemented via Tailwind v4's `@theme inline` in `src/app/globals.css`. Key conventions:

- **Colors**: Material Design 3 tonal palette (surface, primary, secondary, tertiary + on-* variants). Use semantic color names like `bg-primary-container`, `text-on-surface-variant`.
- **Typography**: Playfair Display (headings via `font-[var(--font-display)]`) and Geist (body via `font-[var(--font-body)]`). Loaded via `<link>` tags in the root layout, not `next/font/google` (build environment lacks network access).
- **Icons**: Material Symbols Outlined, used as `<span className="material-symbols-outlined">icon_name</span>`. Fill state toggled via `style={{ fontVariationSettings: "'FILL' 1" }}`.
- **Utilities**: `.ambient-shadow` and `.glass-panel` are defined in globals.css for the design system's elevation patterns.

### Routing & Navigation

Pages fall into two categories:

1. **Shell pages** (`/`, `/discover`, `/memory`, `/profile`) — wrapped in `<AppShell>` which provides `TopAppBar` + `BottomNavBar`.
2. **Standalone pages** (`/login`, `/onboarding/*`, `/shop`) — have their own headers, no shared nav shell. These are transactional/linear flows.

### Shared Components (`src/components/`)

- `AppShell` — layout wrapper combining TopAppBar + BottomNavBar + main content area
- `TopAppBar` — fixed header with configurable icons/links
- `BottomNavBar` — client component with active state derived from `usePathname()`

### Key Constraints

- External images are hosted on `lh3.googleusercontent.com` — configured in `next.config.ts` `images.remotePatterns`.
- The build environment cannot fetch from Google Fonts at build time. Fonts are loaded at runtime via `<link>` tags.
- All interactive pages must be marked `"use client"` — the App Router defaults to Server Components.

### Database & Migrations

- **Prisma 7** with `@prisma/adapter-pg` driver adapter. Connection URLs live in `prisma.config.ts` (not in schema.prisma).
- **Never delete existing migration files.** Migrations are incremental — always add new ones after existing ones. Use `prisma migrate diff --from-migrations --to-schema` to generate only the delta SQL for new schema changes.
- The current baseline migration (`20260530120000_init`) covers the full schema from empty. All future changes must be separate migration files appended after it.
- Generated Prisma client outputs to `src/generated/prisma/` (gitignored, regenerated via `pnpm exec prisma generate`).
- Seed: `pnpm exec prisma db seed` — reads `SEED_USERS` from `.env` (format: `"user1:pass1,user2:pass2"`).
- Local dev DB: Docker `postgres:17-bookworm` on `localhost:5432/postgres`. Rebuild: `prisma migrate deploy` then `prisma db seed`.

## Voice Input (ASR)

The chat page supports voice input via **Volcano Engine (Doubao) Streaming ASR**.

### Architecture

Browser WebSocket cannot set custom HTTP headers (required by Doubao auth), so a **backend proxy** is mandatory.

```
Dev:
  Browser → ws://localhost:3001 → src/server/asr-proxy.ts → Doubao ASR
  Browser → http://localhost:3000 → Next.js dev server

Production:
  Browser → wss://domain/api/asr → Nginx → localhost:3001 (asr-proxy)
  Browser → https://domain/*      → Nginx → localhost:3000 (Next.js)
```

### Dev Setup

```bash
pnpm dev          # Starts both Next.js (3000) and ASR proxy (3001) via concurrently
pnpm asr-proxy    # Start only the ASR proxy (port 3001)
```

Requires env vars in `.env.local`:
- `ASR_APP_ID`
- `ASR_ACCESS_TOKEN`
- `ASR_RESOURCE_ID` (e.g. `volc.bigasr.sauc.duration` for hourly billing)

### Production Deployment (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/asr {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

The frontend auto-detects dev vs prod:
- Dev (`localhost`): connects directly to `ws://localhost:3001`
- Prod: connects to `wss://domain/api/asr` (routed by Nginx)
