export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
/**
 * Retorna a segunda-feira da semana do date informado (base local do browser).
 * Se quiser forçar UTC, me avise que eu ajusto (mas para weekStart, local costuma ser OK).
 */
export function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom..6=Sáb
  const diff = (day === 0 ? -6 : 1) - day; // move para segunda
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}