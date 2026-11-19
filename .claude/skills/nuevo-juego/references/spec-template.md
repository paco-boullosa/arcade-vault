# Plantilla de spec para un juego

Complemento de `/spec`, no sustituto: la estructura, los estados y el estilo de redacción vienen de `~/.claude/skills/spec/SKILL.md` y `template.md`, que se leen antes (fase 3 de `SKILL.md`). Si esta plantilla y `/spec` difieren en formato, manda `/spec`; esta solo aporta el contenido propio de un juego.

Escribe la spec en español en `specs/NN-<id>-game-integration.md`. Mismas secciones y orden que SPEC 05/06. Sustituye los `<...>`; borra lo que no aplique, no lo dejes vacío. Pasos del plan: cada uno deja la app arrancando con `npm run dev` y es commiteable por separado.

````markdown
# SPEC NN — Juego <TÍTULO> integrado con su leaderboard

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06 (y la de generalización si existe)
> **Date:** <fecha de hoy>
> **Objective:** <una sola frase: portar/crear <juego> como motor TS con su canvas, HUD y controles, notificando a React, y publicarlo con su ranking>.

---

## Por qué existe este spec
<2-3 párrafos: qué juego, de dónde viene (references/started-games/<nn-juego> o nuevo), qué patrón reutiliza (SPEC 05 motor, SPEC 06 leaderboard).>

## Alcance
**Dentro:** motor en `app/games/<id>/`; entrada en `ENGINES`; `<id nuevo: fila en games + .cover-<id>> | <id existente: motor para `<id>`>`; migración si aplica; controles bajo la pantalla; guardado en `scores`.
**Fuera de alcance:** <táctil, sonido si no se porta, devicePixelRatio, otros juegos, auth, anti-trampas (como SPEC 05/06)>.

## Modelo de datos
- Constantes del original sin cambios: <lista con valores>.
- Resolución interna: <W×H>.
- Mapeo a `GameStats`: `score` = <...>, `lives` = <...>, `level` = <...>.
- Teclas: <lista>; `P` pausa; Espacio/<tecla> reinicia en GAME OVER.
- Registro: `ENGINES.<id> = { factory, width, height, controls }`.
- Fila en `games` (si es nueva): `{ id, title, cat, cover, color, sort_order }`.

## Plan de implementación
1. **Leer la documentación.** Next (`node_modules/next/dist/docs/01-app`) y el `game.js` de referencia. No genera código.
2. **Generalización.** <solo si falta> `GameDefinition` en el registro; `GameCanvas` con `width/height`; controles desde la definición. Asteroides sigue igual.
3. **Constantes y utilidades.** …
4. **Entidades.** … (un paso por bloque lógico del juego)
5. **Motor: bucle, entrada y reglas.** …
6. **Motor: puntuación, vidas/niveles y `onStats`.** …
7. **Motor: ciclo de vida.** `start/pause/resume/restart/end/destroy`, `P`, GAME OVER, `onGameOver` una vez, `onRestart`.
8. **Registro y catálogo.** `ENGINES`; migración con `mcp__supabase__apply_migration` y portada solo si el id es nuevo o el texto de `games` no describe el juego real.
9. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida completa guardada y comprobada en `/games/<id>`, `/hall-of-fame`, `/`, consola, `get_advisors`, retirar código muerto.

## Criterios de aceptación
**Calidad**
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/<id>/play`.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.

**Catálogo**
- [ ] `/games` muestra <N> tarjetas<, y la de <TÍTULO> tiene portada propia>.
- [ ] `/games/<id>` y `/games/<id>/play` responden 200.
- [ ] `games` contiene la fila `<id>` con `sort_order` <n> (`list_migrations` lista la migración).

**Juego** (concretos, con cifras reales del juego)
- [ ] Al cargar aparece el canvas con <estado inicial exacto> y no `.game-arena`.
- [ ] <acción> suma exactamente <n> en ambos HUD.
- [ ] <teclas> hacen <efecto>.
- [ ] Ambos HUD (canvas y HTML) muestran siempre los mismos `score`, `lives`, `level`.
- [ ] PAUSA congela el juego y el botón pasa a REANUDAR; la tecla `P` hace lo mismo.
- [ ] Al terminar, el canvas muestra GAME OVER con la puntuación y aparece el modal con la misma puntuación.
- [ ] <Tecla> en GAME OVER reinicia con valores iniciales en ambos HUD y cierra el modal.
- [ ] FIN abre el modal con la puntuación actual; JUGAR DE NUEVO reinicia.
- [ ] Se puede escribir un nombre con espacios en el modal sin que la tecla de juego actúe.
- [ ] Salir y volver no deja dos bucles ni listeners duplicados.
- [ ] La línea de controles aparece en `/games/<id>/play` y no en juegos sin motor.

**Leaderboard**
- [ ] GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = '<id>'`, nombre y puntuación del modal; un doble clic crea una sola fila.
- [ ] Tras guardar, `/games/<id>` la muestra en `#01`, `Partidas` y `Mejor global` se actualizan, y aparece en `/hall-of-fame` y en la actividad de `/`.
- [ ] Los juegos sin motor siguen con simulación y sin botón de guardar.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados.

## Decisiones
- **Sí:** … **No:** … (id nuevo vs existente; mapeo de lives/level; conservar HUD y GAME OVER del original; correcciones al original; resolución fija; assets/sonido)

## Riesgos
| Riesgo | Mitigación |
| --- | --- |
| StrictMode duplica motores | `destroy()` limpia rAF y listeners; criterio de aceptación |
| <riesgos propios del juego> | … |

## Qué **no** está en este spec
- … (cada punto, si se aborda, va en su propio spec)
````

Un criterio vale solo si se puede comprobar en el navegador o con un comando; "el juego funciona bien" no sirve.
