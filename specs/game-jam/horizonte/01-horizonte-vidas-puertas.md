# GAME JAM — HORIZONTE · Variante A: Vidas y puertas de sector

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-23
> **Objective:** Crear `horizonte`, un shoot'em up de scroll lateral por una caverna con techo y suelo, oleadas de enemigos con patrones fijos y una puerta destructible al final de cada sector, con 3 vidas, como motor TypeScript con canvas único 800×600 y ranking en Supabase.

---

## Por qué existe este spec

Es el resultado de la game jam con el tema GP-019 del TODO del `game-planner` (`horizonte`, SHOOTER, cian, 21/25): "shoot'em up de scroll lateral; más contenido (terreno, patrones)". Sería el segundo SHOOTER con motor real, tras Asteroides (SPEC 05), y reutiliza el leaderboard genérico de SPEC 06 y la `GameDefinition` de SPEC 07. No hay código de referencia: las reglas se definen aquí, como en SPEC 09.

Se diseña una mecánica de género original. La nota del TODO pide evitar elementos de dos clásicos concretos del género, así que este spec **no** usa barra de selección de mejoras, naves satélite que copian los disparos, disparo cargado, módulo acoplable que absorbe balas, cabezas de piedra, volcanes ni depósito de combustible. El título, el id, los enemigos (Dardo, Enjambre, Torreta, Boya) y la puerta de sector son propios. El aspecto es el neón de la plataforma con formas del canvas.

Esta variante es la clásica: 3 vidas, cualquier contacto mata, y cada sector termina en una puerta que hay que destruir para pasar. La variante B comparte id, título, terreno, enemigos y fila de `games`, pero cambia la mecánica (escudo de energía en lugar de vidas, roce con el terreno que no mata, multiplicador por racha de derribos, cápsulas y sin puertas).

No hay assets en `references/source-assets/` para este juego (esa carpeta no existe hoy en el repo), así que todo se dibuja con formas del canvas y no hay sonido.

---

## Alcance

**Dentro:**

- Motor en `app/games/horizonte/` (TypeScript puro, sin React, sin estado global).
- Scroll lateral continuo hacia la derecha por una caverna con techo y suelo generados por columnas de 20 px, con semilla fija (mismo recorrido en cada partida).
- Nave del jugador con movimiento libre en 4 direcciones (8 con diagonales) dentro de la mitad izquierda, y disparo frontal con autodisparo al mantener `Espacio`.
- 4 tipos de enemigo con patrones fijos: Dardo, Enjambre (grupo de 5), Torreta (anclada al terreno, dispara apuntando) y Boya (rebota entre techo y suelo).
- Puerta destructible al final de cada sector de 3000 px; destruirla sube de sector (nivel), velocidad de scroll y estrechez del túnel.
- 3 vidas, vida extra cada 10.000 puntos (máximo 5), invulnerabilidad de 2 s al reaparecer.
- Puntuación por distancia, por enemigo, por Enjambre completo y por puerta.
- Pantallas del canvas: inicio (`Pulsa ESPACIO para despegar`), `PAUSA`, `Game over`.
- Entrada en `ENGINES` con la clave `horizonte`.
- Fila `horizonte` en `games` mediante una migración nueva y portada CSS `.cover-horizonte`, hecha con `/frontend-design`.
- Guardado en `scores` con `game_id = 'horizonte'`.

**Fuera de alcance (para otros specs):**

- Sonido (no hay assets y no se inventa).
- Jefes de final de sector, mejoras de arma y cualquier sistema de power-ups.
- Escenarios a mano (el terreno es procedural con semilla fija).
- Skins: las añade el agente `skin-designer` al terminar la implementación (`/spec-impl-game`).
- Ajuste fino del mando táctil: lo hace el agente `mobile-porter` (SPEC 10). Aquí solo se deja una entrada `touch` mínima para que el tipo compile.
- Récords locales: el ranking es `scores`.
- Escalado por `devicePixelRatio`.
- Dos jugadores.
- Anti-trampas y tests automatizados (no hay runner).
- Categoría o color nuevos: se usan `SHOOTER` y `cyan`, que ya existen en `GameCategory`, `GameColor` y en los `CHECK` de `games`.

