---
name: banderas-skins
description: Skins de banderas (clasico, retro, neon), tecla K y decisiones de paleta
metadata:
  type: project
---

- Skins: clasico (COLORS originales, por defecto), retro (verde/ámbar fósforo, plano), neon (muros azul oscuro, filo cian, entidades en contorno con alfa 0.3-0.35 y glow 14 en coche, vigías y bandera). Clave `banderas.skin`.
- **Why K:** `S` es "abajo" (WASD); la spec reserva K y `touch.skin` ya es `KeyK`. Funciona en `ready`, con la partida terminada y bloqueada en pausa.
- Nombre de la skin: etiqueta "SKIN: X" abajo a la derecha del visor (el HUD de 40 px está lleno). `drawScene(ctx, scene, skin)`.
- Contraste: todos los pares de entidad/texto sobre suelo y fondo superan 3:1 (mín. 4.9 en clásico); muro/suelo queda bajo a propósito.
