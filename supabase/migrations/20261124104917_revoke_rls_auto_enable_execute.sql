-- La función la creó la plataforma (event trigger `ensure_rls`, activa RLS en
-- tablas nuevas de `public`). Es SECURITY DEFINER y no debe poder llamarse desde
-- la API (`/rest/v1/rpc/rls_auto_enable`). Se revoca también de PUBLIC porque
-- anon y authenticated heredan de ahí el EXECUTE.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
