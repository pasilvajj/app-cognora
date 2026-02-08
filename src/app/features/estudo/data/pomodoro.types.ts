export type PomodoroMode = 'FOCO' | 'PAUSA_CURTA' | 'PAUSA_LONGA';

export interface PomodoroConfig {
  focoMin: number;
  pausaCurtaMin: number;
  pausaLongaMin: number;
  longaACada: number;
}