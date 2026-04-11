import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { PomodoroEngineService } from '../../services/pomodoro-engine-service';

@Component({
  selector: 'app-pomodoro-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pomodoro-timer.html',
  styleUrl: './pomodoro-timer.css',
  changeDetection: ChangeDetectionStrategy.OnPush, // Crítico para performance
})
export class PomodoroTimer {
  // 1. Injeção da Engine Central (Estado Atômico)
  readonly engine = inject(PomodoroEngineService);

  // 2. Signal Inputs (Modern Angular)
  sessaoFinalizada = input(false);
  desativado = input(false);

  // 3. Signal Outputs
  skipStage = output<void>();
  toggleEnabled = output<void>();

  // 4. Computed local para UI (Otimiza re-render do HTML)
  // Exemplo: se precisar de uma lógica específica apenas para o botão de pular
  /** Pular etapa deve funcionar mesmo com Pomodoro “Desativar agora” (senão o usuário fica preso na PAUSA_CURTA). */
  readonly canSkip = computed(() => !this.sessaoFinalizada() && !this.engine.finished());

  // ===============================
  // AÇÕES DO TEMPLATE
  // ===============================

  onToggle(): void {
    if (this.sessaoFinalizada()) return;
    this.engine.toggle();
  }

  /** O `skip()` real fica no pai — evita dupla chamada (FOCO → pular de novo → voltava para PAUSA). */
  onSkipStage(): void {
    this.skipStage.emit();
  }

  onToggleEnabled(): void {
    this.toggleEnabled.emit();
  }
}
