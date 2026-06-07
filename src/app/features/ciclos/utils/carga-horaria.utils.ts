import {
  pisoMinutosPorContagemMaterias,
  SESSAO_MINIMA_MINUTOS,
  STEP_DISTRIBUICAO_MINUTOS,
} from '../constants/estudo-livre.constants';

export type MateriaHorasInput = {
  id: number;
  checked: boolean;
  peso?: number | null;
  /** Quando true, excluída da distribuição (ex.: Estudo Livre reservado pelo sistema). */
  excluirDaDistribuicao?: boolean;
};

export type MateriaHorasOutput = {
  id: number;
  horas: number;
  horasLabel: string;
};

export type CalculoHorasResult = {
  perMateria: MateriaHorasOutput[];
  /** Pool insuficiente para o piso mínimo dinâmico de todas as matérias activas. */
  warningMinimoNaoAtendido: boolean;
};

function minutosParaHorasLabel(minutos: number): string {
  const safe = Math.max(0, Math.round(minutos));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}:${String(m).padStart(2, '0')}h`;
}

function pesoEfetivo(m: MateriaHorasInput): number {
  const p = m.peso != null ? Number(m.peso) : 0;
  return p > 0 ? p : 1;
}

/**
 * Hamilton (maior resto) sobre unidades de {@code stepMinutos}.
 * Empate no resto: ordem da lista (primeira matéria na UI).
 */
function hamiltonMinutos(poolMinutos: number, weights: number[], stepMinutos: number): number[] {
  const n = weights.length;
  const totalUnits = Math.floor(poolMinutos / stepMinutos);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map(w => (totalUnits * w) / sumW);
  const units = exact.map(e => Math.floor(e));
  let leftover = totalUnits - units.reduce((a, b) => a + b, 0);

  const order = [...Array(n).keys()].sort((a, b) => {
    const fracA = exact[a] - units[a];
    const fracB = exact[b] - units[b];
    if (fracB !== fracA) return fracB - fracA;
    return a - b;
  });

  for (let k = 0; k < leftover; k++) {
    units[order[k]]++;
  }

  return units.map(u => u * stepMinutos);
}

function encontrarDoadorMinutos(
  minutos: number[],
  weights: number[],
  beneficiario: number,
  minDonorMinutos: number,
  step: number,
): number | null {
  const pesoBenef = weights[beneficiario];
  let donor: number | null = null;

  for (let j = 0; j < minutos.length; j++) {
    if (j === beneficiario || minutos[j] < minDonorMinutos + step) continue;
    if (weights[j] <= pesoBenef) continue;
    if (
      donor == null
      || weights[j] > weights[donor]
      || (weights[j] === weights[donor] && minutos[j] > minutos[donor])
    ) {
      donor = j;
    }
  }
  if (donor != null) return donor;

  for (let j = 0; j < minutos.length; j++) {
    if (j === beneficiario || minutos[j] < minDonorMinutos + step) continue;
    if (donor == null || minutos[j] > minutos[donor]) {
      donor = j;
    }
  }
  return donor;
}

/** Piso dinâmico: prioriza matérias de maior peso quando o pool é curto. */
function garantirMinimoMinutos(
  minutos: number[],
  weights: number[],
  minMinutos: number,
  step: number,
): void {
  const order = minutos
    .map((_, i) => i)
    .sort((a, b) => weights[b] - weights[a]);

  for (const i of order) {
    while (minutos[i] < minMinutos) {
      const donor = encontrarDoadorMinutos(minutos, weights, i, minMinutos, step);
      if (donor == null) break;
      minutos[donor] -= step;
      minutos[i] += step;
    }
  }
}

/** Matéria com peso maior não pode ficar com menos minutos que uma de peso menor. */
function garantirOrdemMinutosPorPeso(
  minutos: number[],
  weights: number[],
  minAbsolutoMinutos: number,
  step: number,
): void {
  const idx = minutos.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);

  for (let k = 0; k < idx.length - 1; k++) {
    const hi = idx[k];
    for (let m = k + 1; m < idx.length; m++) {
      const lo = idx[m];
      if (weights[hi] <= weights[lo]) continue;

      while (minutos[hi] < minutos[lo]) {
        if (minutos[lo] > minAbsolutoMinutos) {
          minutos[lo] -= step;
          minutos[hi] += step;
          continue;
        }
        const donor = encontrarDoadorMinutos(minutos, weights, hi, minAbsolutoMinutos, step);
        if (donor == null || donor === hi) break;
        minutos[donor] -= step;
        minutos[hi] += step;
      }
    }
  }
}

/**
 * Após o piso dinâmico, a matéria de maior peso pode empatar com outra de peso menor.
 * Transfere 1 bloco de 30 min da de menor peso para a de maior peso quando empata,
 * apenas se a de menor peso ainda puder ceder sem violar o piso absoluto.
 */
function garantirDiferencaMinimaEntrePesosDistintos(
  minutos: number[],
  weights: number[],
  minAbsolutoMinutos: number,
  step: number,
): void {
  const maxWeight = Math.max(...weights);
  const idx = minutos.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);

  for (let k = 0; k < idx.length - 1; k++) {
    const hi = idx[k];
    if (weights[hi] !== maxWeight) {
      continue;
    }
    for (let m = k + 1; m < idx.length; m++) {
      const lo = idx[m];
      if (weights[hi] <= weights[lo] || minutos[hi] !== minutos[lo]) {
        continue;
      }
      if (minutos[lo] > minAbsolutoMinutos) {
        minutos[lo] -= step;
        minutos[hi] += step;
      }
    }
  }
}

/** Distribui o pool em passos de 30 min: Hamilton + piso dinâmico + ordem por peso. */
export function distribuirMinutosPorPeso(
  poolMinutos: number,
  weights: number[],
  stepMinutos: number = STEP_DISTRIBUICAO_MINUTOS,
): number[] {
  if (weights.length === 0 || poolMinutos <= 0) {
    return [];
  }

  const piso = pisoMinutosPorContagemMaterias(weights.length);
  const absMin = SESSAO_MINIMA_MINUTOS;

  const minutos = hamiltonMinutos(poolMinutos, weights, stepMinutos);
  garantirOrdemMinutosPorPeso(minutos, weights, absMin, stepMinutos);
  garantirMinimoMinutos(minutos, weights, piso, stepMinutos);
  garantirOrdemMinutosPorPeso(minutos, weights, absMin, stepMinutos);
  garantirDiferencaMinimaEntrePesosDistintos(minutos, weights, absMin, stepMinutos);

  return minutos;
}

/**
 * Distribui o pool semanal entre matérias activas:
 * 1) Hamilton proporcional ao peso (blocos de 30 min);
 * 2) Piso dinâmico: ≤5 matérias → 2:30h; 6 → 2:00h; ≥7 → 1:30h;
 * 3) Peso maior nunca fica com menos horas que peso menor.
 */
export function calcularHorasPorMateria(params: {
  cargaHorariaSemanal: number;
  materias: MateriaHorasInput[];
  stepMinutos?: number;
}): CalculoHorasResult {
  const weekly = Number(params.cargaHorariaSemanal) || 0;
  const stepMinutos = params.stepMinutos ?? STEP_DISTRIBUICAO_MINUTOS;

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

  const poolMinutos = Math.round(weekly * 60);
  const pisoMinutos = pisoMinutosPorContagemMaterias(active.length);
  const warningMinimoNaoAtendido = poolMinutos < active.length * pisoMinutos;

  if (poolMinutos <= 0) {
    return { perMateria: baseZero, warningMinimoNaoAtendido: true };
  }

  const weights = active.map(pesoEfetivo);
  const minutosArr = distribuirMinutosPorPeso(poolMinutos, weights, stepMinutos);

  const minutosPorId = new Map<number, number>();
  active.forEach((m, idx) => {
    minutosPorId.set(m.id, minutosArr[idx]);
  });

  const perMateria = materias.map(m => {
    if (!m.checked || m.excluirDaDistribuicao) {
      return { id: m.id, horas: 0, horasLabel: '0:00h' };
    }
    const minutosTotais = minutosPorId.get(m.id) ?? 0;
    return { id: m.id, horas: minutosTotais / 60, horasLabel: minutosParaHorasLabel(minutosTotais) };
  });

  return { perMateria, warningMinimoNaoAtendido };
}
