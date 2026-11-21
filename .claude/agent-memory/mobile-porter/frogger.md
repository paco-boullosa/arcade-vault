---
name: frogger-mobile
description: Mapeo táctil elegido para frogger y por qué no necesitó CSS propio ni ampliar el mando
metadata:
  type: project
---

Frogger: cruz completa, A = Space "EMPEZAR" (short "A"), sin B (atenuado), skin KeyK, sin extras. Sin CSS propio ni cambios en TouchControls/touch.ts.

**Why:** canvas 800x600 (4:3) cabe con el CSS compartido (390x844 y 360x740 sin scroll). El motor ignora `e.repeat`, así que la repetición de la cruz no encadena saltos: un toque = un salto. S choca con WASD (abajo), por eso K.

**How to apply:** si se quiere salto continuo al mantener, habría que cambiar el motor o ampliar el mando (otra spec).

Verificación: Playwright MCP no emula `pointer: coarse`; se reinyectó la regla de la media query sustituyendo la condición por `max-width: 640px` (aproximación válida del layout).
