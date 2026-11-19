# Verificación

Haz todo esto antes de marcar criterios como cumplidos. Informa con franqueza de lo que falle o no hayas podido comprobar.

## 1. Comandos

```bash
npm run lint
npx tsc --noEmit
npm run build   # necesita NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local)
```

## 2. Supabase (MCP `mcp__supabase__*`)

- `list_migrations`: la migración nueva figura como aplicada (si hay).
- `execute_sql`: `select id, sort_order from public.games order by sort_order;` incluye el juego y los `sort_order` no se repiten.
- `get_advisors` (seguridad): sin errores nuevos sobre `games`, `scores` ni las vistas.
- No uses `service_role` ni la contraseña de BD en código ni en el diff.

## 3. Navegador (Playwright MCP o Chrome MCP; `npm run dev`)

1. `/games`: aparece el número esperado de tarjetas y la del juego tiene su portada.
2. `/games/<id>/play`: canvas con el estado inicial de la spec, sin `.game-arena`, ambos HUD a cero. Comprueba la consola.
3. Juega: las teclas hacen lo esperado, la puntuación sube con las cifras exactas de la spec y ambos HUD coinciden.
4. PAUSA/REANUDAR con el botón y con `P`; con el juego en pausa nada se mueve.
5. Llega al fin de partida y también prueba FIN: GAME OVER en el canvas y modal con la misma puntuación.
6. Reinicia con la tecla del juego (foco fuera del modal) y con JUGAR DE NUEVO.
7. En el modal escribe un nombre con espacios: la tecla de juego no debe actuar.
8. Guarda la puntuación; comprueba `/games/<id>` (`#01`, Partidas, Mejor global), `/hall-of-fame` (pestaña del juego) y `/` (actividad).
9. Navega fuera y vuelve: velocidad normal y una sola acción por pulsación (sin bucles ni listeners duplicados).
10. A 375 px: sin scroll horizontal y canvas sin deformar.
11. `/games/rocas/play` (u otro juego simulado) sigue igual y sin botón de guardar.

## 4. Limpieza

- Borra de `scores` las filas de prueba (`execute_sql`: `delete from public.scores where player_name = '<nombre de prueba>' and game_id = '<id>';`) y comprueba que no queda ninguna. Pide confirmación al usuario si no estás seguro de que sean tuyas.
- `git diff`: sin claves, sin `console.log`, sin código muerto ni archivos temporales.
- Si el repo usa un hook de Prettier/ESLint tras editar, déjalo pasar.
