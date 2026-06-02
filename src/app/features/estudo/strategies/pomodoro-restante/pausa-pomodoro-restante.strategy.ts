import type { SessaoDetalheDto } from '../../data/estudo.models';
import type { PomodoroRestanteStrategy } from './pomodoro-restante-strategy';

export type DuracaoEtapaPausaFn = (s: SessaoDetalheDto) => number;

/**
 * PAUSA_CURTA / PAUSA_LONGA — compensação do floor() no servidor e derivada por pomodoroEtapaInicio.
 */
export class PausaPomodoroRestanteStrategy implements PomodoroRestanteStrategy {
  constructor(private readonly duracaoEtapaSegundos: DuracaoEtapaPausaFn) {}

  correctRemainingFromServer(s: SessaoDetalheDto): number {
    const restanteServ = s.pomodoroRestanteSeg ?? 0;
    if (restanteServ <= 0) return 0;
    const maxSeg = this.duracaoEtapaSegundos(s);
    return Math.min(Math.max(0, restanteServ), maxSeg);
  }

  remainingFromEtapaInicio(s: SessaoDetalheDto): number | null {
    if (!s.pomodoroEtapaInicio) return null;

    const inicioEtapaMs = Date.parse(s.pomodoroEtapaInicio);
    if (Number.isNaN(inicioEtapaMs)) return null;

    const fimRefMs = s.pausadoEm ? Date.parse(s.pausadoEm) : Date.now();
    if (Number.isNaN(fimRefMs) || fimRefMs <= inicioEtapaMs) return null;

    const duracaoSeg = this.duracaoEtapaSegundos(s);
    const elapsedSeg = Math.floor((fimRefMs - inicioEtapaMs) / 1000);
    return Math.max(0, duracaoSeg - elapsedSeg);
  }
}
