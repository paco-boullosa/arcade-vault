-- SPEC 09: juego Snake en el catálogo. Id nuevo; `serpentina` no se toca.

insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'snake',
  'SNAKE',
  'Come frutas, crece y no choques: las paredes y tu cuerpo matan.',
  'Guía a la serpiente por una rejilla de 20×15 celdas y come las frutas que aparecen: cada una vale 10 puntos y te alarga una celda. Las paredes y tu propio cuerpo terminan la partida, así que planifica cada giro. Cada 5 frutas subes de nivel y la serpiente avanza más rápido. Si llenas toda la rejilla, ganas.',
  'ARCADE',
  'cover-snake-fruit',
  'yellow',
  12
);
