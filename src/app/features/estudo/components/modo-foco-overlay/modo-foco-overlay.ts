import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';

import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { PomodoroEngineService } from '../../services/pomodoro-engine-service';
import { SessionTimerService } from '../../services/session-timer-service';

@Component({
  selector: 'app-modo-foco-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modo-foco-overlay.html',
  styleUrl: './modo-foco-overlay.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModoFocoOverlay {
  readonly timer = inject(SessionTimerService);
  readonly pomodoro = inject(PomodoroEngineService);

  visible = input(false);
  pomodoroEnabled = input(false);
  pomodoroDesativado = input(false);
  acaoLoading = input(false);
  retomarBloqueadoNaPausaCurta = input(false);
  sessaoFinalizada = input(false);
  prontaParaIniciar = input(false);

  close = output<void>();
  mainAction = output<void>();
  skipStage = output<void>();
  togglePomodoro = output<void>();

  readonly titulo = computed(() => {
    if (!this.pomodoroEnabled() || this.pomodoroDesativado()) {
      return 'Hora do foco';
    }
    const modo = this.pomodoro.mode();
    if (modo === 'FOCO') return 'Hora do foco';
    if (modo === 'PAUSA_CURTA') return 'Pausa curta';
    return 'Pausa longa';
  });

  readonly cronometroPrincipal = computed(() => {
    if (this.pomodoroEnabled() && !this.pomodoroDesativado()) {
      return this.pomodoro.timeLabel();
    }
    return TempoFormatUtil.msParaRelogio(this.timer.restanteMs());
  });

  readonly metaLabel = computed(() => TempoFormatUtil.msParaRelogio(this.timer.metaMs()));
  readonly estudadoLabel = computed(() => TempoFormatUtil.msParaRelogio(this.timer.decorridoMs()));

  readonly mainActionLabel = computed(() => {
    if (this.sessaoFinalizada()) return 'Concluída';
    if (this.prontaParaIniciar()) return 'Iniciar';
    if (this.timer.pausada()) return 'Retomar';
    return 'Pausar';
  });

  readonly podePularEtapa = computed(
    () =>
      this.pomodoroEnabled() &&
      !this.pomodoroDesativado() &&
      !this.sessaoFinalizada() &&
      !this.pomodoro.finished(),
  );

  readonly pomodoroToggleLabel = computed(() =>
    this.pomodoroDesativado() ? 'Ativar agora' : 'Desativar agora',
  );

  readonly mainActionDisabled = computed(
    () =>
      this.sessaoFinalizada() ||
      this.acaoLoading() ||
      this.retomarBloqueadoNaPausaCurta(),
  );

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) {
      this.close.emit();
    }
  }
}
