---
name: nuevo-juego
description: Crea e integra un juego en Arcade Vault con su leaderboard. Portando un juego de references/started-games (Tetris, Arkanoid...) a un motor TypeScript con canvas, o creando uno nuevo desde cero. Primero redacta la spec (Draft) y, tras la aprobación, implementa motor, registro, portada, fila en Supabase y verificación. Úsalo siempre que el usuario pida añadir, portar, integrar o crear un juego, conectar un juego al catálogo o al ranking, darle motor real a un juego simulado (caida, bloque-buster...), o mencione Tetris, Arkanoid o "started-games", aunque no diga la palabra "skill".
argument-hint: "juego de references/started-games o descripción de un juego nuevo"
---

# /nuevo-juego — Crear e integrar un juego con leaderboard

Repite lo que hicieron SPEC 05 (Asteroides: motor + canvas) y SPEC 06 (leaderboard en Supabase) para cualquier juego nuevo. Léelas como ejemplo vivo si algo no queda claro: `specs/05-asteroids-game-integration.md`, `specs/06-leaderboard-and-games-table.md`, y el código en `app/games/asteroids/`.

Qué ya existe y se reutiliza tal cual:

- Contrato de motores: `app/lib/games/types.ts`. Registro: `app/lib/games/registry.ts`.
- `app/components/GameCanvas.tsx` (monta/destruye el motor) y `app/components/GamePlayer.tsx` (HUD HTML, PAUSA/FIN/JUGAR DE NUEVO, modal y guardado en `scores`). `GamePlayer` ofrece guardar **solo si `ENGINES[game.id]` existe**.
- Tablas `games` y `scores` y vistas: el leaderboard (detalle, Salón de la Fama, Home) es genérico. Un juego nuevo solo necesita una fila en `games` y un motor registrado. No hay cambios de esquema ni hay que regenerar `database.types.ts`.

## Flujo

Sigue las fases en orden. La spec es el contrato del proyecto (Spec Driven Design): no se escribe código de la feature sin spec aprobada.

### 1. Contexto (solo lectura)

- `ls references/started-games/ specs/ supabase/migrations/` para saber el siguiente número de spec (NN) y la última migración.
- Lee `app/lib/games/registry.ts`, `app/components/GameCanvas.tsx` y `app/components/GamePlayer.tsx` para ver si siguen acoplados a Asteroides (ver "Generalización" en `references/platform-integration.md`).
- Si el juego viene de `references/started-games/<nn-juego>/`, lee su `game.js`, `CLAUDE.md`, `README.md` y su `specs/` si la tiene. Inventaría: estado global, bucle, teclas, puntuación, vidas, niveles, condición de fin, reinicio, canvas (¿uno o varios?) y assets (sprites, sonidos). Los juegos de referencia son JS plano con estado global; el motor no puede serlo. Además suelen traer UI propia (menús, récords, skins) que choca con la plataforma: ver "Alcance" en `references/engine-contract.md` y decide con el usuario qué se porta.
- Si no hay referencia, pide al usuario la descripción mínima (reglas, controles, cómo se puntúa y cuándo termina).

### 2. Preguntas (AskUserQuestion, solo lo que no se deduzca)

- **¿Id nuevo o dar motor a un id simulado?** Hay 8 juegos simulados con fila en `games` (`caida` ≈ Tetris, `bloque-buster` ≈ Arkanoid). Reutilizar el id conserva la URL y no crea duplicados (SPEC 05 dejó `rocas` y `asteroids` duplicados a propósito, por decisión del usuario). Recomienda reutilizar cuando hay equivalente claro.
- Título, categoría (`ARCADE|PUZZLE|SHOOTER|VERSUS`), color (`cyan|magenta|yellow|green`) y `sort_order` si es id nuevo.
- Conservar aspecto y controles del original o adaptarlos. Por defecto se conservan, como en SPEC 05.
- Mapeo de `lives`/`level` si el juego no los tiene (ver `references/engine-contract.md`).

