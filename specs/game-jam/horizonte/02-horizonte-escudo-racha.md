# GAME JAM — HORIZONTE · Variante B: Escudo y racha

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-23
> **Objective:** Crear `horizonte`, un shoot'em up de scroll lateral sin fin por una caverna con techo y suelo, oleadas de enemigos con patrones fijos, escudo de energía en lugar de vidas y multiplicador por racha de derribos, como motor TypeScript con canvas único 800×600 y ranking en Supabase.

---

## Por qué existe este spec

Es el resultado de la game jam con el tema GP-019 del TODO del `game-planner` (`horizonte`, SHOOTER, cian, 21/25): "shoot'em up de scroll lateral; más contenido (terreno, patrones)". Sería el segundo SHOOTER con motor real, tras Asteroides (SPEC 05), y reutiliza el leaderboard genérico de SPEC 06 y la `GameDefinition` de SPEC 07. No hay código de referencia: las reglas se definen aquí, como en SPEC 09.

Se diseña una mecánica de género original. La nota del TODO pide evitar elementos de dos clásicos concretos del género, así que este spec **no** usa barra de selección de mejoras, naves satélite que copian los disparos, disparo cargado, módulo acoplable que absorbe balas, cabezas de piedra, volcanes ni depósito de combustible. El título, el id, los enemigos (Dardo, Enjambre, Torreta, Boya), las cápsulas de escudo y el multiplicador por racha son propios. El aspecto es el neón de la plataforma con formas del canvas.

Esta variante cambia la mecánica respecto a la A (vidas y puertas): no hay vidas sino un **escudo de 100 puntos de energía**; rozar el terreno no mata, empuja la nave y gasta escudo; cada derribo encadenado en menos de 2 s sube un **multiplicador** de x1 a x8 que se pierde al recibir daño; los Enjambres completos y cada 12.º derribo sueltan **cápsulas** que recargan el escudo. No hay puertas: el sector sube cada 3000 px de recorrido. La partida termina cuando el escudo llega a 0. Comparte con la A id, título, terreno, enemigos y fila de `games`.

No hay assets en `references/source-assets/` para este juego (esa carpeta no existe hoy en el repo), así que todo se dibuja con formas del canvas y no hay sonido.

---

## Alcance

**Dentro:**

- Motor en `app/games/horizonte/` (TypeScript puro, sin React, sin estado global).
- Scroll lateral continuo hacia la derecha por una caverna con techo y suelo generados por columnas de 20 px, con semilla fija (mismo recorrido en cada partida).
- Nave del jugador con movimiento libre en 4 direcciones (8 con diagonales) dentro de la mitad izquierda, y disparo frontal con autodisparo al mantener `Espacio`.
- 4 tipos de enemigo con patrones fijos: Dardo, Enjambre (grupo de 5), Torreta (anclada al terreno, dispara apuntando) y Boya (rebota entre techo y suelo).
- Escudo de energía (100) con daño por bala, por choque con enemigo y por roce con el terreno, que empuja la nave fuera de la pared.
- Multiplicador por racha de derribos (x1 a x8, ventana de 2 s) y cápsulas de escudo.
- Sector cada 3000 px de recorrido, con velocidad de scroll y estrechez del túnel crecientes.
- Pantallas del canvas: inicio (`Pulsa ESPACIO para despegar`), aviso `SECTOR 02` (y siguientes), `PAUSA`, `Game over`.
- Entrada en `ENGINES` con la clave `horizonte`.
- Fila `horizonte` en `games` mediante una migración nueva y portada CSS `.cover-horizonte`, hecha con `/frontend-design`.
- Guardado en `scores` con `game_id = 'horizonte'`.

**Fuera de alcance (para otros specs):**

- Sonido (no hay assets y no se inventa).
- Vidas, puertas de sector y jefes (las puertas son de la variante A).
- Mejoras de arma y cualquier sistema de power-ups distinto de las cápsulas de escudo.
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

Constantes (`app/games/horizonte/constants.ts`), definidas aquí porque no hay original. `TERRAIN`, `SHIP`, `SHOT`, `ENEMY_BULLET`, `SECTOR` y la tabla de enemigos son idénticos a la variante A, para que el recorrido sea el mismo:

