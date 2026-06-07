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

import type { EditalTopicoEstadoResponseDto } from './edital-topico-estado.models';

export type EditalVerticalConcursoDto = {
  id: number;
  nome: string;
  cargos: EditalVerticalCargoDto[];
  /** Incluído quando {@code cicloId} é enviado no GET (evita 2.º request na carga). */
  estadoTopico?: EditalTopicoEstadoResponseDto | null;
};
