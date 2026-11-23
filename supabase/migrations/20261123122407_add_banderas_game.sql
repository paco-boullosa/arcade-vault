-- SPEC 12: juego BANDERAS en el catálogo. Id nuevo.

insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'banderas',
  'BANDERAS',
  'Conduce por un laberinto enorme, iza los ocho mástiles de cada ronda y esquiva a los vigías.',
  'Recorre un laberinto de 41×31 casillas que la cámara sigue con tu coche. Mantén el coche un segundo sobre cada mástil para izar su bandera, esquiva a los vigías que patrullan y te persiguen en línea recta si te ven, y completa los ocho mástiles de la ronda antes de que se acabe el tiempo de bonificación. Tienes 3 vidas y ganas una cada 5.000 puntos.',
  'LABERINTO',
  'cover-banderas',
  'green',
  (select coalesce(max(sort_order), 0) + 1 from public.games)
);
