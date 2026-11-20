---
name: arkanoid-skins
description: Skins de arkanoid (clasico con sprites, retro, neon), tecla S y decisiones de paleta
metadata:
  type: project
---

- Skins: clasico (por defecto, sprites de la hoja sobre negro), retro (verdes fósforo planos), neon (trazo + relleno alfa 0.16). Clave `arkanoid.skin`, tecla `KeyS`.
- **Why S:** arkanoid usa flechas/Espacio/Enter/P; sin choque.
- Retro y neon dibujan con formas del canvas (sin assets); explosión = destello que se desvanece.
- Glow (`shadowBlur` 10) solo en pala y bola; los ~70 bloques no llevan glow, por rendimiento.
- El fondo ahora se pinta con `skin.bg` (antes `clearRect` sobre `#000` del CSS en GameCanvas).
- Nombre de la skin: texto discreto abajo a la derecha del canvas.
- Cambio de skin va después de `if (paused) return`, así queda bloqueado en pausa.
