# Game jam — BANDERAS

**Tema:** GP-018 del TODO del `game-planner` (`banderas`, LABERINTO, 22/25): "coche en laberinto grande con cámara, radar y rivales. Requiere LABERINTO. Verde. Complejidad técnica media (T=3)". Sorteado entre los candidatos pendientes (no se volvió a sortear).
**Juego:** `banderas`, "BANDERAS". Categoría nueva `LABERINTO`, color `green`, `sort_order` 7 (calculado con `max + 1`). Un coche recorre un laberinto de 41×31 casillas de 40 px (1640×1240 px) con cámara de 800×560 px. El laberinto sale de una semilla (`18018 + ronda`): árbol por recorrido en profundidad más 40 bucles, 639 casillas transitables, siempre conexo. Formas del canvas y sin sonido (no hay assets en `references/source-assets/`; solo existe `snake-assets/`).

Se diseñó para **no** recrear el clásico concreto que describe la nota del TODO (banderas recogidas al paso, minimapa de radar, combustible, humo, rocas, coches que persiguen con IA de camino). Aquí las banderas se izan o se capturan en carrera, el radar es un pulso de sonar (B) o una brújula (A), no hay combustible y los rivales no te persiguen con búsqueda de caminos.

Ambas variantes comparten id, título, categoría, color, portada `.cover-banderas`, generador de laberinto, colocación, coche (24 px, 200 px/s, ayuda de giro de 14 px), cámara y fila de `games` (solo cambian `short` y `long`).

| Spec                            | Variante            |
| ------------------------------- | ------------------- |
| `01-banderas-izado-vigias.md`   | A: Izado y vigías   |
| `02-banderas-niebla-rivales.md` | B: Niebla y rivales |

## Comparativa A vs B

|                       | A: Izado y vigías                                                                                                                         | B: Niebla y rivales                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mecánica              | Izar 8 mástiles por ronda ocupándolos 1,0 s; 3 a 7 vigías patrullan al azar y persiguen en recta si te ven; brújula al mástil más cercano | Capturar 6 banderas por ronda al tocarlas, antes que 2 a 4 rivales que van por BFS a la más cercana; niebla de 200 px con memoria; sonar de 1,5 s cada 8 s |
| Condición de fin      | Perder las 3 vidas (vida extra cada 5.000, máx. 5)                                                                                        | Reloj a 0 (90 s, +8 s por bandera propia, +10 s por ronda, tope 120)                                                                                       |
| Puntuación            | 200 por mástil (+100 si ≤ 20 s del anterior) + 500 + 10 × par restante por ronda; máx. 4.400 en la ronda 1                                | 150 × racha (x1 a x4, ventana 15 s) + 300 + 100 por bandera propia por ronda; máx. 3.600 por ronda                                                         |
| `GameStats`           | `lives` real 3 a 0, `level` = ronda, `initialLives: 3`                                                                                    | `lives` 1 a 0, `level` = ronda, `initialLives: 1`                                                                                                          |
| Dificultad            | Media-alta: elegir cuándo pararse en el mástil con vigías cerca; curva muy legible                                                        | Media al inicio, alta después: orientarse con niebla, ganar la carrera y mantener la racha                                                                 |
| Duración de partida   | 3 a 8 min                                                                                                                                 | 2 a 6 min (el reloj acota)                                                                                                                                 |
| Complejidad técnica   | Media: generador, colisión del coche, vigías con visión recta, vidas y reaparición                                                        | Media-alta: lo anterior más BFS de rivales, niebla con memoria sin canvas auxiliar, sonar con marcadores de borde y racha                                  |
| Encaje con el ranking | Bueno: puntuación acotada y comparable, de estilo clásico (como Arkanoid o Horizonte A)                                                   | Muy bueno: racha y tiempo separan a los buenos jugadores; riesgo de dispersión, acotado por el tope x4                                                     |

## Recomendación

**Variante A (izado y vigías)** como primera implementación: no necesita niebla ni sonar, sus cifras son más fáciles de comprobar en el navegador (cada acción vale un número fijo) y el nivel de riesgo técnico es menor. **Variante B** si se prefiere un juego más de puntuación y tiempo, con la sensación de exploración a ciegas y carrera. Ambas comparten el motor del laberinto, así que B podría añadirse después como modo.

## Supuestos del agente

