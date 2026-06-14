export type ConcursoCatalogoDto = {
  id: number;
  nome: string;
  escopo: 'NACIONAL' | 'ESTADUAL';
  uf?: string | null;
};

export type CargoCatalogoDto = {
  id: number;
  nome: string;
};

export type DisciplinaCatalogoDto = {
  id: number;
  nome: string;
  peso: number;
  estudoLivre: boolean;
};

export type TopicoNodeDto = {
  id: number;
  titulo: string;
  ordem: number;
  children?: TopicoNodeDto[];
};

export type ConcursoUpsertRequest = {
  nome: string;
  escopo: 'NACIONAL' | 'ESTADUAL';
  uf?: string | null;
};

export type CargoUpsertRequest = {
  nome: string;
};

export type DisciplinaUpsertRequest = {
  nome: string;
  peso: number;
};

export type TopicoUpsertRequest = {
  titulo: string;
  ordem: number;
  parentId?: number | null;
  ativo?: boolean | null;
};

export type CatalogoFormKind = 'concurso' | 'cargo' | 'disciplina' | 'topico';

export type CatalogoDeleteTarget =
  | { kind: 'concurso'; id: number; label: string }
  | { kind: 'cargo'; id: number; label: string }
  | { kind: 'disciplina'; id: number; label: string }
  | { kind: 'topico'; id: number; label: string };
