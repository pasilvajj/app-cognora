/**
 * DTOs de Configuração e Ciclo
 */
export interface ProximaSessaoDto {
  cicloId: number;
  cicloNome: string;
  cicloItemId: number;
  ordem: number;
  disciplinaId: number;
  disciplinaNome: string;
  tempoMinutos: number;
}

export interface ProgressoDisciplinaDto {
  disciplinaId: number;
  disciplinaNome: string;
  minutosFeitos: number;
  minutosMeta: number;
  percentual: number;
}

/**
 * Objetos de Requisição (Payloads)
 */
export interface IniciarSessaoRequest {
  usuarioId: number;
  cicloId: number;
  cicloItemId: number;
}

export interface FinalizarSessaoRequest {
  id: number;
  concluido: boolean;
  observacoes?: string;
}

export interface AtualizarObservacoesRequest {
  observacoes: string;
}

/**
 * Detalhes e Cards de Sessão
 */
export interface SessaoDetalheDto {
  id: number;
  cicloId: number;
  cicloNome: string;
  cicloItemId: number;
  ordem: number;
  disciplinaId: number;
  disciplinaNome: string;
  tempoMinutos: number;

  inicio: string;
  fim: string | null;
  pausadoEm: string | null;
  pausadoTotalSeg: number;
  estudadoTotalSeg: number;

  concluido: boolean | null;
  observacoes: string | null;

  // Configurações de Pomodoro
  pomodoroAtivo: boolean;
  pomodoroFocoMin: number;
  pomodoroPausaCurtaMin: number;
  pomodoroPausaLongaMin: number;
  pomodoroLongaACada: number;

  pomodoroModo: 'FOCO' | 'PAUSA_CURTA' | 'PAUSA_LONGA';
  pomodoroCicloIndex: number;
  pomodoroEtapaInicio: string | null;
  pomodoroRestanteSeg: number;
}

export interface SessaoCardDto {
  id: number;
  disciplinaNome: string;
  metaMinutos: number;
  inicio: string;
  fim: string | null;
  pausadoEm: string | null;
  pausadoTotalSeg: number;
  segundosEstudados: number;
  segundosRestantes: number;
  status: 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA';
  estudadoTotalSeg: number;
}

export interface SessaoResumoDto {
  id: number;
  disciplinaNome: string;
  inicio: string;
  fim: string;
  concluido: boolean;
  minutosEfetivos: number;
}
