import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TempoRelogioPipe } from '../../../../shared/pipes/tempo-relogio-pipe';

@Component({
  selector: 'app-timer-display',
  standalone: true,
  imports: [CommonModule, TempoRelogioPipe],
  templateUrl: './timer-display.html',
  styleUrl: './timer-display.css',
})
export class TimerDisplay {
  @Input() tempoExibido = '0:00';
  @Input() tempoMeta = '0:00';
  @Input() tempoRestante = '0:00';

  @Input() decorridoMs: number = 0;
  @Input() metaMs: number = 0;
}
