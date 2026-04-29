import type { SessaoDetalheDto } from '../../data/estudo.models';
import type { PomodoroMode } from '../../data/pomodoro.types';

/**
 * Família de algoritmos para o tempo restante do Pomodoro por etapa (Strategy).
 * @see https://refactoring.guru/design-patterns/strategy
 */
export interface PomodoroRestanteStrategy {
  correctRemainingFromServer(s: SessaoDetalheDto): number;
  remainingFromEtapaInicio(s: SessaoDetalheDto): number | null;
}