---

## Modelo de datos

Constantes (`app/games/horizonte/constants.ts`), definidas aquí porque no hay original:

```ts
export const W = 800;
export const H = 600;
export const HUD_H = 40; // franja superior del HUD; el área de juego va de y = 40 a y = 600
export const PLAY_TOP = HUD_H;
export const PLAY_H = H - HUD_H; // 560

export const TERRAIN = {
  col: 20, // ancho de columna en px
  thickMin: 20, // grosor mínimo de techo y de suelo
  thickMax: 200,
  step: 12, // variación máxima de grosor entre columnas contiguas (px)
  flatStart: 600, // primeros 600 px de recorrido: techo y suelo planos de 40 px
  flatThick: 40,
  seed: 20261123, // semilla fija del terreno
};

export const SHIP = {
  w: 36, // tamaño dibujado
  h: 20,
  hitW: 24, // caja de colisión centrada
  hitH: 12,
  speed: 260, // px/s; la diagonal se normaliza
  minX: 20, // límites del centro de la nave
  maxX: 420,
  startX: 120,
  respawnInvulnMs: 2000,
};

export const SHOT = {
  w: 12,
  h: 4,
  speed: 640, // px/s hacia la derecha
  cooldownMs: 160, // autodisparo: 6,25 disparos/s
  max: 8, // disparos simultáneos en pantalla
};

export const ENEMY_BULLET = { r: 4, speed: 200, speedDelta: 10, speedMax: 300 };

export const SECTOR = {
  length: 3000, // px de recorrido por sector
  scroll: 120, // px/s en el sector 1
  scrollDelta: 10,
  scrollMax: 220,
  gapMin: 360, // hueco mínimo entre techo y suelo en el sector 1
  gapMinDelta: 20,
  gapMinFloor: 200,
};

export const WAVES = {
  every: 450, // px de recorrido entre oleadas
  first: 600, // primera oleada al recorrer 600 px
  quietBeforeGate: 600, // sin oleadas en los 600 px previos a la puerta
  quietAfterRespawn: 300, // sin oleadas en los 300 px siguientes a reaparecer
  seed: 4242, // semilla fija de las oleadas
};

export const GATE = {
  w: 30,
  hpBase: 4,
  hpPerSector: 2,
  hpMax: 14,
  pointsPerSector: 500,
  minXOnRespawn: 520,
};

export const CFG = {
  lives: 3,
  maxLives: 5,
  extraLifeEvery: 10000,
  distancePointPx: 10, // 1 punto por cada 10 px recorridos
  swarmBonus: 500,
  deathMs: 1200, // explosión; el mundo se congela
  dtMax: 0.05, // s
  scoreMax: 9999999,
};
```

Enemigos:

| Tipo          | Radio | Vida | Puntos       | Movimiento                                                                                | Disparo                                                                                                      | Desde sector |
| ------------- | ----- | ---- | ------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| Dardo         | 12    | 1    | 100          | `vx = -(scroll + 100)`; `y = y0 + 50·sin(2π·t / 1,6)`                                     | No                                                                                                           | 1            |
| Enjambre (×5) | 10    | 1    | 100 cada uno | Como el Dardo con amplitud 80 y periodo 2,0 s; separados 40 px en `x` y desfasados 0,25 s | No                                                                                                           | 1            |
| Torreta       | 14    | 2    | 150          | Anclada al techo o al suelo de su columna; se mueve con el terreno (`vx = -scroll`)       | Bala apuntada a la nave cada 2,0 s (1,5 s desde el sector 4); la primera 1,0 s después de entrar en pantalla | 2            |
| Boya          | 16    | 3    | 200          | `vx = -(scroll - 40)`; `vy = ±60` px/s, rebota en techo y suelo                           | No                                                                                                           | 3            |

