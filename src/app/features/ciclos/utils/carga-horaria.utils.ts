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
  /** Pool insuficiente para o mínimo de 1:30h em todas as matérias ativas. */
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

function alocarPorMaiorResto(total: number, exact: number[], weights: number[]): number[] {
  const blocks = exact.map(v => Math.floor(v));
  let leftover = total - blocks.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, frac: exact[i] - blocks[i], w }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w);

  for (let k = 0; k < leftover; k++) {
    blocks[order[k].i]++;
  }
  return blocks;
}

/** Sobra do pool (ex.: 30 min) vai inteira para a matéria de maior peso. */
function indiceMaiorPeso(weights: number[]): number {
  let best = 0;
  for (let i = 1; i < weights.length; i++) {
    if (weights[i] > weights[best]) {
      best = i;
    }
  }
  return best;
}

function aplicarRestoMinutos(resto: number, weights: number[]): number[] {
  const extra = weights.map(() => 0);
  if (resto > 0 && weights.length > 0) {
    extra[indiceMaiorPeso(weights)] = resto;
  }
  return extra;
}

/**
 * Ao garantir 1 sessão mínima, tira blocos de matérias mais leves (ou, se necessário,
 * da mais pesada), preservando matérias de peso alto como Português e Trânsito.
 */
function encontrarDoadorMinimo(
  blocks: number[],
  weights: number[],
  beneficiario: number,
  minBlocks: number,
): number | null {
  const pesoBenef = weights[beneficiario];

  let donor: number | null = null;
  for (let j = 0; j < blocks.length; j++) {
    if (j === beneficiario || blocks[j] <= minBlocks) continue;
    if (weights[j] > pesoBenef) continue;
    if (donor == null || weights[j] < weights[donor]) {
      donor = j;
    } else if (weights[j] === weights[donor] && blocks[j] > blocks[donor]) {
      donor = j;
    }
  }
  if (donor != null) return donor;

  for (let j = 0; j < blocks.length; j++) {
    if (j === beneficiario || blocks[j] <= minBlocks) continue;
    if (donor == null || weights[j] > weights[donor]) {
      donor = j;
    } else if (weights[j] === weights[donor] && blocks[j] > blocks[donor]) {
      donor = j;
    }
  }
  return donor;
}

function garantirMinimoBlocos(blocks: number[], weights: number[], minBlocks: number): void {
  const order = blocks
    .map((_, i) => i)
    .sort((a, b) => weights[b] - weights[a]);

  for (const i of order) {
    while (blocks[i] < minBlocks) {
      const donor = encontrarDoadorMinimo(blocks, weights, i, minBlocks);
      if (donor == null) break;
      blocks[donor]--;
      blocks[i]++;
    }
  }
}

function encontrarDoadorOrdem(
  blocks: number[],
  weights: number[],
  beneficiario: number,
  minBlocks: number,
): number | null {
  const pesoBenef = weights[beneficiario];
  let donor: number | null = null;

  for (let j = 0; j < blocks.length; j++) {
    if (j === beneficiario || blocks[j] <= minBlocks) continue;
    if (weights[j] >= pesoBenef) continue;
    if (donor == null || weights[j] < weights[donor]) {
      donor = j;
    } else if (weights[j] === weights[donor] && blocks[j] > blocks[donor]) {
      donor = j;
    }
  }
  if (donor != null) return donor;

  for (let j = 0; j < blocks.length; j++) {
    if (j === beneficiario || blocks[j] <= minBlocks) continue;
    if (donor == null || weights[j] > weights[donor]) {
      donor = j;
    }
  }
  return donor;
}

/** Matéria com peso maior não pode ficar com menos sessões que uma de peso menor. */
function garantirOrdemPorPeso(blocks: number[], weights: number[], minBlocks: number): void {
  const idx = blocks.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);

  for (let k = 0; k < idx.length - 1; k++) {
    const hi = idx[k];
    for (let m = k + 1; m < idx.length; m++) {
      const lo = idx[m];
      if (weights[hi] <= weights[lo]) continue;

      while (blocks[hi] < blocks[lo]) {
        if (blocks[lo] > minBlocks) {
          blocks[lo]--;
          blocks[hi]++;
          continue;
        }
        const donor = encontrarDoadorOrdem(blocks, weights, hi, minBlocks);
        if (donor == null || donor === hi) break;
        blocks[donor]--;
        blocks[hi]++;
      }
    }
  }
}

/** Distribui o total de sessões proporcionalmente ao peso (Hamilton sobre o pool inteiro). */
function calcularBlocosPorPeso(totalBlocos: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const sumW = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map(w => (totalBlocos * w) / sumW);
  const blocks = alocarPorMaiorResto(totalBlocos, exact, weights);

  garantirMinimoBlocos(blocks, weights, 1);
  garantirOrdemPorPeso(blocks, weights, 1);

  return blocks;
}

/**
 * Distribui o pool semanal entre matérias ativas:
 * 1) Garante {@code minHorasPorMateria} (default 1:30h = 1 sessão) por matéria;
 * 2) Distribui sessões proporcionalmente ao peso sobre o pool total;
 * 3) Horas exibidas em blocos de 30 min; sobra do pool vai para a matéria de maior peso.
 */
export function calcularHorasPorMateria(params: {
  cargaHorariaSemanal: number;
  materias: MateriaHorasInput[];
  minHorasPorMateria?: number;
  stepHoras?: number;
}): CalculoHorasResult {
  const weekly = Number(params.cargaHorariaSemanal) || 0;
  const minEach = params.minHorasPorMateria ?? 1.5;
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

  const blocoMinutos = minEach * 60;
  const poolMinutos = Math.round(weekly * 60);
  const totalBlocos = Math.floor(poolMinutos / blocoMinutos);
  const restoMinutos = poolMinutos - totalBlocos * blocoMinutos;
  const warningMinimoNaoAtendido = totalBlocos < active.length;
  if (totalBlocos <= 0) {
    return { perMateria: baseZero, warningMinimoNaoAtendido: true };
  }

  const weights = active.map(pesoEfetivo);
  const blocks = calcularBlocosPorPeso(totalBlocos, weights);
  const extraMinutos = aplicarRestoMinutos(restoMinutos, weights);

  const minutosPorId = new Map<number, number>();
  active.forEach((m, idx) => {
    minutosPorId.set(m.id, blocks[idx] * blocoMinutos + extraMinutos[idx]);
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
