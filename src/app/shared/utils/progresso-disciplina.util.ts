/**
 * Normalização de progresso por disciplina (mesma lógica usada em Estudar Agora).
 * Compatível com payloads variados do backend (minutosFeitos, percentual, etc.).
 */

export function lerNumeroFlexivel(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(raw)) {
    const parts = raw.split(':').map(Number);
    if (parts.length === 2) {
      const [h, m] = parts;
      return h * 60 + m;
    }
    const [h, m, s] = parts;
    return h * 60 + m + s / 60;
  }

  const normalized = raw.replace('%', '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return value < 10 && value > 0 ? `${value.toFixed(1)}%` : `${Math.round(value)}%`;
}

export function normalizarNomeDisciplina(nome: string): string {
  return String(nome ?? '').trim().toLowerCase();
}

/**
 * @param getMetaDaDisciplina — minutos planejados da matéria quando `minutosMeta` não vier no DTO.
 */
export function normalizarPercentualProgresso(
  p: { disciplinaNome: string },
  getMetaDaDisciplina: (nome: string) => number,
): number {
  const obj = p as unknown as Record<string, unknown>;
  const feitos =
    lerNumeroFlexivel(obj['minutosFeitos']) ??
    lerNumeroFlexivel(obj['minutosEstudados']) ??
    lerNumeroFlexivel(obj['minFeitos']) ??
    lerNumeroFlexivel(obj['feitoMin']) ??
    0;
  const metaDto =
    lerNumeroFlexivel(obj['minutosMeta']) ??
    lerNumeroFlexivel(obj['metaMinutos']) ??
    lerNumeroFlexivel(obj['minMeta']) ??
    lerNumeroFlexivel(obj['metaMin']) ??
    0;
  const meta = metaDto > 0 ? metaDto : getMetaDaDisciplina(p.disciplinaNome);
  const percentualRaw =
    lerNumeroFlexivel(obj['percentual']) ??
    lerNumeroFlexivel(obj['percent']) ??
    lerNumeroFlexivel(obj['porcentagem']) ??
    lerNumeroFlexivel(obj['percentualConcluido']) ??
    lerNumeroFlexivel(obj['progressoPercentual']) ??
    0;

  const percentualCalculado = meta > 0 ? (Math.max(0, feitos) / Math.max(0, meta)) * 100 : 0;
  let percentual = percentualCalculado;

  if ((!Number.isFinite(percentual) || percentual <= 0) && Number.isFinite(percentualRaw) && percentualRaw > 0) {
    percentual = percentualRaw > 0 && percentualRaw <= 1 ? percentualRaw * 100 : percentualRaw;
  }

  const clamped = Math.max(0, Math.min(100, percentual));
  return clamped < 10 ? Math.round(clamped * 10) / 10 : Math.round(clamped);
}
