import type { PomodoroMode } from '../../data/pomodoro.types';
import type { PomodoroRestanteStrategy } from './pomodoro-restante-strategy';
import { FocoPomodoroRestanteStrategy } from './foco-pomodoro-restante.strategy';
import { PausaPomodoroRestanteStrategy } from './pausa-pomodoro-restante.strategy';

const focoStrategy = new FocoPomodoroRestanteStrategy();
const pausaCurtaStrategy = new PausaPomodoroRestanteStrategy(
  (s) => (s.pomodoroPausaCurtaMin ?? 5) * 60,
);
const pausaLongaStrategy = new PausaPomodoroRestanteStrategy(
  (s) => (s.pomodoroPausaLongaMin ?? 15) * 60,
);

const byModo: Record<PomodoroMode, PomodoroRestanteStrategy> = {
  FOCO: focoStrategy,
  PAUSA_CURTA: pausaCurtaStrategy,
  PAUSA_LONGA: pausaLongaStrategy,
};

export function getPomodoroRestanteStrategy(modo: PomodoroMode): PomodoroRestanteStrategy {
  return byModo[modo];
}
