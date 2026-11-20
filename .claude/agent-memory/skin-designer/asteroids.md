---
name: asteroids-skins
description: Skins de asteroids (clasico, retro, neon), tecla S y decisiones de paleta
metadata:
  type: project
---

- Skins: clasico (por defecto, aspecto original blanco sobre negro), retro (verde fósforo plano), neon (cian/magenta con glow). Clave `asteroids.skin`, tecla `KeyS`.
- **Why S:** asteroids se controla con flechas/Espacio/P, no hay choque con WASD.
- Glow (`shadowBlur` 10) solo en nave, asteroides y balas; partículas y HUD sin glow, por rendimiento.
- Nombre de la skin: texto discreto abajo a la derecha del canvas (HUD).
- Las entidades reciben `skin` en `draw(ctx, skin)`; la skin es estado del cierre del motor.