### 3. Spec

**Antes de escribir nada, lee la skill `/spec`**: `~/.claude/skills/spec/SKILL.md` y `~/.claude/skills/spec/template.md` (con Read; `/spec` está marcada como solo invocable por el usuario, así que no la lances con la herramienta Skill). Es la referencia del método Spec Driven del proyecto: su formato, el orden de secciones, los estados (`Draft` → `Aprobado` → `Implementado`), el estilo de los criterios de aceptación y cómo se construye la spec sección a sección. Úsala como base y aplica sus reglas por encima de este skill si difieren. `references/spec-template.md` solo añade lo específico de un juego (criterios estándar de motor y leaderboard, mapeo de `GameStats`, plan de pasos); no lo uses en lugar de `/spec`. Si los archivos de `/spec` no existen, díselo al usuario y continúa solo con `references/spec-template.md`.

El número NN es siempre el siguiente real según `ls specs/`, aunque el usuario sugiera otro (avísale de la diferencia). Escribe `specs/NN-<id>-game-integration.md` en español con `references/spec-template.md`, con `Status: Draft`. Los criterios de aceptación deben ser concretos del juego (puntuaciones exactas, teclas, cantidades iniciales), no genéricos. Si falta la generalización de `GameCanvas`/`GamePlayer`/`registry`, es el primer paso del plan. **Para aquí**: enseña un resumen al usuario y espera aprobación. Nunca marques la spec como `Aprobado` tú mismo.

### 4. Implementación (tras la aprobación)

Puedes delegar en `/spec-impl` o seguir tú el plan de la spec paso a paso, con `references/platform-integration.md` y `references/engine-contract.md`. En cada paso: `npx tsc --noEmit`. Antes de tocar algo de Next.js lee la guía correspondiente en `node_modules/next/dist/docs/` (lo exige `AGENTS.md`; esta versión tiene cambios incompatibles y `cacheComponents` activo). Para la portada CSS usa `/frontend-design`, como pide `CLAUDE.md`.

### 5. Verificación

Sigue `references/verification.md` y marca `[x]` los criterios cumplidos en la spec; cambia `Status` a `Implementado` solo cuando todos pasen y el usuario lo confirme. No hagas commits ni PRs salvo petición.

## Reglas que no se saltan (y por qué)

- **Motor en TypeScript puro, sin React y sin estado global.** Todo el estado vive en el cierre de `createXGame`, para poder crear/destruir varias instancias (StrictMode monta dos veces). Nada de `iframe` ni cargar `game.js` como script.
- **`destroy()` cancela `requestAnimationFrame` y quita todos los listeners.** Si no, quedan dos bucles y la nave/pieza va al doble de velocidad.
- **`onStats` solo cuando cambia un valor** (y al iniciar y reiniciar): evita un `setState` por frame y mantiene los dos HUD iguales. **`onGameOver` una sola vez por partida** (indicador interno), o el modal y el guardado se duplican.
- **Teclado en `window`, ignorando objetivos `input`/`textarea`/`button`**, y `preventDefault` solo en las teclas del juego: así se puede escribir el nombre en el modal y la página no se desplaza.
- **`pause()`/`resume()`/`restart()` desde React no emiten eventos**; `onPauseChange` solo por la tecla `P` y `onRestart` solo por el reinicio dentro del juego (Espacio). Así React no se desincroniza.
- **Un único `<canvas>`** con resolución interna fija escalada con CSS. Si el original usa varios (p. ej. "siguiente pieza"), dibújalo todo en uno.
- **Supabase**: nueva migración en `supabase/migrations/`, nunca editar una ya aplicada. Nunca `service_role` en código. No inventar `best`/`plays`: salen de `scores`.
- **Los juegos sin motor no cambian**: siguen con su simulación y sin guardar puntuación.