```ts
export const W = 800;
export const H = 600;
export const HUD_H = 40; // franja superior del HUD; el área de juego va de y = 40 a y = 600
export const PLAY_TOP = HUD_H;
export const PLAY_H = H - HUD_H; // 560

export const TERRAIN = {
  col: 20, // ancho de columna en px
  thickMin: 20,
  thickMax: 200,
  step: 12, // variación máxima de grosor entre columnas contiguas (px)
  flatStart: 600, // primeros 600 px: techo y suelo planos de 40 px
  flatThick: 40,
  seed: 20261123,
};

export const SHIP = {
  w: 36,
  h: 20,
  hitW: 24,
  hitH: 12,
  speed: 260, // px/s; la diagonal se normaliza
  minX: 20,
  maxX: 420,
  startX: 120,
};

export const SHOT = { w: 12, h: 4, speed: 640, cooldownMs: 160, max: 8 };

export const ENEMY_BULLET = { r: 4, speed: 200, speedDelta: 10, speedMax: 300 };

export const SECTOR = {
  length: 3000,
  scroll: 120,
  scrollDelta: 10,
  scrollMax: 220,
  gapMin: 360,
  gapMinDelta: 20,
  gapMinFloor: 200,
  bannerMs: 1500, // aviso "SECTOR NN"
};

export const WAVES = {
  every: 450,
  first: 600,
  seed: 4242,
};

export const SHIELD = {
  max: 100,
  start: 100,
  bulletDamage: 15,
  enemyDamage: 25, // el enemigo se destruye sin dar puntos
  terrainDrainPerSec: 60,
  hitInvulnMs: 600, // tras una bala o un choque, inmune a balas y enemigos (no al terreno)
  lowWarning: 30, // por debajo, la barra parpadea
};

export const STREAK = {
  windowMs: 2000, // tiempo para encadenar el siguiente derribo
  maxMult: 8,
};

export const CAPSULE = {
  r: 10,
  shield: 25,
  fullShieldPoints: 250, // si el escudo ya está a 100
  everyKills: 12, // además, cada 12.º derribo suelta una
};

export const CFG = {
  distancePointPx: 10, // 1 punto por cada 10 px recorridos
  deathMs: 1200, // explosión final antes del game over
  dtMax: 0.05, // s
  scoreMax: 9999999,
};
```

Enemigos (igual que la variante A):

| Tipo          | Radio | Vida | Puntos base  | Movimiento                                                                                | Disparo                                                                                                      | Desde sector |
| ------------- | ----- | ---- | ------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| Dardo         | 12    | 1    | 100          | `vx = -(scroll + 100)`; `y = y0 + 50·sin(2π·t / 1,6)`                                     | No                                                                                                           | 1            |
| Enjambre (×5) | 10    | 1    | 100 cada uno | Como el Dardo con amplitud 80 y periodo 2,0 s; separados 40 px en `x` y desfasados 0,25 s | No                                                                                                           | 1            |
| Torreta       | 14    | 2    | 150          | Anclada al techo o al suelo de su columna; `vx = -scroll`                                 | Bala apuntada a la nave cada 2,0 s (1,5 s desde el sector 4); la primera 1,0 s después de entrar en pantalla | 2            |
| Boya          | 16    | 3    | 200          | `vx = -(scroll - 40)`; `vy = ±60` px/s, rebota en techo y suelo                           | No                                                                                                           | 3            |

Convenciones:

- Coordenadas en px de canvas; `dist` es el recorrido acumulado en px.
- Columna de terreno `i` cubre el mundo `[20·i, 20·i + 20)`; su `x` en pantalla es `20·i - dist`. Buffer circular con las columnas visibles más 2.
- Sector: `sector = 1 + floor(dist / 3000)`. Velocidad de scroll: `min(220, 120 + 10 × (sector - 1))` px/s. Hueco mínimo: `max(200, 360 - 20 × (sector - 1))` px.
- Velocidad de las balas enemigas: `min(300, 200 + 10 × (sector - 1))` px/s.
- Multiplicador: `mult` entero de 1 a 8; `streakTimer` en ms.

