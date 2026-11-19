// Recuento de partidas abreviado: 0, 999, 12.4K, 1.2M.
export function formatPlays(n: number): string {
  if (n < 1000) return String(n);

  const k = Math.round(n / 100) / 10;
  if (k < 1000) return `${k.toFixed(1)}K`;

  const m = Math.round(n / 100_000) / 10;
  return `${m.toFixed(1)}M`;
}

// Tiempo relativo en español: "hace un momento", "hace 2 min", "hace 3 h"...
// Se llama en servidor (tras leer los datos) para no provocar desajustes de
// hidratación.
export function timeAgo(date: string | Date, now: number = Date.now()): string {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(date).getTime()) / 1000),
  );

  if (seconds < 60) return "hace un momento";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} ${months === 1 ? "mes" : "meses"}`;

  const years = Math.floor(days / 365);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}

// "DD/MM/YYYY" en es-ES. Se usa en servidor y en cliente con la misma zona
// horaria fija, para no provocar desajustes de hidratación.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}
