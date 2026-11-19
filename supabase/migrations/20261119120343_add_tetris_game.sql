-- SPEC 07: juego Tetris en el catálogo. Id nuevo; `caida` no se toca.

insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'tetris',
  'TETRIS',
  'Encaja piezas, limpia líneas y encadena power-ups.',
  'Encaja las siete piezas en un tablero de 10×20 y limpia líneas para subir de nivel: la caída se acelera cada 10 líneas. Cada 5 líneas, la siguiente pieza trae un power-up (Bomba, Rayo, Tinte, Gravedad o Congelar). Juega en modo Clásico o supera cinco desafíos: Sprint 40, Marea de basura, Bloques fijos, Piezas fantasma y Rotación inversa. Cuatro skins para cambiar el aspecto del tablero.',
  'PUZZLE',
  'cover-tetris',
  'yellow',
  10
);
