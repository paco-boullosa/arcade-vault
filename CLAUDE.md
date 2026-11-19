# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: an online platform to play retro games in the browser and compete for the highest score. UI text is in Spanish.

Spec Driven Design: every feature starts as a spec in `specs/NN-slug.md` (`Draft` → `Aprobado` → `Implementado`), written with `/spec` and implemented with `/spec-impl`. `specs/.spec-config.yml` sets `AutoCreateBranch: true` (branch `spec-NN-slug`) and `AutoCommitSteps: false`. Specs 01–09 exist; read the relevant one before changing a feature. Never mark a spec `Aprobado` yourself.

No test runner is configured. Verify with `npx tsc --noEmit`, `npm run lint` and the running app.

## Commands

```bash
npm run dev             # next dev (Turbopack)
npm run build           # next build
npm run lint            # eslint (flat config, eslint.config.mjs + prettier)
npm run format          # prettier --write .
npm run check:supabase  # tsx script that checks the Supabase connection (reads .env.local)
```

Env vars: see `.env.example` (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASS`).

## Skills, hooks and MCP

- Usa siempre /frontend-design para diseñar la interfaz de usuario.
- `/nuevo-juego` (`.claude/skills/nuevo-juego/`): workflow to port a game from `references/started-games/` or create a new one, wired to the leaderboard. Spec first (Draft, wait for approval), then engine, registry, cover, `games` row and verification. Its `references/` (engine contract, platform integration, spec template, verification) are the source of truth for adding games.
- PostToolUse hook (`.claude/hooks/format-and-lint.sh`): runs Prettier and `eslint --fix` on every file written or edited (skips `node_modules`, `.next`, `references`). An ESLint error blocks the edit, so fix it rather than ignore it.
- `.mcp.json` configures the Supabase MCP server for this project (migrations, SQL, type generation, advisors).

## Agents

- `game-planner` agent (`.claude/agents/game-planner.md`): decides which game fits the platform before `/nuevo-juego`. Logs every proposal (including other people's suggestions) in `references/game-planner-todo.md` and keeps project memory in `.claude/agent-memory/game-planner/`. It never writes code or specs.


## Architecture

- Routes (`app/`): `/` Home, `/games` library, `/games/[id]` detail + top 10, `/games/[id]/play` player, `/hall-of-fame`, `/about` (contact form via Resend server action in `app/about/actions.ts`), `/auth`.
- Pages are thin server components; UI lives in `app/components/*View.tsx`. Data access lives in `app/data/` (`games.ts`, `scores.ts`, `activity.ts`) and `app/lib/scores.ts`; async data is wrapped in `<Suspense>` (required by `cacheComponents`).
- Session is local only: `SessionProvider` stores `{ name }` in `localStorage` (`av_user`) via `useSyncExternalStore`. There is no Supabase Auth yet; the player name is used when saving scores.
- Design reference: `references/templates/` (original JSX/HTML mockups and `styles.css`). Styles are global classes in `app/globals.css`, including one `.cover-<id>` CSS cover per game.

### Supabase

- Clients in `app/lib/supabase/`: `server.ts` (per request, cookies), `client.ts` (browser), `public.ts` (read-only, no cookies: usable in `generateStaticParams` and outside requests), `proxy.ts` (`updateSession`, called from root `proxy.ts`, which replaces `middleware.ts` in this Next.js version).
- Schema: tables `games` and `scores` (RLS: public select, public insert on `scores`), views `games_with_stats`, `game_best_scores`, `top_players`. `best`/`plays` always come from `scores`, never hardcoded. View columns are typed `| null`; narrow them as `app/data/games.ts` does.
- `database.types.ts` is generated; regenerate it (Supabase MCP) after schema changes.
- Always add a new migration in `supabase/migrations/`; never edit an applied one. Never use `service_role` in code.

### Games

- Engine contract in `app/lib/games/types.ts` (`GameEngineFactory`, `GameStats`, events). Real engines are registered by id in `app/lib/games/registry.ts` (`ENGINES`): `asteroids`, `tetris`, `arkanoid`, `snake`, each in `app/games/<id>/` as plain TypeScript (no React, no global state, single canvas 800×600).
- `GameCanvas` mounts/destroys the engine; `GamePlayer` renders the HTML HUD, pause/game over and the save-score modal. Saving is offered only when `ENGINES[game.id]` exists; other catalog games (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) still run the fake simulation.
- The simulated duplicates `bloque-buster`, `caida`, `serpentina`, `rocas` were removed (migration `20261119140000_remove_simulated_games.sql`, plus their CSS covers).
- Full catalog of games: `references/implemented-games.md`.
- To add a game, use `/nuevo-juego`; follow its rules (destroy cancels rAF and listeners, `onStats` only on change, `onGameOver` once, keyboard on `window` ignoring form fields).

## Stack and gotchas

- Next.js 16.4.6, React 19.3, Tailwind CSS 4, TypeScript (strict), App Router (`app/`), no `src/` dir. Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Resend.
- **Next.js here has breaking changes from what you may know.** `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code, and heeding deprecation notices.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`. `cacheComponents` changes caching/rendering semantics for App Router, so check the docs before using data fetching or dynamic APIs.
- Tailwind is wired through Turbopack: `next.config.ts` has a `turbopack.rules` entry running `@tailwindcss/turbopack` on `*.css` (no PostCSS config). Theme tokens live in `app/globals.css` via `@theme inline`.
- Page/layout props use the globally generated `PageProps<"/route">` / `LayoutProps<"/">` types (no import needed).
- Only `NEXT_PUBLIC_*` vars referenced literally are inlined in the browser; don't read them with `process.env[name]`.
