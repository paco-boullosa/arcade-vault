-- SPEC 12: categoría LABERINTO en el catálogo.

alter table public.games drop constraint games_cat_check;
alter table public.games
  add constraint games_cat_check
  check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS', 'LABERINTO'));
