---
name: snake-skins
description: Skins de snake (clasico, retro, neon), tecla K y decisiones de paleta
metadata:
  type: project
---

- Skins: clasico (por defecto, aspecto original: serpiente con glow verde y frutas sprite), retro (celdas planas verde fósforo, fruta cuadrada), neon (contorno cian con relleno alfa bajo, fruta anillo amarillo con glow). Clave `snake.skin`.
- **Why K:** snake usa `S` para bajar (WASD).
- Frutas sprite solo en clasico; retro y neon dibujan formas (sin assets nuevos).
- Nombre de la skin: texto pequeño abajo a la derecha (`drawHud` en render.ts). La skin se pasa a `drawScene(..., skin)`.
- Clasico ya tenía glow (aspecto original), así que neon se diferencia por contorno hueco, paleta cian/magenta y fruta anillo.
