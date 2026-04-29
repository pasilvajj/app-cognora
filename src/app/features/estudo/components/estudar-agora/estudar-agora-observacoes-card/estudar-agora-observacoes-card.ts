import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EstudarAgoraObservacaoItem } from '../estudar-agora-view.models';

@Component({
  selector: 'app-estudar-agora-observacoes-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './estudar-agora-observacoes-card.html',
  styleUrls: ['../estudar-agora-shared.css', './estudar-agora-observacoes-card.css'],
})
export class EstudarAgoraObservacoesCard {
  observacoesLoading = input(false);
  observacoesMateria = input<EstudarAgoraObservacaoItem[]>([]);

  trackByObservacao(_: number, item: EstudarAgoraObservacaoItem): number {
    return item.sessaoId;
  }
}
