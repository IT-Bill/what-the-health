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