Reglas numéricas:

- **Inicio:** nave en `(120, 320)`, puntuación 0, escudo 100, `mult = 1`, sector 1, `dist = 0`, techo y suelo planos de 40 px durante los primeros 600 px. Fase `ready`: nada se mueve hasta pulsar `Espacio`.
- **Terreno:** PRNG `mulberry32(TERRAIN.seed)` reiniciado en cada `reset()`. Por columna nueva, techo y suelo cambian cada uno un entero aleatorio en `[-12, 12]`, se limitan a `[20, 200]` y, si el hueco `560 - techo - suelo` es menor que el mínimo del sector, se resta la diferencia al mayor. Solo depende del recorrido: dos partidas tienen el mismo terreno.
- **Oleadas:** PRNG `mulberry32(WAVES.seed)` reiniciado en cada `reset()`. Cada 450 px desde `dist = 600` se elige una oleada entre las disponibles en el sector, con igual probabilidad: 3 Dardos (separados 60 px), 1 Enjambre, 2 Torretas (separadas 200 px; techo o suelo al 50 %) o 2 Boyas (separadas 120 px). Aparecen en `x = 820` con `y0` al azar dentro del hueco, a 30 px como mínimo del techo y del suelo. Sin pausas entre sectores.
- **Disparo:** con `Espacio` pulsado sale un disparo cada 160 ms desde el morro (`x + 18`, `y`), si hay menos de 8 en pantalla. Desaparece al salir por la derecha, al chocar con el terreno o al impactar (1 de daño).
- **Racha:** al derribar un enemigo, si `streakTimer > 0` entonces `mult = min(8, mult + 1)`; en cualquier caso `streakTimer = 2000`. El enemigo suma `puntos base × mult` (el `mult` ya actualizado: el primer derribo vale ×1, el segundo encadenado ×2). Si `streakTimer` llega a 0, `mult = 1`. Cualquier daño (bala, choque o primer frame de roce con el terreno) pone `mult = 1` y `streakTimer = 0`.
- **Puntuación:** `score = floor(dist / 10) + Σ(puntos base × mult) + 250 por cada cápsula con escudo lleno`. La distancia y las cápsulas no se multiplican. Tope 9.999.999.
- **Distancia:** en el sector 1, 10 s de juego suman exactamente 120 puntos de distancia (120 px/s ÷ 10).
- **Escudo:** bala enemiga −15, choque con enemigo −25 (el enemigo se destruye sin puntos y sin contar para la racha), roce con el terreno −60 por segundo de contacto. Tras una bala o un choque hay 600 ms de inmunidad a balas y enemigos (la nave parpadea), no al terreno. El escudo no se regenera solo.
- **Roce con el terreno:** tras mover la nave, si su caja (24×12) invade el techo o el suelo de alguna columna que solapa, la nave se empuja verticalmente hasta el borde y se marca roce ese frame (chispas). Con un hueco mínimo de 200 px nunca toca techo y suelo a la vez. Los disparos que tocan el terreno desaparecen.
- **Cápsulas:** caen al destruir las 5 unidades de un Enjambre (en la posición de la última) y en cada 12.º derribo total (contador sin reinicio). Se mueven con el terreno (`vx = -scroll`); al tocar la nave (círculo de radio 10) dan +25 de escudo con tope 100 o, si el escudo ya estaba a 100, 250 puntos. Desaparecen al salir por la izquierda.
- **Sector:** al cruzar cada múltiplo de 3000 px sube el sector, se muestra `SECTOR NN` durante 1,5 s y la velocidad y el hueco nuevos se aplican desde la siguiente columna generada.
- **Fin:** el escudo llega a 0 → fase `dying` durante 1,2 s (explosión, mundo congelado) → `gameover`.
- **Choque de un enemigo con el terreno:** los Dardos y Enjambres atraviesan el terreno (se dibujan delante); las Boyas rebotan; las Torretas están ancladas. Las balas enemigas desaparecen al tocar el terreno.
- `dt` en segundos con tope de 0,05 s.

