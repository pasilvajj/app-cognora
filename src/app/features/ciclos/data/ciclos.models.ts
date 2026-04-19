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
  /** Execuções já encerradas (voltas completas anteriores). */
  voltasCompletas?: number;
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
   id: number;
   nome: string;
   cargaHorariaSemanal: number;
   ativo: boolean;
   cargoId: number;
   cargoNome: string;
   disciplinas: DisciplinaEditDto[];
}
