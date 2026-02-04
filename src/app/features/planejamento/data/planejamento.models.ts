export type ItemPlanejadoDto = {
  disciplinaId: number;
  disciplinaNome: string;
  duracaoSeg: number;
  corTag?: string; // ex: "c-azul"
};

export type DiaPlanejadoDto = {
  diaLabel: string;     // "Seg"
  data: string;         // "2026-04-22"
  totalDiaSeg: number;
  itens: ItemPlanejadoDto[];
};

export type DistribuicaoDisciplinaDto = {
  disciplinaId: number;
  disciplinaNome: string;
  totalSeg: number;
  corTag?: string;
};

export type ResumoPlanejamentoDto = {
  diaMaisLeve: string;     // "Dom"
  diaMaisPesado: string;   // "Seg"
};

export type PlanejamentoSemanalDto = {
  cicloId: number;
  cicloNome: string;
  weekStart: string;       // monday ISO "YYYY-MM-DD"
  weekEnd: string;         // sunday ISO "YYYY-MM-DD"
  totalSugeridoSeg: number;
  dias: DiaPlanejadoDto[];
  distribuicao: DistribuicaoDisciplinaDto[];
  resumo: ResumoPlanejamentoDto;
};