Fases: `ready` → `playing` → `dying` → `gameover`.

Mapeo a `GameStats`:

- `score`: la puntuación descrita arriba.
- `lives`: `1` mientras el escudo es mayor que 0 y `0` en `dying` y `gameover`. Es el mapeo del contrato para juegos sin vidas (Tetris, Snake). El escudo exacto solo se ve en el HUD del canvas.
- `level`: el sector (`1 + floor(dist / 3000)`), sin tope visible.

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
  initialLives: 1,
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
- Terreno relleno `#032a33` con borde de 2 px cian `#00e5ff`; chispas amarillas en el punto de roce.
- Nave: triángulo alargado blanco con borde cian, llama de 6 px y un halo cian cuya opacidad es proporcional al escudo.
- Enemigos: Dardo rombo magenta, Enjambre círculos amarillos, Torreta semicírculo naranja con cañón que apunta a la nave, Boya hexágono verde con su vida restante en puntos.
- Cápsula: círculo cian con una cruz blanca, pulsante.
- HUD del canvas (franja de 40 px): `PUNTOS 000000`, `SECTOR 01`, barra de escudo de 160 px con el valor numérico (parpadea por debajo de 30) y el multiplicador `x1`–`x8` con una barra que se vacía en 2 s.

Fila nueva en `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'horizonte',
  'HORIZONTE',
  'Vuela por la caverna sin fin y encadena derribos antes de que se agote tu escudo.',
  'Pilota una nave por una caverna que avanza sin parar. Rozar el techo o el suelo te empuja y gasta escudo; las balas y los choques también. Derriba Dardos, Enjambres, Torretas y Boyas en menos de 2 segundos entre uno y otro para subir el multiplicador hasta x8, y recoge cápsulas para recargar el escudo. Cada sector es más rápido y estrecho. La partida acaba cuando el escudo llega a cero.',
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
3. **Terreno.** `terrain.ts` con funciones puras: generación por columnas con PRNG, tramo plano inicial, hueco mínimo por sector, buffer circular, `ceilAt(x)`, `floorAt(x)` y `pushOutOfTerrain(rect)` que devuelve la `y` corregida y si hubo roce. Manual: `npx tsc --noEmit`.
4. **Entidades.** `entities.ts`: nave, disparos, Dardo, Enjambre, Torreta, Boya, bala enemiga y cápsula, cada una con `update(dt, ctx)` y `draw(ctx)` (contexto por argumento). Oleadas en `waves.ts` con su PRNG. Manual: `npx tsc --noEmit`.
5. **Núcleo del motor.** `engine.ts`: estado en el cierre de `createHorizonteGame`, `reset()` (reinicia las dos semillas), fases, scroll, sectores, oleadas, colisiones (rectángulo-círculo y empuje contra el terreno), escudo, inmunidad, racha y multiplicador, cápsulas y puntuación. Sin teclado aún.
6. **Bucle y entrada.** `requestAnimationFrame` con `dt` limitado a 0,05 s; `keydown`/`keyup` en `window` ignorando `input`, `textarea` y `button`; `preventDefault` solo en flechas, `WASD`, `Espacio` y `P`; estado de teclas mantenidas para movimiento y autodisparo. Manual: en `/games/horizonte/play` la nave se mueve, dispara, el terreno avanza y rozarlo gasta escudo.
7. **Dibujo.** Estrellas, terreno, chispas, nave con halo, enemigos, balas, cápsulas, explosiones (8 partículas, 0,5 s), HUD del canvas (escudo y multiplicador) y pantallas `Pulsa ESPACIO para despegar`, `SECTOR NN`, `PAUSA` y `Game over` con la puntuación.
8. **Ciclo de vida.** `start`, `pause`, `resume` (reinicia `lastTime`), `restart`, `end` y `destroy`; tecla `P` con `onPauseChange`; `onStats` solo cuando cambia `score`, `lives` o `level` (y al iniciar o reiniciar), nunca por el escudo o el multiplicador; un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez; `onRestart` al reiniciar con `Espacio` soltado tras el game over e ignorando `e.repeat`.
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

- [ ] Al cargar aparece el canvas (no `.game-arena`) con la nave en `(120, 320)`, techo y suelo planos de 40 px, escudo 100, `x1` y el texto `Pulsa ESPACIO para despegar`. Nada se mueve hasta pulsar `Espacio`.
- [ ] Ambos HUD (canvas y HTML) muestran puntuación 0, un `♥` y nivel 01 al empezar.
- [ ] Las flechas y `WASD` mueven la nave a 260 px/s; la nave no sale de `x` 20–420 ni de la zona de juego.
- [ ] Mantener `Espacio` dispara 6 o 7 veces por segundo (un disparo cada 160 ms) y nunca hay más de 8 disparos en pantalla.
- [ ] En el sector 1, 10 s de vuelo sin derribar nada suman 120 puntos (±1 por redondeo de frame).
- [ ] Derribar un Dardo sin racha suma exactamente 100; un segundo Dardo antes de 2 s suma 200 y el HUD del canvas muestra `x2`; un tercero, 300 y `x3`.
- [ ] Si pasan 2 s sin derribos, el multiplicador vuelve a `x1`. Nunca pasa de `x8`.
- [ ] Una bala enemiga baja el escudo exactamente 15 y vuelve el multiplicador a `x1`; durante los 600 ms siguientes otra bala no lo baja.
- [ ] Chocar con un enemigo baja el escudo 25, destruye al enemigo y no suma puntos.
- [ ] Mantener la nave contra el suelo la empuja fuera de la pared (no lo atraviesa ni muere al instante) y el escudo baja unos 60 por segundo; tras 1 s de roce queda en 40 ± 2 desde 100.
- [ ] Derribar las 5 unidades de un Enjambre suelta una cápsula; recogerla sube el escudo 25 (sin pasar de 100) y, con el escudo a 100, suma 250 puntos.
- [ ] El 12.º derribo de la partida suelta una cápsula aunque no sea de un Enjambre.
- [ ] Dos partidas seguidas muestran el mismo terreno y las mismas oleadas en el mismo punto del recorrido.
- [ ] El hueco entre techo y suelo nunca baja de 360 px en el sector 1 ni de 200 px en ningún sector.
- [ ] No aparecen Torretas en el sector 1 ni Boyas antes del sector 3.
- [ ] A los 3000 px de recorrido (25 s de vuelo) el canvas muestra `SECTOR 02` durante 1,5 s, el nivel pasa a 02 en ambos HUD y el scroll pasa de 120 a 130 px/s. No hay puerta.
- [ ] Con el escudo a 0 la nave explota, tras 1,2 s el canvas muestra `Game over` con la puntuación y el HUD pasa a 0 `♥`.
- [ ] El escudo y el multiplicador no provocan llamadas a `onStats`: el HUD HTML solo cambia con `score`, `lives` y `level`.
- [ ] Ambos HUD muestran siempre los mismos `score`, `lives` y `level`.
- [ ] PAUSA congela scroll, enemigos, balas, el temporizador de racha y el roce, el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y emite el cambio de estado a React. Al reanudar no hay salto ni se pierde la racha por el tiempo en pausa.
- [ ] Al terminar, el canvas muestra `Game over` y el modal aparece con la misma puntuación, una sola vez.
- [ ] Con `Espacio` mantenido al perder, la partida no se reinicia sola: hay que soltar y volver a pulsar. Entonces reinicia con 0 puntos, un `♥`, nivel 01, escudo 100 y `x1`, el mismo terreno inicial, y se cierra el modal.
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
- **Sí:** terreno procedural por columnas con semilla fija, para que todas las partidas recorran la misma caverna y el ranking sea comparable. **No:** semilla aleatoria por partida. **Supuesto del agente.**
- **Sí:** escudo de 100 sin regeneración, recargable solo con cápsulas. **No:** vidas (son la variante A) ni regeneración automática, que haría la partida casi infinita. **Supuesto del agente.**
- **Sí:** rozar el terreno empuja y gasta 60 por segundo. **No:** muerte instantánea por terreno, que con escudo sería incoherente y es la parte más difícil de ajustar.
- **Sí:** multiplicador x1–x8 por derribos encadenados en 2 s, que se pierde con cualquier daño, aplicado solo a los enemigos. **No:** multiplicar la distancia o las cápsulas, que premiaría esperar. **Supuesto del agente.**
- **Sí:** cápsulas por Enjambre completo y cada 12.º derribo. **No:** cápsulas aleatorias, que romperían la igualdad entre partidas.
- **Sí:** sector cada 3000 px con aviso en el canvas. **No:** puertas (variante A) ni jefes.
- **Sí:** autodisparo al mantener `Espacio` con cadencia fija. **No:** disparo cargado, mejoras de arma, naves satélite ni módulos acoplables, para no acercarse a juegos concretos del género.
- **Sí:** `lives = 1` y `0` al terminar, con `initialLives: 1`, como Tetris y Snake. El escudo solo se ve en el canvas. **No:** mapear el escudo a `lives` (el HUD HTML mostraría hasta 100 corazones).
- **Sí:** `level` = sector por distancia.
- **Sí:** `Espacio` reinicia solo tras soltarlo e ignorando `e.repeat`, porque también es el disparo. Teclado en `window` ignorando `input`, `textarea` y `button`; `P` para pausar.
- **Sí:** `K` reservada para skins y `touch` mínimo en el registro. **No:** diseñar aquí skins ni el mando táctil, que hacen `skin-designer` y `mobile-porter`.
- **Sí:** formas del canvas y sin sonido. **No:** inventar assets.

## Riesgos

| Riesgo                                                                                              | Mitigación                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                                                          | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners; criterio de aceptación                                                      |
| El empuje contra el terreno hace vibrar la nave o la atrapa entre un escalón y el borde de pantalla | Empuje solo vertical tras el movimiento; hueco mínimo de 200 px y variación de 12 px por columna; se prueba pegado a techo y suelo en sectores 1 y 6 |
| Puntuaciones disparadas por el multiplicador x8                                                     | Ventana corta (2 s), se pierde con cualquier daño y no afecta a la distancia; el máximo práctico queda lejos de 9.999.999, con tope en el motor      |
| Partidas demasiado largas si el jugador recoge muchas cápsulas                                      | Sin regeneración, cápsulas solo por Enjambre completo y cada 12 derribos, y velocidad y estrechez crecientes; se ajusta en pruebas                   |
| La racha caduca durante la pausa                                                                    | `streakTimer` solo avanza en `playing`; criterio de aceptación                                                                                       |
| `onStats` se emite cada frame por el escudo                                                         | El escudo y el multiplicador no forman parte de `GameStats`; `onStats` compara solo `score`, `lives` y `level`                                       |
| `Espacio` mantenido al perder reinicia al instante                                                  | Reinicio solo tras `keyup` de `Espacio` y con `e.repeat` ignorado; criterio de aceptación                                                            |
| `Espacio` pulsado en el modal dispara o reinicia                                                    | El teclado ignora objetivos `input`, `textarea` y `button`; criterio de aceptación                                                                   |
| Tras pausar, el `dt` acumulado provoca un salto                                                     | `lastTime` se reinicia en `resume()` y `dt` tiene tope de 0,05 s                                                                                     |
| Parecido con shooters de scroll concretos                                                           | Lista de elementos excluidos en "Por qué existe este spec" y Decisiones; nombres y enemigos propios                                                  |
| Dos tarjetas SHOOTER cian se confunden en `/games`                                                  | `.cover-horizonte` con composición propia (perfil de caverna y horizonte), criterio de aceptación                                                    |
| `sort_order` o número de tarjetas distinto en la BD real                                            | Se dedujo de las migraciones sin MCP; el paso 9 lo comprueba con `execute_sql` antes de migrar                                                       |

---

## Qué **no** está en este spec

- Sonido.
- Vidas, puertas, jefes, mejoras de arma y escenarios a mano.
- Skins y ajuste del mando táctil (los hacen `skin-designer` y `mobile-porter`).
- Récords locales.
- Escalado por `devicePixelRatio`.
- Dos jugadores.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
