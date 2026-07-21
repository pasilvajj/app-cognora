import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-sessao-estudo-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessao-estudo-page-header.html',
  styleUrl: './sessao-estudo-page-header.css',
})
export class SessaoEstudoPageHeader {
  cicloNome = input.required<string>();
  disciplinaNome = input.required<string>();
  ordem = input.required<number>();
  statusLabel = input.required<string>();
  pomodoroEnabled = input(false);
  pomodoroTemporariamenteDesativado = input(false);
  podePularPomodoro = input(false);
  sessaoFinalizada = input(false);
  backClicked = output<void>();
  pomodoroSkipStage = output<void>();
  pomodoroToggleEnabled = output<void>();
}