Convenciones:

- Coordenadas en px de canvas; `dist` es el recorrido acumulado en px (entero mostrado, flotante interno).
- Columna de terreno `i` cubre el mundo `[20·i, 20·i + 20)`; su `x` en pantalla es `20·i - dist`. Se guardan las columnas visibles más 2 de margen en un buffer circular.
- Sector: `sector = 1 + gatesDestroyed`. Velocidad de scroll: `min(220, 120 + 10 × (sector - 1))` px/s. Hueco mínimo: `max(200, 360 - 20 × (sector - 1))` px.
- Velocidad de las balas enemigas: `min(300, 200 + 10 × (sector - 1))` px/s.
- Vida de la puerta: `min(14, 4 + 2 × sector)` impactos (sector 1: 6; sector 5 en adelante: 14).

Reglas numéricas:

- **Inicio:** nave en `(120, 320)`, puntuación 0, 3 vidas, sector 1, `dist = 0`, techo y suelo planos de 40 px durante los primeros 600 px. Fase `ready`: nada se mueve hasta pulsar `Espacio`.
- **Terreno:** PRNG `mulberry32(TERRAIN.seed)` reiniciado en cada `reset()`. Por columna nueva, techo y suelo cambian cada uno un entero aleatorio en `[-12, 12]`, se limitan a `[20, 200]` y, si el hueco `560 - techo - suelo` es menor que el mínimo del sector, se resta la diferencia al mayor de los dos. Como solo depende del recorrido, dos partidas tienen el mismo terreno.
- **Oleadas:** PRNG `mulberry32(WAVES.seed)` reiniciado en cada `reset()`. Cada 450 px desde `dist = 600` se elige una oleada entre las disponibles en el sector, con igual probabilidad: 3 Dardos (separados 60 px en `x`), 1 Enjambre, 2 Torretas (separadas 200 px; techo o suelo al 50 %) o 2 Boyas (separadas 120 px). Aparecen en `x = 820` con `y0` al azar dentro del hueco de esa columna, a 30 px como mínimo del techo y del suelo. No hay oleadas en los 600 px previos a cada puerta ni en los 300 px siguientes a reaparecer.
- **Disparo:** con `Espacio` pulsado sale un disparo cada 160 ms desde el morro (`x + 18`, `y`), si hay menos de 8 en pantalla. Desaparece al salir por la derecha, al chocar con el terreno o al impactar (cada impacto quita 1 de vida al objetivo).
- **Puntuación:** `score = floor(dist / 10) + puntos de enemigos + bonus`. Dardo 100, unidad de Enjambre 100 y +500 si el jugador destruye las 5 unidades, Torreta 150, Boya 200, puerta `500 × sector` (sector en el que estaba la puerta). Tope 9.999.999.
- **Distancia:** en el sector 1, 10 s de juego sin morir suman exactamente 120 puntos de distancia (120 px/s ÷ 10).
- **Puerta:** al llegar a `dist = 3000 × sector` aparece en `x = 820` una barrera de 30 px de ancho que ocupa todo el hueco de su columna. Se mueve con el terreno. Cada disparo que la toca quita 1 de vida. Al llegar a 0 suma `500 × sector`, desaparece y sube el sector (velocidad y hueco nuevos desde la siguiente columna generada). Tocarla con la nave mata, igual que el terreno.
- **Muerte:** la caja de la nave (24×12) toca el terreno, la puerta, un enemigo (círculo) o una bala enemiga. Se pierde una vida, fase `dying` durante 1,2 s (explosión, mundo congelado). Después, si quedan vidas: se borran los enemigos y balas en pantalla, la nave reaparece en `x = 120` y en el centro del hueco de esa columna, con 2 s de invulnerabilidad frente a enemigos y balas (parpadea a 8 Hz), **no** frente al terreno. Si la puerta está a menos de `x = 520`, se desplaza a `x = 520` y conserva su vida restante. Si no quedan vidas: `gameover`.
- **Vida extra:** cada vez que `score` cruza un múltiplo de 10.000, `lives + 1` hasta un máximo de 5.
- **Choque de un enemigo con el terreno:** los Dardos y Enjambres atraviesan el terreno (se dibujan delante); las Boyas rebotan; las Torretas están ancladas. Las balas enemigas desaparecen al tocar el terreno.
- `dt` en segundos con tope de 0,05 s.

