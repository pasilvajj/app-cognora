import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppButtonComponent } from '../../../../../shared/components/app-button/app-button';
import { ProximaSessaoDto } from '../../../data/estudo.models';

@Component({
  selector: 'app-estudar-agora-proxima-sessao-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButtonComponent],
  templateUrl: './estudar-agora-proxima-sessao-card.html',
  styleUrls: ['../estudar-agora-shared.css', './estudar-agora-proxima-sessao-card.css'],
})
export class EstudarAgoraProximaSessaoCard {
  proximaSessaoDto = input<ProximaSessaoDto | undefined>(undefined);
  tempoPlanejadoLabel = input('');
  loading = input(false);
  aguardandoNovaRodada = input(false);
  escolherOutraMateria = output<void>();
  iniciarEstudo = output<void>();
}
