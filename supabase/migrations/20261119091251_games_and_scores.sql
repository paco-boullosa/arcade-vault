-- SPEC 06: tablas games y scores, índices, RLS, vistas y seed del catálogo.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  sort_order integer not null unique
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games (id),
  player_name text not null
    check (char_length(player_name) between 1 and 16 and player_name = btrim(player_name)),
  score       integer not null check (score between 0 and 9999999),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index scores_created_at_idx on public.scores (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "scores_select_public"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "scores_insert_public"
  on public.scores for insert
  to anon, authenticated
  with check (true);

-- Privilegios mínimos para los roles de la API.
revoke all on public.games from anon, authenticated;
grant select on public.games to anon, authenticated;

revoke all on public.scores from anon, authenticated;
grant select, insert on public.scores to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vistas (security_invoker: aplican la RLS de scores)
-- ---------------------------------------------------------------------------

-- games.* + mejor puntuación (0 si no hay) + recuento de puntuaciones guardadas.
create view public.games_with_stats
  with (security_invoker = true) as
  select
    g.id,
    g.title,
    g.short,
    g.long,
    g.cat,
    g.cover,
    g.color,
    g.sort_order,
    coalesce(max(s.score), 0)::integer as best,
    count(s.id)::integer               as plays
  from public.games g
  left join public.scores s on s.game_id = g.id
  group by g.id;

-- Mejor puntuación de cada jugador en cada juego (empates: gana la más antigua).
create view public.game_best_scores
  with (security_invoker = true) as
  select distinct on (game_id, player_name)
    game_id,
    player_name,
    score,
    created_at
  from public.scores
  order by game_id, player_name, score desc, created_at asc;

-- Mejor puntuación individual de cada jugador en cualquier juego.
create view public.top_players
  with (security_invoker = true) as
  select
    player_name,
    max(score)::integer as score
  from public.scores
  group by player_name;

revoke all on public.games_with_stats from anon, authenticated;
revoke all on public.game_best_scores from anon, authenticated;
revoke all on public.top_players from anon, authenticated;

grant select on public.games_with_stats to anon, authenticated;
grant select on public.game_best_scores to anon, authenticated;
grant select on public.top_players to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed del catálogo (9 juegos, mismo orden que app/data/games.ts)
-- ---------------------------------------------------------------------------

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('bloque-buster', 'BLOQUE BUSTER',
   'Rebota la pelota y destruye muros de neón.',
   'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
   'ARCADE', 'cover-bricks', 'cyan', 1),
  ('caida', 'CAÍDA',
   'Encaja las piezas antes de que el techo te aplaste.',
   'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
   'PUZZLE', 'cover-tetro', 'magenta', 2),
  ('serpentina', 'SERPENTINA',
   'Crece sin morder tu propia cola.',
   'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
   'ARCADE', 'cover-snake', 'green', 3),
  ('gloton', 'GLOTÓN',
   'Devora puntos y escapa de los fantasmas.',
   'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
   'ARCADE', 'cover-glot', 'yellow', 4),
  ('invasores', 'INVASORES',
   'Defiende el planeta de filas alienígenas.',
   'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
   'SHOOTER', 'cover-invaders', 'green', 5),
  ('rocas', 'ROCAS',
   'Pulveriza asteroides en gravedad cero.',
   'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
   'SHOOTER', 'cover-rocas', 'yellow', 6),
  ('ranaria', 'RANARIA',
   'Cruza la autopista de pixeles.',
   'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
   'ARCADE', 'cover-rana', 'green', 7),
  ('duelo-pixel', 'DUELO PIXEL',
   'Dos paletas. Una pelota. Reflejos máximos.',
   'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
   'VERSUS', 'cover-duelo', 'cyan', 8),
  ('asteroids', 'ASTEROIDES',
   'Esquiva, dispara y parte rocas en un vacío sin bordes.',
   'Rota, propulsa y dispara para partir cada roca en fragmentos más pequeños. Tienes 3 vidas, un escudo temporal por vida y, en cada nivel, un ítem de Disparo Triple que puede aparecer. Cada oleada trae más rocas que la anterior.',
   'SHOOTER', 'cover-asteroids', 'cyan', 9);
