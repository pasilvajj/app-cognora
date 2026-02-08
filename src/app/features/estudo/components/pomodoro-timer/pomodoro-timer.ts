import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { PomodoroEngineService } from '../../services/pomodoro-engine-service';

@Component({
  selector: 'app-pomodoro-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pomodoro-timer.html',
  styleUrl: './pomodoro-timer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PomodoroTimer {
  // ===== engine central =====
  readonly engine = inject(PomodoroEngineService);

  // ===== inputs =====
  sessaoFinalizada = input(false);

  // ===== outputs =====
  skipStage = output<void>();
  toggleEnabled = output<void>();

  // ===============================
  // AÇÕES DO TEMPLATE
  // ===============================

  onSkipStage(): void {
    this.engine.skip();
    this.skipStage.emit();
  }

  onToggleEnabled(): void {
    this.toggleEnabled.emit();
  }
}