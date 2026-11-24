# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: an online platform to play retro games in the browser and compete for the highest score. UI text is in Spanish.

Spec Driven Design: every feature starts as a spec in `specs/NN-slug.md` (`Draft` → `Aprobado` → `Implementado`), written with `/spec` and implemented with `/spec-impl`. `specs/.spec-config.yml` sets `AutoCreateBranch: true` (branch `spec-NN-slug`) and `AutoCommitSteps: false`. Specs 01–14 exist (01–12 `Implementado`; check 13's and 14's status in the file); ideas in draft from game jams live in `specs/game-jam/<game-id>/`; read the relevant one before changing a feature. Never mark a spec `Aprobado` yourself.

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
- `/spec-impl-game` (`.claude/skills/spec-impl-game/`, user-invoked only): same as the global `/spec-impl` (approved spec → branch → step-by-step implementation) and, when the last step is done, runs the `skin-designer` and then the `mobile-porter` agents on the spec's game, strictly one after the other (both edit `ENGINES.<id>`). Use it for game specs; use `/spec-impl` for the rest.
- PostToolUse hook (`.claude/hooks/format-and-lint.sh`): runs Prettier and `eslint --fix` on every file written or edited (skips `node_modules`, `.next`, `references`). An ESLint error blocks the edit, so fix it rather than ignore it.
- `.mcp.json` configures the Supabase MCP server for this project (migrations, SQL, type generation, advisors).

## Agents

Definitions in `.claude/agents/<name>.md` (read the file for role, tools and rules); each keeps memory in `.claude/agent-memory/<name>/`.

- `game-planner`
- `game-jam`
- `skin-designer`
- `mobile-porter`

## Architecture

- Routes (`app/`): `/` Home, `/games` library, `/games/[id]` detail + top 10, `/games/[id]/play` player, `/hall-of-fame`, `/about` (contact form via Resend server action in `app/about/actions.ts`), `/auth` (login/registro/recuperación, reads `?next=` and `?error=`), `/auth/callback` (route handler: PKCE `exchangeCodeForSession` for email confirmation, OAuth and password recovery), `/auth/reset`.
- Pages are thin server components; UI lives in `app/components/*View.tsx`. Data access lives in `app/data/` (`games.ts`, `scores.ts`, `activity.ts`) and `app/lib/scores.ts`; async data is wrapped in `<Suspense>` (required by `cacheComponents`).
- Session is Supabase Auth (SPEC 13): email + password, Google and GitHub, email confirmation required, password recovery. `SessionProvider` (`app/components/SessionProvider.tsx`) subscribes to `onAuthStateChange` and exposes `useSession()` → `{ user: { id, name } | null, signOut }` through `useSyncExternalStore` with a signed-out `getServerSnapshot` (do not read the user from the context or the server in the layout: it breaks hydration under `<Suspense>` / `cacheComponents`). The player name is `user_metadata.username` (uppercase, `USERNAME_RE`), with `deriveUsername` as fallback; there is no `profiles` table and names are not unique. Helpers in `app/lib/auth/` (`username.ts`, `redirect.ts` with `safeNext` for `?next=`, `errors.ts` for Spanish error texts, `password.ts`: the single source of the new-password rule, see Security). Guest mode stays: saving a score never requires an account.
- Design reference: `references/templates/` (original JSX/HTML mockups and `styles.css`). Styles are global classes in `app/globals.css`, including one `.cover-<id>` CSS cover per game.

### Supabase

- Clients in `app/lib/supabase/`: `server.ts` (per request, cookies), `client.ts` (browser), `public.ts` (read-only, no cookies: usable in `generateStaticParams` and outside requests), `proxy.ts` (`updateSession`, called from root `proxy.ts`, which replaces `middleware.ts` in this Next.js version; besides refreshing the session it redirects `/auth` with a session to `?next`/`/`, `/auth/reset` without one to `/auth`, and any `PROTECTED_PREFIXES` entry without one to `/auth?next=`; the list is empty today, there is no private zone).
- Schema: tables `games` and `scores` (RLS: public select; insert policy `scores_insert_own_or_guest`: `user_id is null or user_id = auth.uid()`; `scores.user_id` is optional and references `auth.users` with `on delete set null`; views do not expose it), views `games_with_stats`, `game_best_scores`, `top_players`. `best`/`plays` always come from `scores`, never hardcoded. View columns are typed `| null`; narrow them as `app/data/games.ts` does.
- `database.types.ts` is generated; regenerate it (Supabase MCP) after schema changes.
- Always add a new migration in `supabase/migrations/`; never edit an applied one. Never use `service_role` in code.

