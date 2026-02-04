import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PomodoroMode } from '../pomodoro-timer/pomodoro-timer';

@Component({
  selector: 'app-pomodoro-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pomodoro-overlay.html',
  styleUrl: './pomodoro-overlay.css',
})
export class PomodoroOverlay {
  @Input() visible = false;
  @Input() mode: PomodoroMode = 'FOCO';
  @Input() texto = '';
  @Input() acaoLoading = false;
  @Input() sessaoFinalizada = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() nextStage = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onNextStage(): void {
    this.nextStage.emit();
  }

  get isFocusMode(): boolean {
    return this.mode === 'FOCO';
  }

  get title(): string {
    return this.isFocusMode ? 'Hora do foco' : 'Pausa';
  }
}
