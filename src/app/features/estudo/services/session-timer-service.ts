import { computed, Injectable, NgZone, signal } from '@angular/core';
import { Subscription } from 'rxjs';

interface TimerState {
  metaMs: number;
  decorridoMs: number;
  pausada: boolean;
  finalizada: boolean;
  baseDecorridoMs: number;
  baseAgoraMs: number;
}

@Injectable({ providedIn: 'root' })
export class SessionTimerService {


  private readonly state = signal<TimerState>({
    metaMs: 0,
    decorridoMs: 0,
    pausada: true,
    finalizada: false,
    baseDecorridoMs: 0,
    baseAgoraMs: 0
  });

  readonly decorridoMs = computed(() => this.state().decorridoMs);
  readonly metaMs = computed(() => this.state().metaMs);
  readonly pausada = computed(() => this.state().pausada);
  readonly finalizada = computed(() => this.state().finalizada);
  readonly restanteMs = computed(() => Math.max(0, this.state().metaMs - this.state().decorridoMs));

  private tickerId?: any;

  private tickerSub?: Subscription;

  constructor(private readonly zone: NgZone) { }

  // =============================
  // INIT DA SESSÃO
  // =============================

  init(metaMs: number, baseDecorridoMs: number, pausada: boolean, finalizada: boolean): void {
    this.stopTicker();

    this.state.set({
      metaMs,
      decorridoMs: baseDecorridoMs,
      pausada,
      finalizada,
      baseDecorridoMs,
      baseAgoraMs: Date.now()
    });

    if (!pausada && !finalizada) this.startTicker();
  }

  // =============================
  // CONTROLES
  // =============================

  start(): void {
    if (this.state().finalizada) return;

    this.state.update(s => ({
      ...s,
      pausada: false,
      baseDecorridoMs: s.decorridoMs,
      baseAgoraMs: Date.now()
    }));

    this.startTicker();
  }
  pause(): number {
    this.stopTicker();
    const decorrido = this.calculateNow();

    this.state.update(s => ({
      ...s,
      decorridoMs: decorrido,
      pausada: true
    }));

    return Math.floor(decorrido / 1000);
  }

  finish(): void {
    this.stopTicker();
    this.state.update(s => ({
      ...s,
      decorridoMs: s.metaMs,
      finalizada: true,
      pausada: true
    }));
  }

  stop(): void {
    this.stopTicker();
  }

  reset(): void {
    this.stopTicker();
    this.state.set({
      metaMs: 0,
      decorridoMs: 0,
      pausada: true,
      finalizada: false,
      baseDecorridoMs: 0,
      baseAgoraMs: 0
    });
  }
  // =============================
  // TICKER SEM DRIFT
  // =============================

  private startTicker(): void {
    this.stopTicker();
    // Uso de setInterval nativo: mais leve e amigável para Angular Zoneless
    this.tickerId = setInterval(() => {
      const now = this.calculateNow();
      const meta = this.state().metaMs;

      if (meta > 0 && now >= meta) {
        this.finish();
      } else {
        this.state.update(s => ({ ...s, decorridoMs: now }));
      }
    }, 1000);
  }

  private stopTicker(): void {
    if (this.tickerId) {
      clearInterval(this.tickerId);
      this.tickerId = undefined;
    }
  }

  private calculateNow(): number {
    const s = this.state();
    const delta = Date.now() - s.baseAgoraMs;
    const total = s.baseDecorridoMs + delta;

    return s.metaMs > 0 ? Math.min(total, s.metaMs) : Math.max(0, total);
  }

}