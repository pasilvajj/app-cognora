/** Alinhado a `EditalTopicoEstadoItemDto` (Jackson ISO-8601 para instantes). */
export type EditalTopicoEstadoItemDto = {
  topicoId: number;
  concluido: boolean;
  ultimaInteracaoEm: string | null;
  ultimoEstudoEm: string | null;
};

export type EditalTopicoEstadoResponseDto = {
  itens: EditalTopicoEstadoItemDto[];
};

export type EditalTopicoEstadoUpdateRequest = {
  concluido: boolean;
};
