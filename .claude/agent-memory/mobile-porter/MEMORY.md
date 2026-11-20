# Memoria de mobile-porter

- Referencia: `specs/10-touch-controls-mobile.md` (mando táctil, modo móvil = `max-width: 640px` + `pointer: coarse`).
- Convención: A = `Space`; B = segunda acción o atenuado; solo la cruz repite; skin = `KeyS` (`KeyK` en Snake).
- Mapeos de SPEC 10: asteroids (A DISPARAR, B ESCUDO), tetris (A CAER, B ROTAR, extras FANTASMA y MENÚ), arkanoid (A LANZAR), snake (A EMPEZAR, skin K).
- CSS por juego: dentro de la media query móvil de `app/globals.css`, con selector `.av-player--engine[data-game="<id>"]` (requiere `data-game` en `.av-player` de `GamePlayer.tsx`). Nunca cambiar reglas compartidas de forma que alteren otros juegos.
- Ampliaciones del mando: campos nuevos de `TouchConfig` siempre opcionales; regresión en los otros juegos con motor.
- Juegos portados por este agente: ninguno todavía. Añadir aquí juego → mapeo, CSS propio, ampliaciones y su porqué.