- Id `banderas`, el de la propuesta GP-018 (no choca con `ENGINES`, la tabla `games` ni otras carpetas de `specs/game-jam/`).
- Categoría nueva `LABERINTO` porque el TODO dice "Requiere LABERINTO". Implica migración del `CHECK` `games_cat_check` (hoy admite ARCADE, PUZZLE, SHOOTER y VERSUS), `GameCategory` en `app/data/games.ts` y `CATS` en `app/data/categories.ts`. Es un paso propio (el 2) del plan de ambas variantes. Si se prefiere no tocar el esquema, la alternativa es `ARCADE` y se quita ese paso.
- Color `green` existente (como pide el TODO), compartido con `frogger`; la portada debe distinguirse.
- Datos reales de la BD (consulta SELECT del 2026-11-23): 6 filas (`asteroids` 1, `tetris` 2, `arkanoid` 3, `snake` 4, `frogger` 5, `horizonte` 6), así que `banderas` sería `sort_order` 7 y el catálogo tendría 7 tarjetas. **Discrepancia detectada:** la migración `20261123111936_add_horizonte_game.sql` inserta `horizonte` con `sort_order` 14, pero la BD lo tiene en 6. Por eso el `insert` usa `max + 1` en vez de un número fijo.
- Estado real del código contrastado: existen `app/games/horizonte` y `app/games/frogger`, `GameDefinition` exige `touch` (SPEC 10/11) y `CLAUDE.md` está desactualizado (no cita `frogger` ni `horizonte` entre los motores). Se deja `touch` mínimo y `K` reservada para skins (`S` es "abajo" en WASD).
- Verificación del laberinto: se ejecutó un script temporal (en el directorio de trabajo temporal, no en el repo) con el algoritmo descrito. En las rondas 1 a 12: 339 conexiones, 639 casillas transitables, 0 salas inalcanzables, distancia máxima de 25 a 38 pasos de sala, 215 a 259 candidatas a mástil (A) y 241 a 274 a bandera (B), y selección con separación Manhattan ≥ 6 posible en todas. Los criterios de ambas specs (639 transitables, 632 muros) salen de ahí.
- Aritmética comprobada: 41 × 31 = 1271 casillas, 1640×1240 px; cámara máxima 840 y 680 con visor 800×560; salida en la casilla (21, 15), centro (860, 620), cámara inicial (460, 340) y coche en pantalla en (400, 320); coche 24 px en pasillo 40 px (margen 8 px) y paso máximo 10 px con `dt` 0,05 s (menor que el medio lado, 12); `150 × (1 + 2 + 3 + 4 + 4 + 4) = 2.700` más `300 + 600` da 3.600 por ronda en B; en A, `8 × 300 + 500 + 1.500 = 4.400`.
- Semilla fija por ronda para un ranking comparable; los vigías de A usan su propio PRNG para decidir giros, por lo que su comportamiento puede variar entre partidas aunque el mapa no.
- Todas las cifras (velocidades, tiempos, puntos) son una propuesta jugable a validar en pruebas; no proceden de ningún original.
- Sin sonido ni assets; skins y mando táctil los completan `skin-designer` y `mobile-porter` tras `/spec-impl-game`.

## Preguntas abiertas

1. ¿A o B? ¿Se quiere la otra como modo de juego en una spec posterior?
2. ¿Se acepta la categoría nueva `LABERINTO` (migración del `CHECK` y pestaña nueva en `/games` con una sola tarjeta) o se prefiere `ARCADE`?
3. ¿Dos tarjetas verdes (`frogger` y `banderas`) están bien, o se prefiere otro color pese a la nota de GP-018 (exigiría ampliar también `games_color_check`)?
4. ¿Semilla fija (mismo laberinto en cada partida, comparable en el ranking, pero memorizable) o aleatoria por partida?
5. En A, ¿1,0 s de izado es un buen riesgo o se prefiere 1,5 s? En B, ¿el tope del reloj en 120 s y la racha x4 son adecuados?
6. ¿Se quiere corregir la discrepancia de `sort_order` (14 en la migración de `horizonte` frente a 6 en la BD) en otra tarea?

## Siguiente paso

Ejecutar `/nuevo-juego` con la variante elegida: renumera la spec a `specs/NN-banderas-game-integration.md` (queda en `Draft` hasta que el usuario la apruebe) y después `/spec-impl-game`. No se ejecuta desde la jam.
