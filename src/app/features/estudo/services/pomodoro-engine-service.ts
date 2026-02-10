import { computed, Injectable, signal } from '@angular/core';

export type PomodoroMode = 'FOCO' | 'PAUSA_CURTA' | 'PAUSA_LONGA';

export interface PomodoroConfig {
  focoMin: number;
  pausaCurtaMin: number;
  pausaLongaMin: number;
  longaACada: number;
}

interface PomodoroState {
  mode: PomodoroMode;
  remainingMs: number;
  running: boolean;
  finished: boolean;
  cicloAtual: number;
  totalCiclos: number;
  focusFinished: boolean;
  overlayVisible: boolean;
  overlayText: string;
  endTime: number;
}

@Injectable({ providedIn: 'root' })
export class PomodoroEngineService {
  // 1. Estado Único e Privado
  private readonly state = signal<PomodoroState>({
    mode: 'FOCO',
    remainingMs: 0,
    running: false,
    finished: false,
    cicloAtual: 1,
    totalCiclos: 4,
    focusFinished: false,
    overlayVisible: false,
    overlayText: '',
    endTime: 0
  });

  private config: PomodoroConfig = {
    focoMin: 25,
    pausaCurtaMin: 5,
    pausaLongaMin: 15,
    longaACada: 4,
  };

  private tickerId?: any;

  // 2. Selectors Públicos (Derivados do estado)
  readonly mode = computed(() => this.state().mode);
  readonly remainingMs = computed(() => this.state().remainingMs);
  readonly running = computed(() => this.state().running);
  readonly finished = computed(() => this.state().finished);
  readonly cicloAtual = computed(() => this.state().cicloAtual);
  readonly totalCiclos = computed(() => this.state().totalCiclos);
  readonly focusFinished = computed(() => this.state().focusFinished);
  readonly overlayVisible = computed(() => this.state().overlayVisible);
  readonly overlayText = computed(() => this.state().overlayText);

  readonly modeLabel = computed(() => {
    const m = this.state().mode;
    return m === 'FOCO' ? 'FOCO' : m.replace('_', ' ');
  });

  readonly isFocusMode = computed(() => this.state().mode === 'FOCO');

  readonly timeLabel = computed(() => {
    const totalSec = Math.floor(this.state().remainingMs / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  // 3. Métodos de Controle
  init(config: PomodoroConfig): void {
    this.stopTicker();
    this.config = config;

    this.state.set({
      mode: 'FOCO',
      remainingMs: config.focoMin * 60_000,
      running: false,
      finished: false,
      cicloAtual: 1,
      totalCiclos: config.longaACada,
      focusFinished: false,
      overlayVisible: false,
      overlayText: '',
      endTime: 0
    });
  }

  restore(snapshot: {
    modo?: PomodoroMode | null;
    cicloIndex?: number | null;
    restanteSeg?: number | null;
    rodando?: boolean;
  }): void {
    const s = this.state();

    let remainingMs = s.remainingMs;

    if (snapshot.restanteSeg != null) {
      remainingMs = snapshot.restanteSeg * 1000;
    }

    const running = !!snapshot.rodando;
    const endTime = running ? Date.now() + remainingMs : 0;

    this.state.update(curr => ({
      ...curr,
      mode: snapshot.modo ?? curr.mode,
      cicloAtual: snapshot.cicloIndex ?? curr.cicloAtual,
      remainingMs,
      running,
      endTime
    }));

    if (running) this.startTicker();
  }


  start(): void {
    const s = this.state();
    if (s.finished) return;

    this.state.update(curr => ({
      ...curr,
      running: true,
      focusFinished: false,
      endTime: Date.now() + curr.remainingMs,
    }));

    this.startTicker();
  }

  pause(): number {
    this.stopTicker();
    const decorrido = this.calculateNow();

    this.state.update(s => ({
      ...s,
      running: false,
      remainingMs: Math.max(0, s.endTime - Date.now())
    }));
    return Math.floor(decorrido / 1000);
  }

  toggle(): void {
    this.state().running ? this.pause() : this.start();
  }

  stop(): void {
    this.stopTicker();
    this.state.update(s => ({ ...s, running: false }));
  }

  skip(): void {
    this.advanceStage();
  }

  closeOverlay(): void {
    const s = this.state();
    const isNextStagePause = s.mode !== 'FOCO' && !s.finished;

    this.state.update(curr => ({
      ...curr,
      overlayVisible: false,
      focusFinished: false,
      // Se for transição para pausa, já prepara o tempo e flag de rodando
      ...(isNextStagePause && {
        remainingMs: this.getStageDuration(curr.mode),
        running: true,
        endTime: Date.now() + this.getStageDuration(curr.mode)
      })
    }));

    if (isNextStagePause) this.startTicker();
  }

  // 4. Lógica Interna Otimizada
  // Dentro do ticker do Pomodoro
  private startTicker(): void {
    this.stopTicker();
    this.tickerId = setInterval(() => {
      const s = this.state();
      // Use Math.floor para segundos para que a interface não "trema"
      const restante = Math.max(0, s.endTime - Date.now());

      if (restante <= 0) {
        this.advanceStage();
      } else {
        this.state.update(curr => ({ ...curr, remainingMs: restante }));
      }
    }, 500); // 500ms é o equilíbrio perfeito para não atrasar a UI
  }


  private stopTicker(): void {
    if (this.tickerId) clearInterval(this.tickerId);
  }

  private advanceStage(): void {
    this.stopTicker();
    const s = this.state();

    if (s.mode === 'FOCO') {
      const isLong = s.cicloAtual % this.config.longaACada === 0;
      const nextMode = isLong ? 'PAUSA_LONGA' : 'PAUSA_CURTA';

      this.state.update(curr => ({
        ...curr,
        mode: nextMode,
        remainingMs: this.getStageDuration(nextMode),
        running: false,
        focusFinished: true,
        overlayVisible: true,
        overlayText: 'Tempo de foco encerrado. Faça uma pausa.'
      }));
      return;
    }

    if (s.cicloAtual >= this.config.longaACada) {
      this.state.update(curr => ({ ...curr, finished: true, running: false, remainingMs: 0 }));
      return;
    }

    // Transição de Pausa -> Novo Foco
    this.state.update(curr => ({
      ...curr,
      cicloAtual: curr.cicloAtual + 1,
      mode: 'FOCO',
      remainingMs: this.getStageDuration('FOCO'),
      running: false,
      overlayVisible: true,
      overlayText: 'Pausa encerrada. Pronto para voltar ao foco?'
    }));
  }

  private getStageDuration(mode: PomodoroMode): number {
    const durations = {
      'FOCO': this.config.focoMin,
      'PAUSA_CURTA': this.config.pausaCurtaMin,
      'PAUSA_LONGA': this.config.pausaLongaMin
    };
    return durations[mode] * 60_000;
  }

  private calculateNow(): number {
    const s = this.state();

    // se nunca iniciou
    if (!s.endTime) return 0;

    const restante = Math.max(0, s.endTime - Date.now());
    const duracaoTotal = this.getStageDuration(s.mode);

    return Math.max(0, duracaoTotal - restante);
  }

}
