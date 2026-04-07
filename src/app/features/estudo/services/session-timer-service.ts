import { computed, inject, Injectable, signal } from '@angular/core';

import { StudyAlignedSecondTickService } from './study-aligned-second-tick.service';

interface TimerState {
  readonly metaMs: number;
  readonly decorridoMs: number;
  readonly pausada: boolean;
  readonly finalizada: boolean;
  /** Valor de decorrido no momento em que o relógio foi ancorado. */
  readonly baseDecorridoMs: number;
  /** Instante de parede em que o relógio foi ancorado (epoch ms). */
  readonly baseAgoraMs: number;
}

const IDLE_STATE: TimerState = {
  metaMs: 0,
  decorridoMs: 0,
  pausada: true,
  finalizada: false,
  baseDecorridoMs: 0,
  baseAgoraMs: 0,
};

const TICK_ID = 'session-timer';

@Injectable({ providedIn: 'root' })
export class SessionTimerService {
  private readonly tick = inject(StudyAlignedSecondTickService);
  private readonly state = signal<TimerState>(IDLE_STATE);

  // ── Selectors ──────────────────────────────────────────────────────────────

  readonly decorridoMs = computed(() => this.state().decorridoMs);
  readonly metaMs      = computed(() => this.state().metaMs);
  readonly pausada     = computed(() => this.state().pausada);
  readonly finalizada  = computed(() => this.state().finalizada);

  /**
   * Segundos inteiros restantes, coerente com o decorrido exibido:
   * floor(meta/s) − floor(decorrido/s).
   */
  readonly restanteMs = computed(() => {
    const s = this.state();
    const metaSeg     = Math.floor(s.metaMs / 1000);
    const decorridoSeg = Math.floor(s.decorridoMs / 1000);
    return Math.max(0, metaSeg - decorridoSeg) * 1000;
  });

  // ── Inicialização ──────────────────────────────────────────────────────────

  /**
   * @param deferTicker  Com true, não inicia o tick agora; use `startAt()` depois.
   *                     Necessário nos fluxos começar/retomar para sincronizar com o Pomodoro.
   */
  init(
    metaMs: number,
    baseDecorridoMs: number,
    pausada: boolean,
    finalizada: boolean,
    opts?: { deferTicker?: boolean },
  ): void {
    this.stopTicker();

    this.state.set({
      metaMs,
      decorridoMs: baseDecorridoMs,
      pausada,
      finalizada,
      baseDecorridoMs,
      baseAgoraMs: Date.now(),
    });

    if (!pausada && !finalizada && !opts?.deferTicker) {
      this.startTicker();
    }
  }

  // ── Controles ──────────────────────────────────────────────────────────────

  /**
   * Ancora o relógio a `anchorEpochMs` e inicia a contagem.
   * Deve ser o mesmo instante passado ao Pomodoro para garantir sincronismo.
   */
  startAt(anchorEpochMs: number): void {
    if (this.state().finalizada) return;

    const s = this.state();

    // Usa o valor exato presente no estado (definido por init() via valor do servidor).
    // NÃO usar calcularDecorridoAgora() aqui: o delta entre init() e anchor (~ms)
    // faz o relógio cruzar segundos ligeiramente antes do Pomodoro, causando 1s de
    // divergência nos ticks próximos a um limite de segundo.
    const decorridoBase = s.decorridoMs;

    const decorridoClampado = s.metaMs > 0
      ? Math.min(decorridoBase, s.metaMs)
      : Math.max(0, decorridoBase);

    this.state.update(st => ({
      ...st,
      pausada: false,
      decorridoMs:     decorridoClampado,
      baseDecorridoMs: decorridoClampado,
      baseAgoraMs:     anchorEpochMs,
    }));

    this.startTicker();
  }

  pause(): number {
    this.stopTicker();
    const decorrido = this.calcularDecorridoAgora();

    this.state.update(s => ({
      ...s,
      decorridoMs: decorrido,
      pausada: true,
    }));

    return Math.floor(decorrido / 1000);
  }

  finish(): void {
    this.stopTicker();
    this.state.update(s => ({
      ...s,
      decorridoMs: s.metaMs,
      finalizada: true,
      pausada: true,
    }));
  }

  stop(): void {
    this.stopTicker();
  }

  reset(): void {
    this.stopTicker();
    this.state.set(IDLE_STATE);
  }

  // ── Tick ───────────────────────────────────────────────────────────────────

  /**
   * Registra o callback no serviço de tick alinhado.
   * NÃO dispara imediatamente — o sinal já contém o valor correto para a UI.
   * Recebe `nowMs` único capturado pelo tick service para coincidir com o Pomodoro.
   */
  private startTicker(): void {
    this.stopTicker();
    this.tick.register(TICK_ID, (nowMs) => this.onTick(nowMs));
  }

  private stopTicker(): void {
    this.tick.unregister(TICK_ID);
  }

  private onTick(nowMs: number): void {
    const st = this.state();
    if (st.pausada || st.finalizada) return;

    const agora = this.calcularDecorridoAgora(nowMs);

    if (st.metaMs > 0 && agora >= st.metaMs) {
      this.finish();
    } else {
      this.state.update(s => ({ ...s, decorridoMs: agora }));
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Calcula o tempo decorrido usando o `nowMs` fornecido pelo tick service (ou Date.now()
   * como fallback para chamadas fora do contexto de tick, e.g. pause()).
   */
  private calcularDecorridoAgora(nowMs = Date.now()): number {
    const s = this.state();
    const delta = nowMs - s.baseAgoraMs;
    const total = s.baseDecorridoMs + delta;
    return s.metaMs > 0 ? Math.min(total, s.metaMs) : Math.max(0, total);
  }
}
