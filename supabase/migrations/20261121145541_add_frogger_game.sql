-- Game jam FROGGER (variante A): juego Frogger en el catálogo. Id nuevo; `ranaria` no se toca.

insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'frogger',
  'FROGGER',
  'Cruza la carretera y el río y llena las 5 casillas de meta.',
  'Salta casilla a casilla entre coches y camiones, súbete a troncos y tortugas (algunas se sumergen) y llena las 5 casillas de meta antes de que se acabe el tiempo. Tienes 3 vidas y la velocidad sube cada nivel.',
  'ARCADE',
  'cover-frogger',
  'green',
  13
);
