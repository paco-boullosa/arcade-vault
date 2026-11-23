---
name: horizonte-mobile
description: Mapeo táctil de horizonte (movimiento libre 8 direcciones, disparo mantenido) y por qué no hizo falta CSS ni ampliar el mando
metadata:
  type: project
---

Horizonte: cruz completa, A = Space "DISPARAR" (short "DIS"), sin B (atenuado), skin KeyK (S es "abajo"), sin extras. Sin CSS propio ni cambios en TouchControls/touch.ts/GamePlayer.

**Why:** el motor usa un set `held` con keydown/keyup (ignora `e.repeat` en movimiento), y `HoldButton` ya mantiene la tecla hasta soltar, así que movimiento, diagonales (multitáctil) y autodisparo (Space mantenido) funcionan tal cual. Canvas 4:3 cabe con el CSS compartido a 390x844 y 360x740.

**How to apply:** en test con Playwright, `setPointerCapture` falla con pointerId sintéticos; sustituirlo por no-op. Reiniciar tras game over exige soltar Space (A lo hace al soltar).
