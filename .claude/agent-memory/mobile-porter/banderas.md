---
name: banderas-mobile
description: Mapeo táctil de banderas (coche con cruz mantenida) y por qué no necesitó CSS ni ampliar el mando
metadata:
  type: project
---

Banderas: cruz completa, A = Space "EMPEZAR" (short "A"), sin B, skin KeyK, sin extras. Sin CSS propio ni cambios en TouchControls/touch.ts.

**Why:** el motor guarda las teclas de movimiento en una lista (`held`), manda la última y ignora `e.repeat`; la repetición de la cruz es inocua y soltar/`pointercancel` envía keyup. Canvas 800x600 cabe con el CSS compartido (390x844 y 360x740 sin scroll).

Verificación: Playwright MCP no emula `pointer: coarse`; se reinyectó la media query con solo `max-width: 640px`.
