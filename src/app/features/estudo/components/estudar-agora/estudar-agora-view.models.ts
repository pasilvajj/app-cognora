export type EstudarAgoraProgressItem = {
  disciplina: string;
  disciplinaId?: number;
  percent: number;
};

export type EstudarAgoraObservacaoItem = {
  sessaoId: number;
  disciplina: string;
  observacao: string;
  dataIso: string;
  dataLabel: string;
};
