# Integración en la plataforma

Qué tocar para que un motor ya escrito aparezca en el catálogo, se juegue en `/games/<id>/play` y guarde en el leaderboard.

## 0. Generalización (primer juego después de Asteroides)

Hoy hay varios acoplamientos a Asteroides. Compruébalos en el código; si siguen ahí, el primer paso del plan es quitarlos:

- `app/components/GameCanvas.tsx` importa `W`, `H` de `../games/asteroids/constants` y fija `aspectRatio: "4 / 3"`.
- `app/components/GamePlayer.tsx` tiene la línea de controles de Asteroides escrita literal (`← → ROTAR · ↑ PROPULSAR · ...`).

- `GamePlayer.tsx` hace `ENGINES[game.id] as GameEngineFactory | undefined`: ese cast desaparece al introducir `GameDefinition`.
- `.crt-screen` en `app/globals.css` fuerza `aspect-ratio: 4 / 3`. Un juego vertical (Tetris, tablero 300×600) no cabe bien. Opciones: canvas 800×600 con el panel lateral dibujado dentro (recomendado, no toca CSS) o aspecto por juego vía la definición. Decídelo en la spec.

Solución recomendada: el registro guarda una definición en vez de solo la fábrica.

```ts
// app/lib/games/registry.ts
export type GameDefinition = {
  factory: GameEngineFactory;
  width: number;   // resolución interna del canvas
  height: number;
  controls: string; // línea bajo .crt-bottom
};
export const ENGINES: Record<string, GameDefinition> = {
  asteroids: { factory: createAsteroidsGame, width: 800, height: 600, controls: "← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · ↓ ESCUDO · P PAUSA" },
};
```

`GameCanvas` recibe `width`/`height` por props y usa `aspectRatio: \`${width} / ${height}\``; `GamePlayer` pinta `definition.controls`. `ENGINES[game.id]` sigue siendo la condición de "tiene motor" (también para mostrar u ocultar GUARDAR PUNTUACIÓN). Es un cambio de refactor pequeño: déjalo en la spec como su propio paso, verificando que Asteroides sigue igual.

## 1. Motor

`app/games/<id>/` según `engine-contract.md`.

## 2. Registro

Añade la entrada en `app/lib/games/registry.ts` con la clave igual al `id` de `games` (`caida`, `bloque-buster`, o el nuevo id).

## 3. Fila en `games` (migración nueva)

Crea `supabase/migrations/<timestamp>_<descripcion>.sql` (formato del existente `20261119091251_games_and_scores.sql`: `YYYYMMDDHHMMSS`) y aplícala con `mcp__supabase__apply_migration`. Nunca edites una migración ya aplicada.

- **Migración solo si cambia algo en la base de datos.** Con un id reutilizado cuyo texto ya describe el juego real, no hay migración ni `update`: dilo en la spec y quita ese paso del plan.
- **Id nuevo:**
  ```sql
  insert into public.games (id, title, short, long, cat, cover, color, sort_order)
  values ('<id>', '<TÍTULO>', '<frase corta>', '<descripción acorde al juego REAL>', '<CAT>', 'cover-<id>', '<color>', <max(sort_order)+1>);
  ```
  Consulta el máximo actual con `execute_sql` (`select max(sort_order) from games`). `short`/`long` deben describir lo que el juego hace de verdad (SPEC 05: sin OVNIs si no hay OVNIs).
- **Reutilizando un id simulado:** no se inserta nada. Si el texto actual describe mecánicas que el juego real no tiene, `update public.games set short=..., long=... where id='<id>'` y, solo si el usuario lo pidió, una portada nueva. La portada existente (`cover-tetro`, `cover-bricks`...) se conserva por defecto.
- Si añades el juego, el catálogo pasa a N+1 tarjetas y la Home (`games.slice(0, 6)`) no cambia mientras `sort_order` sea el último.
- Nada de seed en `scores`: ni filas falsas ni cifras inventadas.

No hace falta regenerar `app/lib/supabase/database.types.ts`: el esquema no cambia.

## 4. Portada CSS (solo id nuevo)

`.cover-<id>` en `app/globals.css`, siguiendo `.cover-asteroids` / `.cover-rocas`: dibujada con CSS (gradientes y `::before`/`::after`), sin imágenes. Usa `/frontend-design` para el diseño y comprueba que se distingue de las demás tarjetas.

## 5. GamePlayer y leaderboard

No requieren cambios por juego: HUD HTML, PAUSA/FIN/JUGAR DE NUEVO, modal y `insert` en `scores` ya funcionan para cualquier `ENGINES[game.id]`. Detalle (`/games/<id>`), Salón de la Fama y Home leen las vistas de Supabase. Lo único que puede necesitar ajuste es la línea de controles (ver 0).

## 6. Assets

Sprites o sonidos del original → `public/games/<id>/`. No dejes rutas relativas al `references/`.
