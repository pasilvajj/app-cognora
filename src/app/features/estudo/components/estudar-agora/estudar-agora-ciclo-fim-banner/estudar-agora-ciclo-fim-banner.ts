import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppButtonComponent } from '../../../../../shared/components/app-button/app-button';

@Component({
  selector: 'app-estudar-agora-ciclo-fim-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButtonComponent],
  templateUrl: './estudar-agora-ciclo-fim-banner.html',
  styleUrls: ['../estudar-agora-shared.css', './estudar-agora-ciclo-fim-banner.css'],
})
export class EstudarAgoraCicloFimBanner {
  ultimaRodadaConcluidaNumero = input<number | null>(null);
  iniciandoNovaRodada = input(false);
  iniciarNovaRodadaConfirmada = output<void>();
}
