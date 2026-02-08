import { computed, Injectable, NgZone, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionTimerService {
  // =============================
  // STATE PRIVADO
  // =============================

  private readonly _decorridoMs = signal(0);
  private readonly _metaMs = signal(0);
  private readonly _paused = signal(true);
  private readonly _finished = signal(false);

  private baseDecorridoMs = 0;
  private baseAgoraMs = 0;

  private tickerSub?: Subscription;

  constructor(private readonly zone: NgZone) { }

  // =============================
  // SIGNALS PÚBLICOS (USADOS NO HTML)
  // =============================

  /** ⬅️ ESTE ERA O QUE FALTAVA */
  readonly decorridoMs = computed(() => this._decorridoMs());

  readonly metaMs = computed(() => this._metaMs());
  readonly pausada = computed(() => this._paused());
  readonly finalizada = computed(() => this._finished());

  readonly restanteMs = computed(() => {
    const restante = this._metaMs() - this._decorridoMs();
    return Math.max(0, restante);
  });

  // =============================
  // INIT DA SESSÃO
  // =============================

  init(
    metaMs: number,
    baseDecorridoMs: number,
    pausada: boolean,
    finalizada: boolean
  ): void {
    this.stopTicker();

    this._metaMs.set(metaMs);
    this._paused.set(pausada);
    this._finished.set(finalizada);

    this.baseDecorridoMs = baseDecorridoMs;
    this.baseAgoraMs = Date.now();

    this._decorridoMs.set(baseDecorridoMs);

    if (!pausada && !finalizada) {
      this.startTicker();
    }
  }

  // =============================
  // CONTROLES
  // =============================

  start(): void {
    if (this._finished()) return;

    this._paused.set(false);

    this.baseDecorridoMs = this._decorridoMs();
    this.baseAgoraMs = Date.now();

    this.startTicker();
  }

  pause(): number {
    this.stopTicker();

    const decorrido = this.calculateNow();
    this._decorridoMs.set(decorrido);
    this._paused.set(true);

    /** retorna segundos para enviar ao backend */
    return Math.floor(decorrido / 1000);
  }

  finish(): void {
    this.stopTicker();

    this._decorridoMs.set(this._metaMs());
    this._finished.set(true);
    this._paused.set(true);
  }

  stop(): void {
    this.stopTicker();
  }

  // =============================
  // TICKER SEM DRIFT
  // =============================

  private startTicker(): void {
    this.stopTicker();

    this.tickerSub = timer(0, 1000).subscribe(() => {
      this.zone.run(() => {
        if (this._paused() || this._finished()) {
          this.stopTicker();
          return;
        }

        const now = this.calculateNow();
        this._decorridoMs.set(now);

        if (this._metaMs() > 0 && now >= this._metaMs()) {
          this.finish();
        }
      });
    });
  }

  private stopTicker(): void {
    this.tickerSub?.unsubscribe();
    this.tickerSub = undefined;
  }

  // =============================
  // CÁLCULO ABSOLUTO
  // =============================

  private calculateNow(): number {
    const delta = Date.now() - this.baseAgoraMs;
    const total = this.baseDecorridoMs + delta;

    if (this._metaMs() > 0) {
      return Math.min(total, this._metaMs());
    }

    return Math.max(0, total);
  }

  // =============================
  // RESET (AO SAIR DA TELA)
  // =============================

  reset(): void {
    this.stopTicker();

    this._decorridoMs.set(0);
    this._metaMs.set(0);
    this._paused.set(true);
    this._finished.set(false);

    this.baseDecorridoMs = 0;
    this.baseAgoraMs = 0;
  }
}