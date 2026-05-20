# Quran Tracer

An iPad-optimized web app for tracing Arabic Quranic text. Designed for students learning to write Arabic script — load any surah, then trace over the verses with an Apple Pencil, finger, or mouse. Submisoin for Quran Foundation Hackathon 2026-Made by Khadijah, 16 year old devloper.

🔗 **Live app:** https://qurantracer.net/

## Features

- **All 114 surahs** loaded live from the public quran.com API
- **Authentic Arabic typography** using QPC v2 page fonts (the same script style as printed mushafs)
- **Continuous-scroll reading** — flip through entire surahs without page breaks
- **Apple Pencil support** with full pressure sensitivity, plus finger and mouse input
- **Trace Mode** toggle — turn on to draw, turn off to scroll naturally
- **Eraser** that's mutually exclusive with Trace (never on at the same time)
- **Pen settings** — color presets, custom color picker, thickness (1–40px), opacity
- **Show / Hide text** toggle for tracing vs. memory practice
- **Per-surah stroke persistence** — your work is saved between sessions
- **Undo, Clear, Bookmark, and Dark Mode**
- **Light & dark themes** with high-contrast Arabic text in both

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Drawing:** HTML Canvas with Pointer Events API
- **Data:** quran.com REST API v4 (no auth required)
- **Monorepo:** pnpm workspaces

## Project Structure

This project is part of a pnpm monorepo. The main app lives in `artifacts/quran-tracer/`.

```
artifacts/quran-tracer/
├── src/
│   ├── pages/TracerPage.tsx        # Main layout & toolbar
│   ├── components/
│   │   ├── SurahDisplay.tsx        # Continuous-scroll renderer + drawing canvas
│   │   ├── SurahNav.tsx            # Surah picker / navigation
│   │   └── Toolbar.tsx             # Pen settings panel
│   ├── hooks/
│   │   ├── useCanvas.ts            # Drawing engine, undo, persistence
│   │   └── useQuran.ts             # Quran API state hook
│   └── services/quranApi.ts        # quran.com API client
└── ...
```

## Running Locally

Requires Node.js 24 and pnpm.

```bash
pnpm install
pnpm --filter @workspace/quran-tracer run dev
```

The app will be available on the local Vite dev server. To typecheck:

```bash
pnpm --filter @workspace/quran-tracer run typecheck
```

## Credits

- Quran text and translations from [quran.com](https://quran.com) (powered by the same data as the [Quran MCP](https://mcp.quran.ai/))
- Translation: Dr. Mustafa Khattab — *The Clear Quran*
- Arabic fonts: QPC v2 page fonts + Amiri Quran fallback

## License

Personal / educational use.
