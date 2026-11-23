---
name: horizonte-skins
description: Skins de horizonte (clasico, retro, neon), tecla K y decisiones de paleta
metadata:
  type: project
---

- Skins: clasico (por defecto, neon cian/magenta/amarillo sobre negro, relleno solido + borde blanco), retro (verde fosforo/ambar, plano sin borde), neon (trazo + relleno alfa .25, glow 10 en terreno, nave, enemigos, balas y disparos; borde de terreno magenta). Clave `horizonte.skin`.
- **Why K:** S es "abajo" (WASD); la spec reserva K y `touch.skin` ya era KeyK.
- Skin pasada como ultimo argumento a `drawScene` y a los `draw*` de entities.ts; helper `paint()` en entities.ts aplica el estilo. Nombre en el HUD ("K · SKIN X", 10px abajo a la derecha).
- Cuidado: shadowBlur siempre dentro de save/restore (se filtraba a lo dibujado despues).
