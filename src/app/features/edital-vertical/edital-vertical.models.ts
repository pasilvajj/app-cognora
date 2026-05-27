export type TopicoNodeDto = {
  id: number;
  titulo: string;
  ordem: number;
  children: TopicoNodeDto[];
};

export type EditalVerticalDisciplinaDto = {
  id: number;
  nome: string;
  topicos: TopicoNodeDto[];
};

export type EditalVerticalCargoDto = {
  id: number;
  nome: string;
  disciplinas: EditalVerticalDisciplinaDto[];
};

export type EditalVerticalConcursoDto = {
  id: number;
  nome: string;
  cargos: EditalVerticalCargoDto[];
};
