-- Game jam HORIZONTE (variante A): shoot'em up de scroll lateral en el catálogo. Id nuevo.

insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'horizonte',
  'HORIZONTE',
  'Vuela por la caverna, derriba oleadas y revienta la puerta de cada sector.',
  'Pilota una nave por una caverna que avanza sin parar: el techo y el suelo matan al tocarlos. Derriba Dardos, Enjambres, Torretas y Boyas, y destruye la puerta del final de cada sector para seguir: cada sector es más rápido y estrecho. Tienes 3 vidas y ganas una cada 10.000 puntos.',
  'SHOOTER',
  'cover-horizonte',
  'cyan',
  14
);
