export class TempoFormatUtil {
  private constructor() {}

  static minutosParaMs(min?: number | null): number {
    return Math.max(0, Number(min ?? 0)) * 60_000;
  }

  /** mm:ss usando floor (bom para tempo decorrido). */
  static msParaMinSegFloor(ms: number): string {
    const totalSeg = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    return `${min}:${String(seg).padStart(2, '0')}`;
  }

  /** mm:ss usando ceil (bom para “restante”). */
  static msParaMinSegCeil(ms: number): string {
    const totalSeg = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    return `${min}:${String(seg).padStart(2, '0')}`;
  }

  /** Minutos em "Xm" ou "Xh" ou "Xh Ymin". */
  static minutosParaHorasMin(min?: number | null): string {
    const m = Math.max(0, Number(min ?? 0));
    const h = Math.floor(m / 60);
    const r = m % 60;

    if (h <= 0) return `${r} min`;
    if (r === 0) return `${h}h`;
    return `${h}h ${r}min`;
  }

  /**
   * Duração em formato amigável:
   * - < 1h: mm:ss
   * - >= 1h: Hh mm:ss
   *
   * Use floor/ceil conforme o caso (decorrido vs restante).
   */
  static msParaDuracao(ms: number, mode: 'floor' | 'ceil' = 'floor'): string {
    const totalSeg =
      mode === 'ceil'
        ? Math.max(0, Math.ceil(ms / 1000))
        : Math.max(0, Math.floor(ms / 1000));

    const h = Math.floor(totalSeg / 3600);
    const rem = totalSeg % 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;

    if (h <= 0) {
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    return `${h}h ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  static msParaRelogio(ms: number, mode: 'floor' | 'ceil' = 'floor'): string {
    const totalSeg =
      mode === 'ceil'
        ? Math.max(0, Math.ceil(ms / 1000))
        : Math.max(0, Math.floor(ms / 1000));

    const h = Math.floor(totalSeg / 3600);
    const rem = totalSeg % 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;

    // < 1h: mm:ss
    if (h <= 0) {
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    // >= 1h: HH:MM:SS (com zero à esquerda)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  static formatMsToMMSS(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

}