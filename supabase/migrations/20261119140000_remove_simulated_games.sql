-- Elimina del catálogo los juegos simulados bloque-buster, caida, serpentina y rocas.
-- Ninguno tenía puntuaciones; se borran por si acaso antes que las filas de games (FK).
delete from public.scores where game_id in ('bloque-buster', 'caida', 'serpentina', 'rocas');
delete from public.games where id in ('bloque-buster', 'caida', 'serpentina', 'rocas');
