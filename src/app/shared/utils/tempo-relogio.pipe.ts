// tempo-relogio.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { TempoFormatUtil } from './tempo-format.util';

@Pipe({
  name: 'tempoRelogio',
  standalone: true
})
export class TempoRelogioPipe implements PipeTransform {
  transform(ms: number, mode: 'floor' | 'ceil' = 'floor'): string {
    return TempoFormatUtil.msParaRelogio(ms, mode);
  }
}
