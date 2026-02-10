import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TempoRelogioPipe } from '../../../../shared/pipes/tempo-relogio-pipe';

@Component({
  selector: 'app-timer-display',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule], // Removido o Pipe daqui para sanar o erro NG8113
  templateUrl: './timer-display.html',
  styleUrl: './timer-display.css',
})
export class TimerDisplay {
  // Signal Inputs
  decorridoMs = input<number>(0);
  metaMs = input<number>(0);

  // Instanciamos o pipe para uso interno no TypeScript
  private readonly pipe = new TempoRelogioPipe();

  // 1. Formata o tempo decorrido
  readonly decorridoFormatado = computed(() =>
    this.pipe.transform(this.decorridoMs())
  );

  // 2. Formata a meta de tempo
  readonly metaFormatado = computed(() =>
    this.pipe.transform(this.metaMs())
  );

  // 3. A PROPRIEDADE QUE FALTAVA: Formata quanto tempo falta
  readonly restanteFormatado = computed(() => {
    const restante = Math.max(0, this.metaMs() - this.decorridoMs());
    // Força o arredondamento para cima antes de formatar
    const segundosAjustados = Math.ceil(restante / 1000) * 1000;
    return this.pipe.transform(segundosAjustados);
  });

}
