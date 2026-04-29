import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ObservacoesEditor } from '../../observacoes-editor/observacoes-editor';
import { PomodoroTimer } from '../../pomodoro-timer/pomodoro-timer';
import { TimerDisplay } from '../../timer-display/timer-display';
import { SessionTimerService } from '../../../services/session-timer-service';

@Component({
  selector: 'app-sessao-estudo-session-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PomodoroTimer, TimerDisplay, ObservacoesEditor],
  templateUrl: './sessao-estudo-session-card.html',
  styleUrl: './sessao-estudo-session-card.css',
})
export class SessaoEstudoSessionCard {
  readonly timer = inject(SessionTimerService);

  disciplinaNome = input.required<string>();
  tempoPlanejado = input.required<string>();
  statusLabel = input.required<string>();
  pomodoroEnabled = input(false);
  pomodoroTemporariamenteDesativado = input(false);
  observacoes = input.required<string>();
  acaoLoading = input(false);
  retomarBloqueadoNaPausaCurta = input(false);

  mainActionClick = output<void>();
  pomodoroSkipStage = output<void>();
  pomodoroToggleEnabled = output<void>();
  observacoesChange = output<string>();
  observacoesSaveRequest = output<string>();
}
