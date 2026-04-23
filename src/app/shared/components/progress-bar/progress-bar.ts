import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatPercent } from '../../utils/progresso-disciplina.util';

export type ProgressDisciplinaItem = { name: string; percent: number };

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.css',
})
export class ProgressBar {
  /** Quando vazio, não exibe lista mockada — apenas estado vazio. */
  items = input<ProgressDisciplinaItem[]>([]);

  readonly formatPct = formatPercent;

  trackByName(_: number, d: ProgressDisciplinaItem): string {
    return d.name;
  }

  /**
   * Escala de cor por avanço — evita “vermelho de erro” para % baixas ainda válidas.
   * empty: 0% · low/mid: azuis (continuidade) · high: verde (meta forte).
   */
  progressTone(progress: number): 'empty' | 'low' | 'mid' | 'high' {
    const p = Math.max(0, Math.min(100, progress));
    if (p <= 0) return 'empty';
    if (p < 34) return 'low';
    if (p < 72) return 'mid';
    return 'high';
  }
}