### Security (SPEC 14)

- Headers: `next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security` (no `preload`) and `Permissions-Policy` (camera, microphone, geolocation; never add `gamepad`, the gamepad controls need it) on `/(.*)`. No CSP (needs nonces with `cacheComponents`).
- Password rule for new passwords (signup and `/auth/reset`): 8+ characters with lowercase, uppercase, digit and symbol (Supabase's symbol set; `ñ` and spaces do not count). `app/lib/auth/password.ts` holds `MIN_PASSWORD`, `PASSWORD_RE`, `passwordChecks`, `isValidPassword` and the error text; `PasswordRules.tsx` shows the live checklist. Login does not validate composition. The real barrier is the Supabase panel setting (min length 8, "Lowercase, uppercase letters, digits and symbols"), not the regex.
- `public.rls_auto_enable()` (platform function behind the `ensure_rls` event trigger, which turns on RLS for new `public` tables) has `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated` (migration `20261124104917`). Do not grant it back; the trigger does not need it.
- Advisor exception: `auth_leaked_password_protection` stays as the only security warning. It needs the Pro plan; the project is on Free (checked 2026-11-24). Enable it in the panel if the plan changes.
- Sign-up/sign-in rate limit: Supabase's own, set to 5 per 5 minutes per IP in the panel (one shared limit, so it also limits logins from a shared network). No CAPTCHA. The panel is not verifiable from the repo.
- Run `get_advisors` (security) at the end of every spec that touches the schema: default privileges still give `EXECUTE` to `PUBLIC` on new functions.

### Games

- Engine contract in `app/lib/games/types.ts` (`GameEngineFactory`, `GameStats`, events). Real engines are registered by id in `app/lib/games/registry.ts` (`ENGINES`): `asteroids`, `tetris`, `arkanoid`, `snake`, each in `app/games/<id>/` as plain TypeScript (no React, no global state, single canvas 800×600).
- `GameCanvas` mounts/destroys the engine; `GamePlayer` renders the HTML HUD, pause/game over and the save-score modal. Saving is offered only when `ENGINES[game.id]` exists; other catalog games (`gloton`, `invasores`, `ranaria`, `duelo-pixel`; `ranaria` is distinct from `frogger`) still run the fake simulation.
- The simulated duplicates `bloque-buster`, `caida`, `serpentina`, `rocas` were removed (migration `20261119140000_remove_simulated_games.sql`, plus their CSS covers).
- Catalog of games: `references/implemented-games.md` (outdated: it only lists the first four engines; the `games` table is the source of truth).
- To add a game, use `/nuevo-juego`; follow its rules (destroy cancels rAF and listeners, `onStats` only on change, `onGameOver` once, keyboard on `window` ignoring form fields).

## Stack and gotchas

- Next.js 16.4.6, React 19.3, Tailwind CSS 4, TypeScript (strict), App Router (`app/`), no `src/` dir. Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Resend.
- **Next.js here has breaking changes from what you may know.** `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code, and heeding deprecation notices.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`, and defines the security headers. `cacheComponents` changes caching/rendering semantics for App Router, so check the docs before using data fetching or dynamic APIs.
- Tailwind is wired through Turbopack: `next.config.ts` has a `turbopack.rules` entry running `@tailwindcss/turbopack` on `*.css` (no PostCSS config). Theme tokens live in `app/globals.css` via `@theme inline`.
- Page/layout props use the globally generated `PageProps<"/route">` / `LayoutProps<"/">` types (no import needed).
- Only `NEXT_PUBLIC_*` vars referenced literally are inlined in the browser; don't read them with `process.env[name]`.
