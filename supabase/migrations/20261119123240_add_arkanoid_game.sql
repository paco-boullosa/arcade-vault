-- SPEC 08: juego Arkanoid en el catálogo. Id nuevo; `bloque-buster` no se toca.

insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe la pared de bloques con la bola y no la dejes caer.',
  'Mueve la pala para que la bola rebote y rompa la pared de bloques de colores. Son cinco niveles con formas distintas (Rejilla, Pirámide, Tablero, Rombo y Franjas) y la bola va más rápida en cada uno. Desde el nivel 2, los bloques grises aguantan dos golpes. Empiezas con tres vidas, pierdes una cada vez que la bola cae y ganas una al completar cada nivel, hasta un máximo de cinco.',
  'ARCADE',
  'cover-arkanoid',
  'magenta',
  11
);
