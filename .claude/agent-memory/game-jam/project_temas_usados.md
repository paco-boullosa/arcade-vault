---
name: temas-usados
description: Temas de game jam ya tratados, con id generado y variantes A/B
metadata:
  type: project
---

- 2026-11-19, tema Frogger: id `cruce-rana` (carpeta `specs/game-jam/cruce-rana/`). A = clásica por casillas (3 vidas, 5 casillas, reloj por rana). B = contrarreloj 120 s con racha (sin vidas). `sort_order` propuesto 13.
  - Resultado: el usuario aprobó la A pero se implementó con id `frogger` (migración `20261121145541_add_frogger_game.sql`, `sort_order` 13), no `cruce-rana`. Existe también `specs/game-jam/frogger/`.
- 2026-11-23, tema GP-019 `horizonte` (shoot'em up de scroll lateral, SHOOTER, cian): id `horizonte` (carpeta `specs/game-jam/horizonte/`). A = 3 vidas + puertas destructibles por sector. B = escudo 100 + roce con empuje + multiplicador x1–x8 + cápsulas, sin puertas. Comparten terreno procedural con semilla fija y 4 enemigos (Dardo, Enjambre, Torreta, Boya). `sort_order` propuesto 14 (10 tarjetas). Recomendada A.

**Why:** `ranaria` ya existía (simulado), por eso el id nuevo. Cuando el tema viene de una entrada del TODO con id propio (GP-xxx), ese id no es un choque: es el mismo juego.
**How to apply:** no repetir temas ni ids. Sin MCP de Supabase, deducir filas y `sort_order` de `supabase/migrations/` (seed de 9, borrado de 4 en `20261119140000`, más un insert por juego) y anotarlo como supuesto; `references/implemented-games.md` puede estar desactualizado (no listaba `frogger`). Con MCP: `select id,cat,color,sort_order from public.games` (columna `cat`).
