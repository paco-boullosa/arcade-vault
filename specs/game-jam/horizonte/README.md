# Game jam — HORIZONTE

**Tema:** GP-019 del TODO del `game-planner` (`horizonte`, SHOOTER, cian, 21/25): shoot'em up de scroll lateral con más contenido (terreno, patrones), evitando elementos de los dos clásicos del género citados en la nota.
**Juego:** `horizonte`, "HORIZONTE". SHOOTER, color `cyan`, `sort_order` 14. Una nave cruza una caverna procedural (techo y suelo por columnas de 20 px, semilla fija) que avanza sola, entre oleadas de Dardos, Enjambres, Torretas y Boyas con patrones fijos. Formas del canvas y sin sonido (no hay assets en `references/source-assets/`; esa carpeta no existe hoy).

Ambas variantes comparten id, título, categoría, color, portada `.cover-horizonte`, `sort_order`, terreno, semillas, tabla de enemigos, nave, disparo y fórmulas de sector (scroll `min(220, 120 + 10·(s-1))` px/s, hueco `max(200, 360 - 20·(s-1))` px). Cambia la mecánica de supervivencia y de puntuación. Solo cambian `short`/`long` de la fila de `games` para describir la variante elegida.

| Spec                            | Variante                     |
| ------------------------------- | ---------------------------- |
| `01-horizonte-vidas-puertas.md` | A: Vidas y puertas de sector |
| `02-horizonte-escudo-racha.md`  | B: Escudo y racha            |

## Comparativa A vs B

|                       | A: Vidas y puertas de sector                                                                                                              | B: Escudo y racha                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Mecánica              | 3 vidas (vida extra cada 10.000, máx. 5); cualquier contacto mata; puerta destructible (6–14 impactos) al final de cada sector de 3000 px | Escudo 100 sin regeneración; bala −15, choque −25, roce con el terreno −60/s con empuje; multiplicador x1–x8 por derribos en 2 s; cápsulas +25 |
| Condición de fin      | Perder las vidas                                                                                                                          | Escudo a 0                                                                                                                                     |
| Puntuación            | 1 por 10 px + enemigos (100/150/200) + 500 por Enjambre completo + 500 × sector por puerta                                                | 1 por 10 px + enemigos × multiplicador + 250 por cápsula con escudo lleno                                                                      |
| `GameStats`           | `lives` real 3 a 0, `level` = 1 + puertas destruidas, `initialLives: 3`                                                                   | `lives` 1 a 0, `level` = 1 + floor(dist / 3000), `initialLives: 1`                                                                             |
| Dificultad            | Alta: el terreno mata y las puertas exigen apuntar bajo presión; curva muy legible                                                        | Media al principio (el terreno perdona), alta en sectores altos por la presión de mantener la racha y el escudo                                |
| Duración de partida   | 2 a 5 min                                                                                                                                 | 2 a 6 min; depende de cuántas cápsulas se recojan                                                                                              |
| Complejidad técnica   | Media: muerte, reaparición con invulnerabilidad, reposición de la puerta y vidas extra                                                    | Media-alta: empuje contra el terreno, inmunidad, temporizador de racha, cápsulas y HUD de escudo/multiplicador fuera de `GameStats`            |
| Encaje con el ranking | Bueno: puntuación acotada y fácil de comparar; se parece a Asteroides y Arkanoid (vidas)                                                  | Muy bueno: el multiplicador separa mucho a los buenos jugadores; riesgo de puntuaciones muy dispersas                                          |

## Recomendación

**Variante A (vidas y puertas)** como primera implementación: es más fácil de verificar en el navegador (cada acción tiene un valor fijo), su riesgo técnico es menor (no hay empuje contra el terreno ni un estado fuera de `GameStats`) y las puertas dan un hito claro de nivel. **Variante B** si se prefiere un ranking con más profundidad y un juego que perdona el terreno; es la más "arcade de puntuación". Ambas tienen el mismo terreno y enemigos, así que B podría añadirse después como modo de juego en otra spec.

## Supuestos del agente

- Id `horizonte`, el de la propuesta GP-019 (no choca con `ENGINES`, las migraciones de `games` ni otras carpetas de `specs/game-jam/`).
- `SHOOTER` y `cyan` existentes; sin migración de categoría ni color. Se convive con Asteroides, que también es SHOOTER cian.
- `sort_order` 14 y 10 tarjetas tras añadirlo, **deducidos de las migraciones** (9 seed − 4 borrados + `tetris`, `arkanoid`, `snake`, `frogger` = 9 filas; máximo 13, `frogger`). El MCP de Supabase no estaba disponible: confirmar con `select id, sort_order from public.games order by sort_order` antes de migrar. `references/implemented-games.md` no lista `frogger`.
- Semilla fija para terreno y oleadas: misma caverna en todas las partidas, para un ranking comparable.
- Lista explícita de elementos excluidos para no recrear juegos concretos: barra de mejoras, naves satélite, disparo cargado, módulo acoplable, cabezas de piedra, volcanes y combustible.
- Sin sonido ni assets; skins y mando táctil los completan `skin-designer` y `mobile-porter` tras `/spec-impl-game`. Se deja `touch` mínimo en el registro porque el tipo `GameDefinition` lo exige, y `K` reservada para skins (`S` es "abajo" en WASD).
- Todas las cifras (velocidades, vidas de enemigos, cadencia, puntos) son una propuesta jugable a validar en pruebas; no proceden de ningún original.

## Preguntas abiertas

1. ¿A o B? ¿Se quiere la otra como modo de juego en una spec posterior?
2. ¿Semilla fija (misma caverna siempre) o aleatoria por partida? La fija favorece el ranking pero permite memorizar el recorrido.
3. En A, ¿las puertas son un buen hito o se prefieren jefes de sector más adelante?
4. En B, ¿tope del multiplicador en x8 o menor (x5) para que las puntuaciones no se dispersen tanto?
5. ¿Molesta tener dos SHOOTER cian (Asteroides y Horizonte), o se prefiere otro color pese a la nota de GP-019?

## Siguiente paso

Ejecutar `/nuevo-juego` con la variante elegida: renumera la spec a `specs/NN-horizonte-game-integration.md` (queda en `Draft` hasta que el usuario la apruebe) y después `/spec-impl-game`. No se ejecuta desde la jam.
