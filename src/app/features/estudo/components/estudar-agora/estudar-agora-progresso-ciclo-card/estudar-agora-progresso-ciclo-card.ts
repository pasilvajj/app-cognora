import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  formatPercent as formatPercentUtil,
} from '../../../../../shared/utils/progresso-disciplina.util';
import { EstudarAgoraProgressItem } from '../estudar-agora-view.models';

@Component({
  selector: 'app-estudar-agora-progresso-ciclo-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './estudar-agora-progresso-ciclo-card.html',
  styleUrls: ['../estudar-agora-shared.css', './estudar-agora-progresso-ciclo-card.css'],
})
export class EstudarAgoraProgressoCicloCard {
  progress = input<EstudarAgoraProgressItem[]>([]);
  disciplinaNavigate = output<number>();

  formatPercent(value: number): string {
    return formatPercentUtil(value);
  }

  getBarClass(percent: number): 'bar-blue' | 'bar-green' | 'bar-orange' {
    if (percent >= 60) return 'bar-green';
    if (percent >= 35) return 'bar-blue';
    return 'bar-orange';
  }

  trackByDisciplina(_: number, item: EstudarAgoraProgressItem): string {
    return `${item.disciplinaId ?? '—'}-${item.disciplina}`;
  }

  onRowClick(item: EstudarAgoraProgressItem): void {
    if (item.disciplinaId != null && Number.isFinite(item.disciplinaId)) {
      this.disciplinaNavigate.emit(item.disciplinaId);
    }
  }

  rowClickable(item: EstudarAgoraProgressItem): boolean {
    return item.disciplinaId != null && Number.isFinite(item.disciplinaId);
  }
}
