---
name: temas-usados
description: Temas de game jam ya tratados, con id generado y variantes A/B
metadata:
  type: project
---

- 2026-11-19, tema Frogger: id `cruce-rana` (carpeta `specs/game-jam/cruce-rana/`). A = clásica por casillas (3 vidas, 5 casillas, reloj por rana). B = contrarreloj 120 s con racha (sin vidas). `sort_order` propuesto 13.

**Why:** `ranaria` ya existía en el catálogo (simulado), así que se eligió otro id y se documentó convivir vs reemplazar en el README.
**How to apply:** no repetir el tema ni el id; usar el mismo patrón (id nuevo + convivir) cuando el id natural choque con un juego simulado. Consultar la BD con `select id,cat,color,sort_order from public.games` (la columna es `cat`, no `category`). El catálogo real tenía 8 filas el 2026-11-19.
