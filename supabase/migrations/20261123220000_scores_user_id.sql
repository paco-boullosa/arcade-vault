alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null;

create index scores_user_id_idx on public.scores (user_id);

-- Cualquiera puede insertar, pero un user_id solo puede ser el propio.
drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_own_or_guest"
  on public.scores for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
