---
name: temas-usados
description: Temas de game jam ya tratados, con id generado y variantes A/B
metadata:
  type: project
---

- 2026-11-19, tema Frogger: id `cruce-rana` (carpeta `specs/game-jam/cruce-rana/`). A = clásica por casillas (3 vidas, 5 casillas, reloj por rana). B = contrarreloj 120 s con racha (sin vidas). `sort_order` propuesto 13.
  - Resultado: el usuario aprobó la A pero se implementó con id `frogger` (migración `20261121145541_add_frogger_game.sql`, `sort_order` 13), no `cruce-rana`. Existe también `specs/game-jam/frogger/`.
- 2026-11-23, tema GP-019 `horizonte` (shoot'em up de scroll lateral, SHOOTER, cian): id `horizonte` (carpeta `specs/game-jam/horizonte/`). A = 3 vidas + puertas destructibles por sector. B = escudo 100 + roce con empuje + multiplicador x1–x8 + cápsulas, sin puertas. Comparten terreno procedural con semilla fija y 4 enemigos (Dardo, Enjambre, Torreta, Boya). `sort_order` propuesto 14 (10 tarjetas). Recomendada A.
- 2026-11-23, tema GP-018 `banderas` (coche en laberinto, LABERINTO, verde): id `banderas` (carpeta `specs/game-jam/banderas/`). A = izar 8 mástiles 1 s + vigías de visión recta + 3 vidas. B = contrarreloj 90 s, niebla, rivales que compiten por 6 banderas, sonar, racha x1-x4, sin vidas. Comparten laberinto por semilla (41x31 casillas de 40 px, árbol + 40 bucles). Categoría nueva `LABERINTO` (migración del CHECK + `GameCategory` + `CATS`). `sort_order` 7 con `max+1` (BD tenía 6 filas). Recomendada A.

**Why:** `ranaria` ya existía (simulado), por eso el id nuevo. Cuando el tema viene de una entrada del TODO con id propio (GP-xxx), ese id no es un choque: es el mismo juego.
**How to apply:** no repetir temas ni ids. Sin MCP de Supabase, deducir filas y `sort_order` de `supabase/migrations/` (seed de 9, borrado de 4 en `20261119140000`, más un insert por juego) y anotarlo como supuesto; `references/implemented-games.md` puede estar desactualizado (no listaba `frogger`). Con MCP: `select id,cat,color,sort_order from public.games` (columna `cat`).

**BD vs repo (2026-11-23):** con MCP Supabase la BD tenía 6 filas (sort_order 1-6) aunque la migración de `horizonte` pone 14; usar `max+1` en el insert. `games_cat_check` admite ARCADE, PUZZLE, SHOOTER, VERSUS; `CATS` está en `app/data/categories.ts` y `GameCategory` en `app/data/games.ts`.
**Técnica útil:** verificar generadores procedurales con un script node temporal en el scratchpad y citar los resultados en el spec.
