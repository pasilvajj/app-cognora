import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-timer-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timer-display.html',
  styleUrl: './timer-display.css',
})
export class TimerDisplay {
  @Input() tempoExibido = '0:00';
  @Input() tempoMeta = '0:00';
  @Input() tempoRestante = '0:00';
}
