import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatPercent } from '../../utils/progresso-disciplina.util';

export type ProgressDisciplinaItem = { name: string; percent: number; disciplinaId?: number };

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
  /** Quando definido com `disciplinaId` nos itens, as linhas abrem o histórico da disciplina. */
  cicloId = input<number | null>(null);
  disciplinaClick = output<ProgressDisciplinaItem>();

  readonly formatPct = formatPercent;

  trackByName(_: number, d: ProgressDisciplinaItem): string {
    return `${d.disciplinaId ?? '—'}-${d.name}`;
  }

  /**
   * Escala de cor por avanço — evita “vermelho de erro” para % baixas ainda válidas.
   * empty: 0% · low/mid: azuis (continuidade) · high: verde (meta forte).
   */
  onItemClick(d: ProgressDisciplinaItem): void {
    const cid = this.cicloId();
    if (cid != null && d.disciplinaId != null && Number.isFinite(d.disciplinaId)) {
      this.disciplinaClick.emit(d);
    }
  }

  isClickable(d: ProgressDisciplinaItem): boolean {
    const cid = this.cicloId();
    return cid != null && d.disciplinaId != null && Number.isFinite(Number(d.disciplinaId));
  }

  progressTone(progress: number): 'empty' | 'low' | 'mid' | 'high' {
    const p = Math.max(0, Math.min(100, progress));
    if (p <= 0) return 'empty';
    if (p < 34) return 'low';
    if (p < 72) return 'mid';
    return 'high';
  }
}
