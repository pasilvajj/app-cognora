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

  getColor(progress: number): string {
    if (progress >= 75) return 'success';
    if (progress >= 50) return 'warning';
    return 'danger';
  }
}
