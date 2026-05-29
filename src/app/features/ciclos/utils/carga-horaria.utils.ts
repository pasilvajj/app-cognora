export type MateriaHorasInput = {
  id: number;
  checked: boolean;
  peso?: number | null;
  /** Quando true, excluída da distribuição (ex.: Estudo Livre reservado pelo sistema). */
  excluirDaDistribuicao?: boolean;
};

export type MateriaHorasOutput = {
  id: number;
  horas: number;      // em horas (ex.: 3.5)
  horasLabel: string; // ex.: "3:30h"
};

export type CalculoHorasResult = {
  perMateria: MateriaHorasOutput[];
  /** Alguma matéria ficou abaixo de minHorasPorMateria (aviso, não bloqueia salvamento). */
  warningMinimoNaoAtendido: boolean;
};

function roundToHalfHour(hours: number): number {
  return Math.round(hours * 2) / 2;
}

function toHoursLabel(hours: number): string {
  const safe = Math.max(0, hours);
  const h = Math.floor(safe);
  const m = Math.round((safe - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}h`;
}

function pesoEfetivo(m: MateriaHorasInput): number {
  const p = m.peso != null ? Number(m.peso) : 0;
  return p > 0 ? p : 1;
}

/**
 * Distribui o pool semanal entre matérias ativas **proporcionalmente ao peso**.
 * O total exibido bate com `cargaHorariaSemanal` (passos de 0,5h; sobras vão para maior peso).
 */
export function calcularHorasPorMateria(params: {
  cargaHorariaSemanal: number;
  materias: MateriaHorasInput[];
  minHorasPorMateria?: number;
  stepHoras?: number;
}): CalculoHorasResult {
  const weekly = Number(params.cargaHorariaSemanal) || 0;
  const minEachSoft = params.minHorasPorMateria ?? 2;
  void params.stepHoras;

  const materias = params.materias ?? [];
  const active = materias.filter(m => !!m.checked && !m.excluirDaDistribuicao);

  const baseZero: MateriaHorasOutput[] = materias.map(m => ({
    id: m.id,
    horas: 0,
    horasLabel: '0:00h',
  }));

  if (active.length === 0 || weekly <= 0) {
    return { perMateria: baseZero, warningMinimoNaoAtendido: false };
  }

  const weights = active.map(pesoEfetivo);
  const sumW = weights.reduce((a, b) => a + b, 0);

  const rawActive = active.map((_, idx) => (weekly * weights[idx]) / sumW);
  const roundedActive = rawActive.map(h => roundToHalfHour(h));

  let diff = roundToHalfHour(weekly - roundedActive.reduce((a, b) => a + b, 0));
  const order = active
    .map((m, i) => ({ i, w: weights[i] }))
    .sort((a, b) => b.w - a.w);

  const minFloor = 0.5;

  while (Math.abs(diff) >= 0.5) {
    const step = diff > 0 ? 0.5 : -0.5;
    let applied = false;
    for (const o of order) {
      const i = o.i;
      const next = roundedActive[i] + step;
      if (next >= minFloor) {
        roundedActive[i] = next;
        diff = roundToHalfHour(diff - step);
        applied = true;
        break;
      }
    }
    if (!applied) break;
  }

  const warningMinimoNaoAtendido = roundedActive.some(h => h < minEachSoft);

  const activeMap = new Map<number, number>();
  active.forEach((m, idx) => activeMap.set(m.id, roundedActive[idx]));

  const perMateria = materias.map(m => {
    if (!m.checked || m.excluirDaDistribuicao) {
      return { id: m.id, horas: 0, horasLabel: '0:00h' };
    }
    const horas = activeMap.get(m.id) ?? 0;
    return { id: m.id, horas, horasLabel: toHoursLabel(horas) };
  });

  return { perMateria, warningMinimoNaoAtendido };
}