Fases: `ready` → `playing` ⇄ `dying` → `gameover`.

Mapeo a `GameStats`:

- `score`: la puntuación descrita arriba.
- `lives`: vidas reales, de 3 a 0 (máximo 5). `0` en `gameover`.
- `level`: el sector (`1 + puertas destruidas`), sin tope visible.

Teclas:

- `←` `↑` `→` `↓` y `A` `W` `D` `S`: mover la nave.
- `Espacio`: en `ready` despega; en `playing` dispara (mantener = autodisparo); en `gameover` reinicia y emite `onRestart`, solo si la tecla se ha soltado después del game over e ignorando `e.repeat`.
- `P`: pausa y reanuda. Emite `onPauseChange`.
- `K` queda libre para el selector de skins que añadirá `skin-designer` (`S` es "abajo" en WASD).

Registro:

```ts
// app/lib/games/registry.ts
ENGINES.horizonte = {
  factory: createHorizonteGame,
  width: 800,
  height: 600,
  controls: "← ↑ → ↓ / WASD MOVER · ESPACIO DISPARAR/REINICIAR · P PAUSA",
  initialLives: 3,
  // Mínimo para que compile `GameDefinition` (SPEC 10); `mobile-porter` lo revisa.
  touch: {
    dpad: { up: true, down: true, left: true, right: true },
    a: { code: "Space", label: "DISPARAR", short: "DIS" },
    skin: "KeyK",
  },
};
```

Assets: ninguno. Formas del canvas:

- Fondo negro con dos capas de 60 estrellas a 0,2× y 0,5× la velocidad de scroll.
- Terreno relleno `#032a33` con borde de 2 px cian `#00e5ff`.
- Nave: triángulo alargado blanco con borde cian y llama de 6 px parpadeante.
- Enemigos: Dardo rombo magenta, Enjambre círculos amarillos, Torreta semicírculo naranja con cañón que apunta a la nave, Boya hexágono verde con su vida restante en puntos.
- Puerta: barra rayada magenta y cian cuyo brillo baja con la vida.
- HUD del canvas (franja de 40 px): `PUNTOS 000000`, `SECTOR 01`, iconos de vidas y, mientras la puerta está en pantalla, su vida restante.

Fila nueva en `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'horizonte',
  'HORIZONTE',
  'Vuela por la caverna, derriba oleadas y revienta la puerta de cada sector.',
  'Pilota una nave por una caverna que avanza sin parar: el techo y el suelo matan al tocarlos. Derriba Dardos, Enjambres, Torretas y Boyas, y destruye la puerta del final de cada sector para seguir: cada sector es más rápido y estrecho. Tienes 3 vidas y ganas una cada 10.000 puntos.',
  'SHOOTER',
  'cover-horizonte',
  'cyan',
  14
);
```

