import { computed, inject, Injectable, signal } from '@angular/core';

import { StudyAlignedSecondTickService, alinharEpochAoSegundo } from './study-aligned-second-tick.service';
import { StudyAlertSoundService } from './study-alert-sound.service';

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type PomodoroMode = 'FOCO' | 'PAUSA_CURTA' | 'PAUSA_LONGA';

export interface PomodoroConfig {
  focoMin: number;
  pausaCurtaMin: number;
  pausaLongaMin: number;
  longaACada: number;
}

// ── Estado interno ─────────────────────────────────────────────────────────────

interface PomodoroState {
  readonly mode: PomodoroMode;
  /**
   * Segundos inteiros restantes no momento do anchor — FONTE CANÔNICA DE VERDADE.
   * Nunca sofre drift: é um inteiro definido uma única vez por restore()/init().
   */
  readonly restanteSegBase: number;
  /**
   * Epoch ms em que o timer foi ancorado (startAt / realinharAnchor / closeOverlay).
   * 0 quando pausado. Usado em conjunto com restanteSegBase para derivar o display:
   *   remainingSec = restanteSegBase − floor((nowMs − anchorMs) / 1000)
   */
  readonly anchorMs: number;
  /**
   * Ms derivados de (restanteSegBase − elapsedSec) × 1000 a cada tick.
   * Apenas para leitura de sinais externos; não é a fonte de verdade.
   */
  readonly remainingMs: number;
  readonly running: boolean;
  readonly finished: boolean;
  readonly cicloAtual: number;
  readonly totalCiclos: number;
  readonly focusFinished: boolean;
  readonly overlayVisible: boolean;
  readonly overlayText: string;
}

const IDLE_STATE: PomodoroState = {
  mode:            'FOCO',
  restanteSegBase: 0,
  anchorMs:        0,
  remainingMs:     0,
  running:         false,
  finished:        false,
  cicloAtual:      1,
  totalCiclos:     4,
  focusFinished:   false,
  overlayVisible:  false,
  overlayText:     '',
};

const TICK_ID = 'pomodoro-engine';

