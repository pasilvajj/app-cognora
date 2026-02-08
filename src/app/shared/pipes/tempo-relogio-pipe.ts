import { Pipe, PipeTransform } from '@angular/core';
import { TempoFormatUtil } from '../utils/tempo-format.util';

@Pipe({
  name: 'tempoRelogio',
})
export class TempoRelogioPipe implements PipeTransform {
  transform(value: number, mode: 'floor' | 'ceil' = 'floor'): string {
    if (value === null || value === undefined) return '--:--';

    return TempoFormatUtil.msParaRelogio(value, mode);
  }

}