`sort_order` 14: el máximo actual es 13 (`frogger`, migración `20261121145541_add_frogger_game.sql`). Según las migraciones, `games` tiene hoy 9 filas (`gloton`, `invasores`, `ranaria`, `duelo-pixel`, `asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`). El MCP de Supabase no estaba disponible al escribir este spec: hay que confirmarlo con `select id, sort_order from public.games order by sort_order` antes de crear la migración. `references/implemented-games.md` no lista `frogger`, pero la migración y `ENGINES.frogger` existen.

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` relevante para componentes cliente y `cacheComponents`, `app/lib/games/types.ts`, `app/lib/games/registry.ts` y `app/games/snake/engine.ts` como motor de ejemplo sin original. No genera código.
2. **Constantes y PRNG.** `constants.ts` con los valores de este spec y `rng.ts` con `mulberry32(seed)`. Manual: `npx tsc --noEmit` sin errores y la app sigue arrancando.
3. **Terreno.** `terrain.ts` con funciones puras: generación por columnas con PRNG, tramo plano inicial, hueco mínimo por sector, buffer circular, `ceilAt(x)`, `floorAt(x)` y `rectHitsTerrain(rect)`. Manual: `npx tsc --noEmit`.
4. **Entidades.** `entities.ts`: nave, disparos, Dardo, Enjambre, Torreta, Boya, bala enemiga y puerta, cada una con `update(dt, ctx)` y `draw(ctx)` (contexto por argumento). Oleadas en `waves.ts` con su PRNG. Manual: `npx tsc --noEmit`.
5. **Núcleo del motor.** `engine.ts`: estado en el cierre de `createHorizonteGame`, `reset()` (reinicia las dos semillas), fases, scroll, aparición de oleadas y puertas, colisiones (rectángulo-círculo y rectángulo-terreno), puntuación, vidas, vida extra, muerte, reaparición y sectores. Sin teclado aún.
6. **Bucle y entrada.** `requestAnimationFrame` con `dt` limitado a 0,05 s; `keydown`/`keyup` en `window` ignorando `input`, `textarea` y `button`; `preventDefault` solo en flechas, `WASD`, `Espacio` y `P`; estado de teclas mantenidas para movimiento y autodisparo. Manual: en `/games/horizonte/play` la nave se mueve, dispara y el terreno avanza.
7. **Dibujo.** Estrellas, terreno, nave, enemigos, balas, puerta, explosiones (8 partículas, 0,5 s), HUD del canvas y pantallas `Pulsa ESPACIO para despegar`, `PAUSA` y `Game over` con la puntuación.
8. **Ciclo de vida.** `start`, `pause`, `resume` (reinicia `lastTime`), `restart`, `end` y `destroy`; tecla `P` con `onPauseChange`; `onStats` solo cuando cambia `score`, `lives` o `level` (y al iniciar o reiniciar); un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez; `onRestart` al reiniciar con `Espacio` soltado tras el game over e ignorando `e.repeat`.
9. **Registro y catálogo.** Entrada `horizonte` en `ENGINES` (con el `touch` mínimo); migración nueva `supabase/migrations/YYYYMMDDHHMMSS_add_horizonte_game.sql` aplicada con `mcp__supabase__apply_migration`; portada `.cover-horizonte` en `app/globals.css` con `/frontend-design`, distinta de `.cover-asteroids` (también SHOOTER y cian).
10. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida completa guardada y comprobada en `/games/horizonte`, `/hall-of-fame` y `/`, consola, `get_advisors`, borrado de filas de prueba y retirada de código muerto.

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/horizonte/play`.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.
- [ ] Asteroides, Tetris, Arkanoid, Snake y Frogger conservan su canvas, su línea de controles y sus vidas iniciales (3, 1, 3, 1 y 3).

**Catálogo**

- [ ] `/games` muestra 10 tarjetas y la de HORIZONTE tiene portada propia `.cover-horizonte`, distinguible de `.cover-asteroids`.
- [ ] `/games/horizonte` y `/games/horizonte/play` responden 200.
- [ ] `games` contiene la fila `horizonte` (`SHOOTER`, `cyan`, `sort_order` 14) y `list_migrations` lista la migración.
- [ ] Las filas existentes de `games` no cambian.

**Juego**

