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

  /**
   * Restante em segundos inteiros coerente com o decorrido exibido:
   * floor(meta/1s) − floor(decorrido/1s). Evita ficar 1s à frente de
   * floor((meta − decorrido) / 1s).
   */
  readonly restanteFormatado = computed(() => {
    const metaSeg = Math.floor(this.metaMs() / 1000);
    const decorridoSeg = Math.floor(this.decorridoMs() / 1000);
    const restanteSeg = Math.max(0, metaSeg - decorridoSeg);
    return this.pipe.transform(restanteSeg * 1000, 'floor');
  });

}
