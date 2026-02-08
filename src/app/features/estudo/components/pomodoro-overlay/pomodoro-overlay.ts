import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { PomodoroMode } from '../../data/pomodoro.types';

@Component({
  selector: 'app-pomodoro-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pomodoro-overlay.html',
  styleUrl: './pomodoro-overlay.css',
})
export class PomodoroOverlay {
  // ================= INPUTS =================

  visible = input(false);
  mode = input<PomodoroMode>('FOCO');
  texto = input('');
  acaoLoading = input(false);
  sessaoFinalizada = input(false);

  // ================= OUTPUTS =================

  closeOverlay = output<void>();
  nextStage = output<void>();

  // ================= ACTIONS =================

  onClose(): void {
    this.closeOverlay.emit();
  }

  onNextStage(): void {
    this.nextStage.emit();
  }

  // ================= HELPERS =================

  get isFocusMode(): boolean {
    return this.mode() === 'FOCO';
  }

  get title(): string {
    return this.isFocusMode ? 'Hora do foco' : 'Pausa';
  }
}