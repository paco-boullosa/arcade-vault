---
name: frogger-skins
description: Skins de frogger (clasico, retro, neon), tecla K y decisiones de paleta
metadata:
  type: project
---

- Skins: clasico (por defecto, paleta neon original con glow), retro (verde fósforo/ámbar, plano, sin glow), neon (vehículos/troncos/tortugas en contorno con relleno alfa 0.25-0.28, glow en rana y vehículos). Clave `frogger.skin`.
- **Why K:** `S` es saltar abajo (WASD); coincide con `touch.skin: "KeyK"` del registro.
- Nombre de la skin: HUD del canvas, fila 14 en x=512 entre vidas y barra de tiempo. `drawScene(ctx, view, skin)`.
- Clásico: tronco (relleno) no llega a 3:1 con el agua, se deja por ser el aspecto original (el contorno sí pasa).
