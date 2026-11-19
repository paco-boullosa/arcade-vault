# Game jam — CRUCE RANA

**Tema:** Frogger (cruzar la carretera y el río sin que nos maten: esquivar coches, saltar sobre troncos y tortugas, llegar a las casillas de meta).
**Juego:** `cruce-rana`, "CRUCE RANA". ARCADE, color `green`, `sort_order` 13 (hoy hay 8 juegos en `games`; el máximo es 12, `snake`). Mecánica de género, sin reproducir ningún juego concreto. Formas del canvas y sin sonido (no hay assets de rana en `references/source-assets/`).

Ambas variantes comparten id, título, categoría, color, fila de `games`, tablero de 20×15 celdas de 40 px y tabla de carriles. Cambia la mecánica.

| Spec                                  | Variante                  |
| ------------------------------------- | ------------------------- |
| `01-cruce-rana-clasica-casillas.md`   | A: Clásica por casillas   |
| `02-cruce-rana-contrarreloj-racha.md` | B: Contrarreloj con racha |

## Comparativa A vs B

|                       | A: Clásica por casillas                                                                        | B: Contrarreloj con racha                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mecánica              | 3 vidas, 5 casillas de meta de 80 px que llenar, reloj de 30 s por rana, nivel al llenar las 5 | Reloj global de 120 s, orilla de meta continua, cruces ilimitados, +3 s por cruce, -5 s por muerte, racha x1 a x5                                 |
| Condición de fin      | Perder las 3 vidas                                                                             | Reloj a 0                                                                                                                                         |
| Puntuación            | 10 por fila nueva, 50 por casilla, 10 por segundo restante, 1000 por nivel                     | 5 por fila nueva, 100 × multiplicador por cruce                                                                                                   |
| `GameStats`           | `lives` 3 a 0, `level` real                                                                    | `lives` 1 a 0, `level = 1 + floor(cruces / 3)`                                                                                                    |
| Dificultad            | Media-alta: casillas exigen precisión; tortugas y reloj por rana                               | Media: la meta es amplia, la tensión viene del reloj y de no romper la racha                                                                      |
| Duración de partida   | 3 a 6 min según nivel                                                                          | 2 min fijos (más si se encadenan cruces)                                                                                                          |
| Complejidad técnica   | Algo mayor: huecos de meta, estado por casilla, fases de muerte y fin de nivel                 | Algo menor en tablero, pero con reloj global, racha y `phase` de carriles al subir de nivel                                                       |
| Encaje con el ranking | Bueno: puntuación acotada y legible; se parece a los demás juegos de vidas                     | Muy bueno: partidas cortas y comparables (mismo tiempo para todos); el multiplicador premia la regularidad, con riesgo de dispararse si se domina |

## Relación con `ranaria`

`ranaria` (id simulado, ARCADE, `green`, `sort_order` 7, `cover-rana`) está en el catálogo sin motor real. En el TODO del `game-planner` aparece como **GP-007**: Propuesto, 20/25, "alternativa 1", con la nota de que sería el 3.er ARCADE real y que la puntuación por avance/tiempo es menos limpia (las dos variantes la resuelven con puntos exactos por acción).

Las dos specs **conviven con `ranaria`** (supuesto del agente): crean el id nuevo `cruce-rana` y `ranaria` queda como duplicado simulado, igual que `serpentina` tras SPEC 09. Motivo: el usuario ya eligió ese camino con `snake` y no obliga a tocar filas existentes ni scores futuros.

Alternativa, **reemplazarla**: usar el id `ranaria` en lugar de `cruce-rana`. Habría que sustituir el id en `ENGINES`, rutas y carpeta (`app/games/ranaria/`), y la migración sería un `update` de la fila existente (texto `short`/`long`, `cover`, y `sort_order` se queda en 7) en lugar de un `insert`. El catálogo seguiría en 8 tarjetas y no habría dos ranas verdes. Contras: se pierde el id para otro juego de rana y cambia el comportamiento de una fila con posibles scores simulados (no hay filas de prueba en `scores`, pero conviene comprobarlo). Esta opción hay que decidirla antes de `/nuevo-juego`.

Otra posibilidad: convivir y retirar `ranaria` más tarde con una migración de borrado, como se hizo con `bloque-buster`, `caida`, `serpentina` y `rocas`.

## Recomendación

**Variante B (contrarreloj con racha)** si se prioriza el ranking: partidas de duración fija, puntuaciones comparables y menos riesgo de estados raros (sin huecos ni fin de nivel). **Variante A** si se prefiere la experiencia reconocible del género con vidas y niveles. Si se elige A, valdría la pena añadir después un modo sin vidas. Mi sugerencia: B, y reemplazar `ranaria` solo si no se quiere dos ranas.

## Supuestos del agente

- Id `cruce-rana` en lugar de `ranaria` (colisión con el catálogo) y convivencia con la simulada.
- `ARCADE` y `green` existentes, `sort_order` 13, sin cambios de categoría ni color.
- Sin sonido y sin assets (no hay en `references/source-assets/`).
- Tablero de 15 filas: 1 de meta, 5 de río, 1 de mediana, 7 de carretera y 1 de salida.
- Variante A con 3 vidas fijas sin vida extra; B sin vidas (`lives = 1`).
- Salto discreto con un salto por pulsación (se ignora `e.repeat`).
- Todos los números de velocidad, tiempos y puntos son una propuesta jugable a validar en pruebas; no proceden de ningún original.

## Preguntas abiertas

1. ¿Convivir con `ranaria` o reemplazarla (id `ranaria`)?
2. ¿A o B? ¿Se quiere el otro modo más adelante como spec aparte?
3. ¿Se acepta que el multiplicador de B llegue a x5, o se prefiere un tope menor?
4. ¿Vidas extra por puntuación en A (fuera de alcance ahora)?
5. ¿La portada `.cover-cruce-rana` debe ser claramente distinta de `.cover-rana` aunque ambas sean verdes?

## Siguiente paso

Ejecutar `/nuevo-juego` con la variante elegida: renumera la carpeta a `specs/NN-cruce-rana-game-integration.md` (sin `Aprobado` hasta que el usuario lo diga). Las specs están en `Draft` y dependen de SPEC 05, 06 y 07.
