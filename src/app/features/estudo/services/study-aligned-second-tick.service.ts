import { Injectable } from '@angular/core';

/**
 * Tick único alinhado ao segundo do relógio de parede (Date.now() % 1000 → 0).
 */
type TickCallback = (nowMs: number) => void;

/** Epoch ms no início do segundo corrente — alinha anchors de sessão e Pomodoro. */
export function alinharEpochAoSegundo(epochMs: number = Date.now()): number {
  return epochMs - (epochMs % 1000);
}

/**
 * Tick único alinhado ao segundo do relógio de parede (Date.now() % 1000 → 0).
 *
 * Responsabilidade única: disparar todos os assinantes no mesmo instante a cada segundo,
 * passando um único `nowMs` capturado antes de iterar — eliminando o drift visual
 * entre cronômetros que resulta de chamadas independentes ao Date.now().
 */
@Injectable({ providedIn: 'root' })
export class StudyAlignedSecondTickService {
  private readonly callbacks = new Map<string, TickCallback>();
  private alignTimeoutId?: ReturnType<typeof setTimeout>;
  private intervalId?: ReturnType<typeof setInterval>;

  register(id: string, callback: TickCallback): void {
    this.callbacks.set(id, callback);

    if (!this.isScheduled()) {
      this.scheduleAlignedStart();
    }
  }

  unregister(id: string): void {
    this.callbacks.delete(id);

    if (this.callbacks.size === 0) {
      this.clearAll();
    }
  }

  private isScheduled(): boolean {
    return this.alignTimeoutId != null || this.intervalId != null;
  }

  /** Aguarda o próximo segundo de relógio para alinhar o primeiro tick. */
  private scheduleAlignedStart(): void {
    const msUntilNextSecond = 1000 - (Date.now() % 1000);

    this.alignTimeoutId = setTimeout(() => {
      this.alignTimeoutId = undefined;
      this.fireAll();
      this.intervalId = setInterval(() => this.fireAll(), 1000);
    }, msUntilNextSecond);
  }

  private clearAll(): void {
    if (this.alignTimeoutId != null) {
      clearTimeout(this.alignTimeoutId);
      this.alignTimeoutId = undefined;
    }
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Captura Date.now() UMA única vez e passa o mesmo valor para todos os callbacks.
   * Sem isso, callbacks sequenciais leriam instantes ligeiramente diferentes e
   * poderiam cruzar um limite de segundo em momentos distintos → divergência de 1 s.
   */
  private fireAll(): void {
    const nowMs = Date.now();
    for (const cb of this.callbacks.values()) {
      cb(nowMs);
    }
  }
}