- [ ] Al cargar aparece el canvas (no `.game-arena`) con la nave en `(120, 320)`, techo y suelo planos de 40 px, la franja de HUD de 40 px y el texto `Pulsa ESPACIO para despegar`. Nada se mueve hasta pulsar `Espacio`.
- [ ] Ambos HUD (canvas y HTML) muestran puntuación 0, tres `♥` y nivel 01 al empezar.
- [ ] Las flechas y `WASD` mueven la nave a 260 px/s; la nave no sale de `x` 20–420 ni de la zona de juego.
- [ ] Mantener `Espacio` dispara 6 o 7 veces por segundo (un disparo cada 160 ms) y nunca hay más de 8 disparos en pantalla.
- [ ] En el sector 1, 10 s de vuelo sin derribar nada suman 120 puntos (±1 por redondeo de frame).
- [ ] Derribar un Dardo suma exactamente 100 en ambos HUD; una Torreta, 150 tras 2 impactos; una Boya, 200 tras 3 impactos.
- [ ] Derribar las 5 unidades de un Enjambre suma 5 × 100 + 500 = 1000; si escapa alguna, solo 100 por unidad.
- [ ] Dos partidas seguidas muestran el mismo terreno y las mismas oleadas en el mismo punto del recorrido.
- [ ] El hueco entre techo y suelo nunca baja de 360 px en el sector 1 ni de 200 px en ningún sector.
- [ ] No aparecen Torretas en el sector 1 ni Boyas antes del sector 3.
- [ ] A los 3000 px de recorrido aparece la puerta; con 6 impactos se destruye, suma 500, el nivel pasa a 02 en ambos HUD y el scroll pasa de 120 a 130 px/s.
- [ ] Tocar el terreno, la puerta, un enemigo o una bala enemiga quita una vida en ambos HUD; tras 1,2 s la nave reaparece en `x = 120` parpadeando y durante 2 s los enemigos y balas no la dañan, pero el terreno sí.
- [ ] Si la puerta estaba a menos de `x = 520` al morir, reaparece en `x = 520` con la misma vida restante.
- [ ] Al cruzar 10.000 puntos se gana una vida (cuatro `♥`); nunca hay más de cinco.
- [ ] Perder la última vida termina la partida: el canvas muestra `Game over` con la puntuación y el HUD pasa a 0 `♥`.
- [ ] Ambos HUD muestran siempre los mismos `score`, `lives` y `level`.
- [ ] PAUSA congela scroll, enemigos y balas, el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y emite el cambio de estado a React. Al reanudar no hay salto.
- [ ] Al terminar, el canvas muestra `Game over` y el modal aparece con la misma puntuación, una sola vez.
- [ ] Con `Espacio` mantenido al morir, la partida no se reinicia sola: hay que soltar y volver a pulsar. Entonces reinicia con 0 puntos, tres `♥` y nivel 01 en ambos HUD, el mismo terreno inicial, y se cierra el modal.
- [ ] FIN abre el modal con la puntuación actual y JUGAR DE NUEVO reinicia.
- [ ] Se puede escribir un nombre con espacios en el modal sin que `Espacio` dispare o reinicie ni `P` pause.
- [ ] Salir y volver, y el doble montaje de StrictMode, no dejan dos bucles ni listeners duplicados: el scroll del sector 1 va a 120 px/s, no a 240, y cada pulsación de `P` pausa una sola vez.
- [ ] La línea de controles aparece en `/games/horizonte/play` con las teclas de Horizonte y no en juegos sin motor.

**Leaderboard**

- [ ] GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'horizonte'`, el nombre y la puntuación del modal. Un doble clic crea una sola fila.
- [ ] Tras guardar, `/games/horizonte` la muestra en `#01`, `Partidas` y `Mejor global` se actualizan, y aparece en `/hall-of-fame` y en la actividad de `/`.
- [ ] Los juegos sin motor siguen con simulación y sin botón de guardar.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados.

---

## Decisiones

