export type ItemPlanejadoDto = {
  cicloItemId: number | null;
  disciplinaId: number;
  disciplinaNome: string;
  duracaoSeg: number;
  corTag?: string; // ex: "c-azul"
  concluida: boolean;
  editavel: boolean;
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
  concluida: boolean;
  editavel: boolean;
};

export type ResumoPlanejamentoDto = {
  diaMaisLeve: string;     // "Dom"
  diaMaisPesado: string;   // "Seg"
};

export type ImpactoTempoDisciplinaDto = {
  disciplinaId: number;
  disciplinaNome: string;
  tempoAtualSeg: number;
  tempoPlanejadoSeg: number;
  concluida: boolean;
  semHorasPlanejadas: boolean;
  alteracaoSugerida: boolean;
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
  impactoTempos: ImpactoTempoDisciplinaDto[];
};

/** Payload para salvar a organização feita pelo usuário (arrastar). */
export type ItemPersonalizadoReq = {
  cicloItemId: number | null;
  disciplinaId: number;
  duracaoSeg: number;
};

export type DiaPersonalizadoReq = {
  data: string;            // "YYYY-MM-DD"
  itens: ItemPersonalizadoReq[];
};

export type PlanejamentoPersonalizadoReq = {
  weekStart: string;       // "YYYY-MM-DD"
  dias: DiaPersonalizadoReq[];
};
