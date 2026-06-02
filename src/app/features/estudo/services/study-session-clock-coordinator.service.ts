import { inject, Injectable } from '@angular/core';

import { PomodoroEngineService } from './pomodoro-engine-service';
import { SessionTimerService } from './session-timer-service';
import { alinharEpochAoSegundo } from './study-aligned-second-tick.service';

/**
 * Ponto único de ativação dos dois relógios (sessão + Pomodoro).
 *
 * Garantia: ambos recebem o MESMO `anchor` (epoch ms), eliminando qualquer
 * drift entre `baseAgoraMs` (sessão) e `endTime` (Pomodoro).
 */
@Injectable({ providedIn: 'root' })
export class StudySessionClockCoordinatorService {
  private readonly timer    = inject(SessionTimerService);
  private readonly pomodoro = inject(PomodoroEngineService);

  /**
   * Ativa os dois relógios com o mesmo instante de referência.
   *
   * Fluxo:
   * 1. `timer.startAt(anchor)` — registra sessão no tick
   * 2. Se Pomodoro habilitado:
   *    - já rodando (restore com rodando=true)  → `realinharAnchor(anchor)` — ajusta endTime sem reiniciar
   *    - parado                                 → `startAt(anchor)`         — inicia a partir do anchor
   *    - fecha modal pendente
   *
   * Nenhum `flush` é disparado: os sinais já têm os valores corretos para a UI;
   * o primeiro tick visual ocorre no próximo segundo alinhado ao relógio.
   */
  ativarRelógios(anchor: number, pomodoroEnabled: boolean): void {
    const aligned = alinharEpochAoSegundo(anchor);
    this.timer.startAt(aligned);

    if (!pomodoroEnabled) return;

    if (this.pomodoro.running()) {
      this.pomodoro.realinharAnchor(aligned);
    } else {
      this.pomodoro.startAt(aligned);
    }

    this.pomodoro.dismissOverlay();
  }
}