// ── Serviço ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PomodoroEngineService {
  private readonly tick = inject(StudyAlignedSecondTickService);
  private readonly sounds = inject(StudyAlertSoundService);
  private readonly state = signal<PomodoroState>(IDLE_STATE);
  private config: PomodoroConfig = { focoMin: 25, pausaCurtaMin: 5, pausaLongaMin: 15, longaACada: 4 };

  /**
   * Incrementado quando o relógio conclui uma etapa sozinho (ex.: pausa curta → FOCO).
   * A página de sessão faz POST do estado Pomodoro para o servidor.
   * Não incrementa em “Pular etapa” (origem utilizador) — aí o próprio componente envia.
   */
  private readonly _pomodoroServerSyncTick = signal(0);
  readonly pomodoroServerSyncTick = this._pomodoroServerSyncTick.asReadonly();

  private schedulePomodoroServerSyncAfterTimer(): void {
    this._pomodoroServerSyncTick.update((v) => v + 1);
  }

  // ── Selectors ───────────────────────────────────────────────────────────────

  readonly mode           = computed(() => this.state().mode);
  readonly remainingMs    = computed(() => this.state().remainingMs);
  readonly running        = computed(() => this.state().running);
  readonly finished       = computed(() => this.state().finished);
  readonly cicloAtual     = computed(() => this.state().cicloAtual);
  readonly totalCiclos    = computed(() => this.state().totalCiclos);
  readonly focusFinished  = computed(() => this.state().focusFinished);
  readonly overlayVisible = computed(() => this.state().overlayVisible);
  readonly overlayText    = computed(() => this.state().overlayText);
  readonly isFocusMode    = computed(() => this.state().mode === 'FOCO');

  /**
   * Retorna os segundos restantes ATUAIS calculados em tempo real a partir do anchor.
   * Diferente de `remainingMs`, não depende de um tick ter disparado recentemente —
   * útil para capturar o progresso do break antes de reconstruir o estado via API.
   */
  restanteSegAtual(): number {
    const s = this.state();
    if (!s.running || !s.anchorMs) return s.restanteSegBase;
    return Math.max(0, s.restanteSegBase - Math.floor((Date.now() - s.anchorMs) / 1000));
  }

  readonly modeLabel = computed(() => {
    const m = this.state().mode;
    return m === 'FOCO' ? 'FOCO' : m.replace('_', ' ');
  });

  /**
   * Exibe o tempo restante da etapa.
   *
   * Como remainingMs é sempre múltiplo exato de 1000
   * (restanteSegBase × 1000, sem frações), Math.round produz o inteiro correto.
   * Não há ambiguidade entre floor/ceil — ambos dariam o mesmo resultado.
   */
  readonly timeLabel = computed(() => {
    const totalSec = Math.max(0, Math.round(this.state().remainingMs / 1000));
    const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  });

  // ── Ciclo de vida ────────────────────────────────────────────────────────────

  init(config: PomodoroConfig): void {
    this.stopTicker();
    this.config = config;
    const focoSeg = config.focoMin * 60;
    this.state.set({
      ...IDLE_STATE,
      restanteSegBase: focoSeg,
      remainingMs:     focoSeg * 1000,
      totalCiclos:     config.longaACada,
    });
  }

  /**
   * Restaura o estado a partir de um snapshot da API (ao carregar ou retomar).
   *
   * Define restanteSegBase — inteiro exato — que será a base de todos os
   * cálculos subsequentes. anchorMs é zerado; o coordenador irá defini-lo
   * via startAt() ou realinharAnchor() com o mesmo instante da sessão.
   */
  restore(snapshot: {
    modo?: PomodoroMode | null;
    cicloIndex?: number | null;
    restanteSeg?: number | null;
    rodando?: boolean;
    anchorEpochMs?: number;
    deferTicker?: boolean;
  }): void {
    this.stopTicker();

    const curr = this.state();
    const restanteSegBase = snapshot.restanteSeg != null
      ? Math.max(0, snapshot.restanteSeg)
      : curr.restanteSegBase;

    const running = !!snapshot.rodando;

    this.state.update(s => ({
      ...s,
      mode:            snapshot.modo      ?? s.mode,
      cicloAtual:      snapshot.cicloIndex ?? s.cicloAtual,
      restanteSegBase,
      remainingMs:     restanteSegBase * 1000,
      anchorMs:        0,
      running,
      focusFinished:   false,
      overlayVisible:  false,
      overlayText:     '',
    }));

    if (running && !snapshot.deferTicker) {
      this.startAt(snapshot.anchorEpochMs ?? Date.now());
    }
  }

  /**
   * Reabre o modal de alerta após reload (persistido em localStorage).
   * Não inicia o cronômetro da pausa — isso ocorre só em `closeOverlay()`.
   */
  applyPendingOverlay(p: { texto: string; focusFinished: boolean }): void {
    this.state.update(s => ({
      ...s,
      overlayVisible: true,
      overlayText:    p.texto,
      focusFinished:  p.focusFinished,
    }));
  }

  // ── Controles ────────────────────────────────────────────────────────────────

  /**
   * Ancora o timer em `anchorMs` e inicia a contagem.
   * Deve ser o MESMO instante passado ao SessionTimerService.startAt().
   */
  startAt(anchorMs: number): void {
    const s = this.state();
    if (s.finished || s.running) return;

    const alignedAnchor = alinharEpochAoSegundo(anchorMs);

    this.state.update(curr => ({
      ...curr,
      running:   true,
      focusFinished: false,
      anchorMs:  alignedAnchor,
    }));

    this.startTicker();
    this.onTick(alignedAnchor);
  }

  /**
   * Quando o Pomodoro já está `running` (após restore com rodando=true),
   * apenas substitui o anchorMs pelo anchor compartilhado com a sessão.
   *
   * restanteSegBase já foi definido por restore() com o valor correto do
   * servidor — não há necessidade de recomputar nada a partir de endTime.
   * Isso elimina o salto causado por anchors stale de closeOverlay().
   */
  realinharAnchor(anchorMs: number): void {
    const s = this.state();
    if (!s.running || s.finished) return;

    const alignedAnchor = alinharEpochAoSegundo(anchorMs);

    this.state.update(curr => ({ ...curr, anchorMs: alignedAnchor }));
    this.startTicker();
    this.onTick(alignedAnchor);
  }

  pause(): void {
    this.stopTicker();
    const s = this.state();

    // Computa o restante atual pela mesma fórmula do onTick.
    const remainingSec = (s.running && s.anchorMs)
      ? Math.max(0, s.restanteSegBase - Math.floor((Date.now() - s.anchorMs) / 1000))
      : s.restanteSegBase;

    this.state.update(curr => ({
      ...curr,
      running:         false,
      restanteSegBase: remainingSec,
      remainingMs:     remainingSec * 1000,
      anchorMs:        0,
    }));
  }

  stop(): void {
    this.stopTicker();
    this.state.update(s => ({ ...s, running: false, anchorMs: 0 }));
  }

  /** Congela o restante actual (preferir a {@link stop} ao sair da página). */
  freeze(): void {
    this.pause();
  }

  skip(): void {
    const s = this.state();
    if (s.finished) return;

    // Na pausa (curta ou longa): pular etapa = ir direto ao FOCO, sem modal intermediário.
    if (s.mode === 'PAUSA_CURTA' || s.mode === 'PAUSA_LONGA') {
      this.transitionBreakToFoco(false, 'skip');
      return;
    }

    this.avancarEtapa();
  }

  toggle(): void {
    this.state().running ? this.pause() : this.startAt(Date.now());
  }

  /** Fecha o modal sem alterar o timer (após sincronizar com a API). */
  dismissOverlay(): void {
    this.state.update(curr => ({
      ...curr,
      overlayVisible: false,
      focusFinished:  false,
    }));
  }

  /**
   * Fecha o modal e, se for transição para pausa, inicia a etapa de descanso.
   * anchorMs é capturado aqui para que onTick compute a contagem regressiva
   * a partir deste instante — independente de qualquer Retomar posterior.
   */
  closeOverlay(): void {
    const s = this.state();
    const isTransicaoParaPausa = s.mode !== 'FOCO' && !s.finished;

    if (isTransicaoParaPausa) {
      const duracaoSeg = this.duracaoEtapaSeg(s.mode);
      const anchorMs   = alinharEpochAoSegundo();

      this.state.update(curr => ({
        ...curr,
        overlayVisible:  false,
        focusFinished:   false,
        restanteSegBase: duracaoSeg,
        remainingMs:     duracaoSeg * 1000,
        anchorMs,
        running:         true,
      }));

      this.startTicker();
      this.onTick(anchorMs);
    } else {
      // Fechando overlay de retorno ao foco.
      if (s.mode === 'FOCO' && !s.finished) {
        this.sounds.playBackToStudy();
      }

      this.state.update(curr => ({
        ...curr,
        overlayVisible: false,
        focusFinished:  false,
      }));
    }
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────

  private startTicker(): void {
    this.stopTicker();
    this.tick.register(TICK_ID, (nowMs) => this.onTick(nowMs));
  }

  private stopTicker(): void {
    this.tick.unregister(TICK_ID);
  }

  /**
   * Fórmula canônica — idêntica ao SessionTimerService:
   *
   *   remainingSec = restanteSegBase − floor((nowMs − anchorMs) / 1000)
   *
   * Como nowMs é capturado UMA vez pelo StudyAlignedSecondTickService e
   * passado a todos os callbacks, e anchorMs é o MESMO para sessão e Pomodoro
   * (definido pelo coordenador), a sincronização é garantida por aritmética
   * inteira — sem possibilidade de drift de ±1 s.
   */
  private onTick(nowMs: number): void {
    const s = this.state();
    if (!s.running || s.finished || !s.anchorMs) return;

    const elapsedSec   = Math.floor((nowMs - s.anchorMs) / 1000);
    const remainingSec = s.restanteSegBase - elapsedSec;

    if (remainingSec <= 0) {
      this.avancarEtapa();
    } else {
      this.state.update(curr => ({
        ...curr,
        remainingMs: remainingSec * 1000,
      }));
    }
  }

  // ── Lógica de etapas ─────────────────────────────────────────────────────────

  private avancarEtapa(): void {
    this.stopTicker();
    const s = this.state();

    if (s.mode === 'FOCO') {
      const proxMode   = s.cicloAtual % this.config.longaACada === 0
        ? 'PAUSA_LONGA'
        : 'PAUSA_CURTA';
      const duracaoSeg = this.duracaoEtapaSeg(proxMode);
      this.sounds.playFocusEnded();

      this.state.update(curr => ({
        ...curr,
        mode:            proxMode,
        restanteSegBase: duracaoSeg,
        remainingMs:     duracaoSeg * 1000,
        anchorMs:        0,
        running:         false,
        focusFinished:   true,
        overlayVisible:  true,
        overlayText:     'Tempo de foco encerrado. Faça uma pausa.',
      }));
      return;
    }

    if (s.cicloAtual >= this.config.longaACada) {
      this.state.update(curr => ({
        ...curr,
        finished:        true,
        running:         false,
        restanteSegBase: 0,
        remainingMs:     0,
        anchorMs:        0,
      }));
      this.schedulePomodoroServerSyncAfterTimer();
      return;
    }

    this.transitionBreakToFoco(true, 'timer');
  }

  /**
   * Fim natural do descanso (cronômetro zerou) ou “Pular etapa” na pausa.
   * `mostrarOverlay`: true quando o tempo da pausa acabou (modal antes de voltar ao foco); false ao pular etapa.
   */
  private transitionBreakToFoco(mostrarOverlay: boolean, origem: 'timer' | 'skip'): void {
    this.stopTicker();
    const s = this.state();

    if (s.cicloAtual >= this.config.longaACada) {
      this.state.update(curr => ({
        ...curr,
        finished:        true,
        running:         false,
        restanteSegBase: 0,
        remainingMs:     0,
        anchorMs:        0,
      }));
      if (origem === 'timer') {
        this.schedulePomodoroServerSyncAfterTimer();
      }
      return;
    }

    const focoSeg = this.duracaoEtapaSeg('FOCO');
    this.sounds.playBreakEnded();
    this.state.update(curr => ({
      ...curr,
      cicloAtual:      curr.cicloAtual + 1,
      mode:            'FOCO',
      restanteSegBase: focoSeg,
      remainingMs:     focoSeg * 1000,
      anchorMs:        0,
      running:         false,
      overlayVisible:  mostrarOverlay,
      overlayText:     mostrarOverlay ? 'Pausa encerrada. Pronto para voltar ao foco?' : '',
      focusFinished:   false,
    }));
    if (origem === 'timer') {
      this.schedulePomodoroServerSyncAfterTimer();
    }
  }

  private duracaoEtapaSeg(mode: PomodoroMode): number {
    const map: Record<PomodoroMode, number> = {
      FOCO:        this.config.focoMin,
      PAUSA_CURTA: this.config.pausaCurtaMin,
      PAUSA_LONGA: this.config.pausaLongaMin,
    };
    return map[mode] * 60;
  }
}
