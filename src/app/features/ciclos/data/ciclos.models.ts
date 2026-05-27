export type ConcursoDto = {
  id: number;
  nome: string;
  /** Presente quando a API retorna o cadastro completo (filtro por região). */
  escopo?: 'NACIONAL' | 'ESTADUAL';
  uf?: string | null;
  banca?: string;
  dataProva?: string; // ISO yyyy-MM-dd
};

export type DisciplinaDto = {
  id: number;
  nome: string;
  tempoMinutos: number;
  // campos do layout (podem começar default)
  checked: boolean;
  completouEdital: boolean;
  peso: number | null;
  nivel: number;         // 0..5
  horasLabel: string;    // ex: "0:00h"
};

export type CargoDto = {
  id: number;
  nome: string;
};


export type CicloCreateRequest = {
  ownerId: number;
  nome: string;
  cargaHorariaSemanal: number;
  ativo: boolean;
  concursoId: number; // se seu backend usa
  cargoId: number; 

  pomodoroAtivo?: boolean;
  // opcional (se usar configs)
  pomodoroFocoMin?: number;
  pomodoroPausaCurtaMin?: number;
  pomodoroPausaLongaMin?: number;
  pomodoroLongaACada?: number;
};


export type CicloItemDto = {
  id: number;
  ordem: number;
  tempoMinutos: number;
  disciplinaId: number;
  disciplinaNome: string;
};

export type CicloDto = {
  id: number;
  nome: string;
  cargaHorariaSemanal: number;
  ativo: boolean;
  cargoId: number;
  cargoNome: string;
  /** Presente quando a API devolve o ciclo completo (lista/detalhe). */
  concursoId?: number;
  /** Execuções já encerradas (voltas completas anteriores). */
  voltasCompletas?: number;
  /** 0–100: blocos da rodada com sessão / total de blocos; ausente sem execução aplicável. */
  progressoRodadaPercentual?: number | null;
  itens: CicloItemDto[];
};

export type ProximaSessaoDto = {
  id: number;
  nome: string;
  cargaHorariaSemanal: number;
  ativo: boolean;
  cargoId: number;
  cargoNome: string;
  itens: CicloItemDto[];
};

export interface DisciplinaEditDto {
  id: number;
  nome: string;
  checked: boolean;
  completouEdital: boolean;
  peso: number | null;
  nivel: number;
}

export interface CicloEditResponseDto {
  cicloId: number;
  nome: string;
  cargaHorariaSemanal: number;
  ativo: boolean;
  cargoId: number;
  cargoNome: string;
  pomodoroAtivo?: boolean;
  pomodoroFocoMin?: number;
  pomodoroPausaCurtaMin?: number;
  pomodoroPausaLongaMin?: number;
  pomodoroLongaACada?: number;
  disciplinas: DisciplinaEditDto[];
}

/** PUT /api/ciclo/:id — alinhado ao CicloUpdateRequest do backend */
export type CicloItemUpdateRequest = {
  idDisciplina: number;
  checked?: boolean;
  completouEdital?: boolean;
  nivel?: number;
  peso?: number | null;
};

export type CicloUpdateRequest = {
  nome?: string;
  cargaHorariaSemanal?: number;
  ativo?: boolean;
  pomodoroAtivo?: boolean;
  pomodoroFocoMin?: number;
  pomodoroPausaCurtaMin?: number;
  pomodoroPausaLongaMin?: number;
  pomodoroLongaACada?: number;
  itens: CicloItemUpdateRequest[];
};
