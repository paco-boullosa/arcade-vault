# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: an online platform to play games and compete for the highest score. The README says the project follows Spec Driven Design, based on `/spec` and `/spec-impl` (these are workflow commands; no spec files exist in the repo yet).

Currently a fresh `create-next-app` scaffold (single `app/page.tsx`, default metadata in `app/layout.tsx`).

## Commands

```bash
npm run dev     # next dev (Turbopack)
npm run build   # next build
npm run start   # next start
npm run lint    # eslint (flat config in eslint.config.mjs)
```

No test runner is configured.

## Stack and gotchas

- Next.js 16.4.6, React 19.3, Tailwind CSS 4, TypeScript (strict), App Router (`app/`), no `src/` dir.
- **Next.js here has breaking changes from what you may know.** `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code, and heeding deprecation notices.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`. `cacheComponents` changes caching/rendering semantics for App Router, so check the docs before using data fetching or dynamic APIs.
- Tailwind is wired through Turbopack: `next.config.ts` has a `turbopack.rules` entry running `@tailwindcss/turbopack` on `*.css` (no PostCSS config). Theme tokens live in `app/globals.css` via `@theme inline`, with light/dark CSS variables.
- Layout props use the globally generated `LayoutProps<"/">` type (no import needed).