- **Sí:** id nuevo `horizonte`, el mismo de la propuesta GP-019 (es el juego de esa entrada del TODO, no un choque). **No:** reutilizar un id simulado; `invasores` es un shooter fijo, no de scroll. **Supuesto del agente.**
- **Sí:** `SHOOTER` y `cyan`, como pide GP-019. **No:** categoría o color nuevos. Se acepta que Asteroides también sea SHOOTER cian; la portada debe distinguirse.
- **Sí:** terreno procedural por columnas con semilla fija, para que todas las partidas recorran la misma caverna y el ranking sea comparable. **No:** semilla aleatoria por partida ni escenarios dibujados a mano. **Supuesto del agente.**
- **Sí:** 3 vidas, vida extra cada 10.000 (máximo 5) y muerte por cualquier contacto. **No:** barra de energía (es la variante B). **Supuesto del agente.**
- **Sí:** puerta destructible al final de cada sector como hito de nivel. **No:** jefes de sector, que multiplican el trabajo de diseño.
- **Sí:** autodisparo al mantener `Espacio` con cadencia fija. **No:** disparo cargado, mejoras de arma, naves satélite ni módulos acoplables, para no acercarse a juegos concretos del género.
- **Sí:** al morir, se congela el mundo 1,2 s y se reaparece en el mismo punto con 2 s de invulnerabilidad frente a enemigos. **No:** volver al inicio del sector (obliga a guardar y regenerar el terreno).
- **Sí:** puntos por distancia (1 por 10 px) además de por derribos, para que sobrevivir cuente. **No:** puntuar solo los derribos.
- **Sí:** `lives` reales y `level` = sector, con `initialLives: 3`. Es el caso "con vidas propias" del contrato.
- **Sí:** `Espacio` reinicia solo tras soltarlo e ignorando `e.repeat`, porque también es el disparo. Teclado en `window` ignorando `input`, `textarea` y `button`; `P` para pausar.
- **Sí:** `K` reservada para skins y `touch` mínimo en el registro. **No:** diseñar aquí skins ni el mando táctil, que hacen `skin-designer` y `mobile-porter`.
- **Sí:** formas del canvas y sin sonido. **No:** inventar assets.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                                    | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners; criterio de aceptación                                                |
| El terreno genera un hueco imposible o un escalón que no da tiempo a esquivar | Hueco mínimo de 200 px y variación de 12 px por columna: a 220 px/s el borde se mueve como mucho 132 px/s, la mitad de la velocidad de la nave |
| La puerta llega antes de poder destruirla en sectores altos                   | Vida máxima 14 (2,2 s de autodisparo) y la puerta tarda 3,6 s en cruzar la pantalla a 220 px/s; se ajusta en pruebas                           |
| Reaparecer encima de un enemigo, una bala o la puerta                         | Se borran enemigos y balas, la puerta se aleja a `x = 520` y hay 2 s de invulnerabilidad frente a enemigos                                     |
| Muerte injusta por colisiones con la caja dibujada                            | Caja de colisión de 24×12, más pequeña que la nave dibujada (36×20)                                                                            |
| `Espacio` mantenido al morir reinicia al instante                             | Reinicio solo tras `keyup` de `Espacio` y con `e.repeat` ignorado; criterio de aceptación                                                      |
| `Espacio` pulsado en el modal dispara o reinicia                              | El teclado ignora objetivos `input`, `textarea` y `button`; criterio de aceptación                                                             |
| Tras pausar, el `dt` acumulado provoca un salto                               | `lastTime` se reinicia en `resume()` y `dt` tiene tope de 0,05 s                                                                               |
| Parecido con shooters de scroll concretos                                     | Lista de elementos excluidos en "Por qué existe este spec" y Decisiones; nombres y enemigos propios                                            |
| Dos tarjetas SHOOTER cian se confunden en `/games`                            | `.cover-horizonte` con composición propia (perfil de caverna y horizonte), criterio de aceptación                                              |
| `sort_order` o número de tarjetas distinto en la BD real                      | Se dedujo de las migraciones sin MCP; el paso 9 lo comprueba con `execute_sql` antes de migrar                                                 |

---

## Qué **no** está en este spec

- Sonido.
- Jefes, power-ups, mejoras de arma y escenarios a mano.
- Skins y ajuste del mando táctil (los hacen `skin-designer` y `mobile-porter`).
- Modo de escudo y multiplicador (variante B).
- Récords locales.
- Escalado por `devicePixelRatio`.
- Dos jugadores.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
