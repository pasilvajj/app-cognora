import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-estudar-agora-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estudar-agora-page-header.html',
  styleUrl: './estudar-agora-page-header.css',
})
export class EstudarAgoraPageHeader {
  rodadaAtualNumero = input<number | null>(null);
  backClicked = output<void>();
}
