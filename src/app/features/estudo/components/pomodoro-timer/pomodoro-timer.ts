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

  // 3. Signal Outputs
  skipStage = output<void>();
  toggleEnabled = output<void>();

  // 4. Computed local para UI (Otimiza re-render do HTML)
  // Exemplo: se precisar de uma lógica específica apenas para o botão de pular
  readonly canSkip = computed(() => !this.sessaoFinalizada() && !this.engine.finished());

  // ===============================
  // AÇÕES DO TEMPLATE
  // ===============================

  onToggle(): void {
    if (this.sessaoFinalizada()) return;
    this.engine.toggle();
  }

  onSkipStage(): void {
    this.engine.skip();
    this.skipStage.emit(); // Notifica o pai se necessário (ex: para logs)
  }

  onToggleEnabled(): void {
    this.toggleEnabled.emit();
  }
}
