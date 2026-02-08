import { Injectable, NgZone, computed, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';

export type PomodoroMode = 'FOCO' | 'PAUSA_CURTA' | 'PAUSA_LONGA';

export interface PomodoroConfig {
  focoMin: number;
  pausaCurtaMin: number;
  pausaLongaMin: number;
  longaACada: number;
}

@Injectable({ providedIn: 'root' })
export class PomodoroEngineService {

  // ================================
  // STATE PRIVADO
  // ================================

  private readonly _mode = signal<PomodoroMode>('FOCO');
  private readonly _remainingMs = signal(0);
  private readonly _running = signal(false);
  private readonly _finished = signal(false);
  private readonly _cicloAtual = signal(1);
  private readonly _totalCiclos = signal(4);

  private config: PomodoroConfig = {
    focoMin: 25,
    pausaCurtaMin: 5,
    pausaLongaMin: 15,
    longaACada: 4,
  };

  private tickerSub?: Subscription;
  private endTime = 0;
  private readonly _focusFinished = signal(false);
  constructor(private readonly zone: NgZone) { }

  // ================================
  // SIGNALS PÚBLICOS
  // ================================

  readonly mode = computed(() => this._mode());
  readonly remainingMs = computed(() => this._remainingMs());
  readonly running = computed(() => this._running());
  readonly finished = computed(() => this._finished());
  readonly cicloAtual = computed(() => this._cicloAtual());
  readonly totalCiclos = computed(() => this._totalCiclos());
  readonly focusFinished = this._focusFinished.asReadonly();

  /** ⬅️ ESTE ERA O QUE FALTAVA */
  readonly modeLabel = computed(() => {
    const mode = this._mode();
    if (mode === 'FOCO') return 'FOCO';
    if (mode === 'PAUSA_CURTA') return 'PAUSA CURTA';
    return 'PAUSA LONGA';
  });

  readonly isFocusMode = computed(() => this._mode() === 'FOCO');

  readonly timeLabel = computed(() => {
    const totalSec = Math.floor(this._remainingMs() / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  // =============================
  // OVERLAY STATE
  // =============================

  private readonly _overlayVisible = signal(false);
  private readonly _overlayText = signal('');

  readonly overlayVisible = computed(() => this._overlayVisible());
  readonly overlayText = computed(() => this._overlayText());

  // =============================
  // OVERLAY CONTROLES
  // =============================

  showOverlay(text: string): void {
    this._overlayText.set(text);
    this._overlayVisible.set(true);
  }

  closeOverlay(): void {
    this._overlayVisible.set(false);
  }


  // ================================
  // INIT
  // ================================

  init(config: PomodoroConfig): void {
    this.stop();

    this.config = config;
    this._totalCiclos.set(config.longaACada);
    this._cicloAtual.set(1);
    this._mode.set('FOCO');
    this._finished.set(false);

    this._remainingMs.set(this.getStageDuration('FOCO'));
  }

  // ================================
  // CONTROLES
  // ================================

  toggle(): void {
    if (this._finished()) return;

    if (this._running()) this.pause();
    else this.start();
  }

  start(): void {
    if (this._finished()) return;
    this._focusFinished.set(false);
    this._running.set(true);
    this.endTime = Date.now() + this._remainingMs();
    this.startTicker();
  }

  pause(): void {
    this._remainingMs.set(Math.max(0, this.endTime - Date.now()));
    this._running.set(false);
    this.stopTicker();
  }

  stop(): void {
    this.stopTicker();
    this._running.set(false);
  }

  skip(): void {
    this.advanceStage();
  }

  // ================================
  // TICKER SEM DRIFT
  // ================================

  private startTicker(): void {
    this.stopTicker();

    this.tickerSub = timer(0, 250).subscribe(() => {
      this.zone.run(() => {
        if (!this._running() || this._finished()) {
          this.stopTicker();
          return;
        }

        const restante = Math.max(0, this.endTime - Date.now());
        this._remainingMs.set(restante);

        if (restante <= 0) {
          this.advanceStage();
        }
      });
    });
  }

  private stopTicker(): void {
    this.tickerSub?.unsubscribe();
    this.tickerSub = undefined;
  }

  // ================================
  // FLUXO DE ETAPAS
  // ================================

  private advanceStage(): void {
    this.stopTicker();

    const current = this._mode();
    // =========================
    // FOCO → MOSTRA OVERLAY E PARA
    // =========================
    if (current === 'FOCO') {
      const isLong = this._cicloAtual() % this.config.longaACada === 0;

      // muda apenas o modo (ainda NÃO inicia pausa)
      this._mode.set(isLong ? 'PAUSA_LONGA' : 'PAUSA_CURTA');
      this._remainingMs.set(this.getStageDuration(this._mode()));

      // 🔥 MOSTRA OVERLAY
      this._overlayText.set('Tempo de foco encerrado. Faça uma pausa.');
      this._overlayVisible.set(true);

      // 🔥 PARA execução (espera usuário)
      this._running.set(false);
      this._focusFinished.set(true);

      return;
    }

    // =========================
    // PAUSA → PRÓXIMO CICLO OU FIM
    // =========================
    if (this._cicloAtual() >= this.config.longaACada) {
      this._finished.set(true);
      this._running.set(false);
      this._remainingMs.set(0);
      return;
    }

    // avança ciclo
    this._cicloAtual.update(v => v + 1);
    this._mode.set('FOCO');
    this._remainingMs.set(this.getStageDuration('FOCO'));

    // 🔥 MOSTRA OVERLAY ANTES DO FOCO
    this._overlayText.set('Pausa encerrada. Pronto para voltar ao foco?');
    this._overlayVisible.set(true);

    // 🔥 NÃO inicia automático
    this._running.set(false);
  }

  // ================================
  // HELPERS
  // ================================

  private getStageDuration(mode: PomodoroMode): number {
    if (mode === 'FOCO') return this.config.focoMin * 60_000;
    if (mode === 'PAUSA_LONGA') return this.config.pausaLongaMin * 60_000;
    return this.config.pausaCurtaMin * 60_000;
  }
}