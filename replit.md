# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Quran Tracer (`artifacts/quran-tracer`)
- **Kind**: React + Vite web app
- **Preview Path**: `/`
- **Purpose**: iPad-optimized Quran tracing app for students

**Features:**
- Arabic text display using Scheherazade New / Amiri fonts (Google Fonts)
- Dual-canvas system: text layer (render-only) + drawing layer (interactive)
- Full pointer events API — supports Apple Pencil pressure, touch, and mouse
- Pen settings: color presets + custom color picker, thickness (1–40px), opacity (5–100%)
- Show/hide text toggle for tracing vs. memory practice
- Undo (up to 30 steps), Clear, Save as PNG download
- Light/dark mode
- 15 pre-loaded verses from Al-Fatiha, Al-Ikhlas, Al-Falaq, An-Nas, Al-Baqarah, Al-Kawthar
- Verse navigation: prev/next buttons + direct select list with Arabic preview

**Data Source:**
- Live Quran data from `api.quran.com/api/v4` (no auth required, public REST API)
- Powered by the same data as the Quran MCP at https://mcp.quran.ai/
- Translation ID 131 = Dr. Mustafa Khattab "The Clear Quran"
- All 114 surahs with full Uthmani Arabic text, verse count, verse-by-verse navigation

**Key Files:**
- `src/pages/TracerPage.tsx` — main layout
- `src/components/TracingCanvas.tsx` — canvas drawing engine
- `src/components/Toolbar.tsx` — pen settings + actions panel
- `src/components/VerseNav.tsx` — surah browser + verse navigation panel
- `src/hooks/useCanvas.ts` — drawing logic, undo/redo, download
- `src/hooks/useQuran.ts` — React hook for Quran API state
- `src/services/quranApi.ts` — quran.com REST API client with caching
