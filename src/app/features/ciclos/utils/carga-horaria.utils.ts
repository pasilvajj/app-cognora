export type MateriaHorasInput = {
  id: number;
  checked: boolean;
  peso?: number | null;
};

export type MateriaHorasOutput = {
  id: number;
  horas: number;      // em horas (ex.: 3.5)
  horasLabel: string; // ex.: "3:30h"
};

export type CalculoHorasResult = {
  perMateria: MateriaHorasOutput[];
  warningMinimoNaoAtendido: boolean;
};

function roundToHalfHour(hours: number): number {
  return Math.round(hours * 2) / 2; // passos de 0.5h
}

function toHoursLabel(hours: number): string {
  const safe = Math.max(0, hours);
  const h = Math.floor(safe);
  const m = Math.round((safe - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}h`;
}

export function calcularHorasPorMateria(params: {
  cargaHorariaSemanal: number;
  materias: MateriaHorasInput[];
  minHorasPorMateria?: number;   // default = 2
  stepHoras?: number;            // default = 0.5 (30min)
}): CalculoHorasResult {
  const weekly = Number(params.cargaHorariaSemanal) || 0;
  const minEach = params.minHorasPorMateria ?? 2;

  // Nota: stepHoras está aqui para evolução futura;
  // neste código mantemos arredondamento 0.5h, como combinado.
  // Se quiser generalizar o step, eu ajusto.
  void params.stepHoras;

  const materias = params.materias ?? [];
  const active = materias.filter(m => !!m.checked);

  // base: tudo zero
  const baseZero: MateriaHorasOutput[] = materias.map(m => ({
    id: m.id,
    horas: 0,
    horasLabel: '0:00h',
  }));

  if (active.length === 0 || weekly <= 0) {
    return { perMateria: baseZero, warningMinimoNaoAtendido: false };
  }

  const n = active.length;
  const minTotal = n * minEach;

  // se não dá para cumprir mínimo
  if (weekly < minTotal) {
    const each = roundToHalfHour(weekly / n);
    const perMateria = materias.map(m => {
      if (!m.checked) return { id: m.id, horas: 0, horasLabel: '0:00h' };
      return { id: m.id, horas: each, horasLabel: toHoursLabel(each) };
    });

    return { perMateria, warningMinimoNaoAtendido: true };
  }

  const resto = weekly - minTotal;

  const weights = active.map(m => (m.peso && m.peso > 0 ? Number(m.peso) : 1));
  const sumW = weights.reduce((a, b) => a + b, 0);

  const rawActive = active.map((m, idx) => minEach + (resto * weights[idx]) / sumW);
  const roundedActive = rawActive.map(h => roundToHalfHour(h));

  // ajuste para bater o total semanal após arredondar
  let totalRounded = roundedActive.reduce((a, b) => a + b, 0);
  let diff = roundToHalfHour(weekly - totalRounded);

  // ordem de ajuste: maior peso primeiro
  const order = active
    .map((m, i) => ({ i, w: weights[i], h: rawActive[i] }))
    .sort((a, b) => (b.w - a.w) || (b.h - a.h));

  while (Math.abs(diff) >= 0.5) {
    const step = diff > 0 ? 0.5 : -0.5;

    let applied = false;
    for (const o of order) {
      const i = o.i;
      const next = roundedActive[i] + step;
      if (next >= minEach) {
        roundedActive[i] = next;
        diff = roundToHalfHour(diff - step);
        applied = true;
        break;
      }
    }
    if (!applied) break;
  }

  // monta resultado final alinhando ids
  const activeMap = new Map<number, number>();
  active.forEach((m, idx) => activeMap.set(m.id, roundedActive[idx]));

  const perMateria = materias.map(m => {
    if (!m.checked) return { id: m.id, horas: 0, horasLabel: '0:00h' };
    const horas = activeMap.get(m.id) ?? 0;
    return { id: m.id, horas, horasLabel: toHoursLabel(horas) };
  });

  return { perMateria, warningMinimoNaoAtendido: false };
}
