import type { SessaoDetalheDto } from '../../data/estudo.models';
import type { PomodoroRestanteStrategy } from './pomodoro-restante-strategy';

/**
 * FOCO — deriva de estudadoTotalSeg; pomodoroRestanteSeg do servidor é ignorado.
 */
export class FocoPomodoroRestanteStrategy implements PomodoroRestanteStrategy {
  correctRemainingFromServer(s: SessaoDetalheDto): number {
    const estudadoSeg = s.estudadoTotalSeg ?? 0;
    const focoSeg = (s.pomodoroFocoMin ?? 25) * 60;
    const cycleStudied = estudadoSeg % focoSeg;
    return Math.max(0, focoSeg - cycleStudied);
  }

  remainingFromEtapaInicio(_s: SessaoDetalheDto): number | null {
    return null;
  }
}
