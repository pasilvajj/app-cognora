import { Component, Input, Output, EventEmitter, OnDestroy, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';

export type PomodoroMode = 'FOCO' | 'PAUSA_CURTA' | 'PAUSA_LONGA';

export interface PomodoroConfig {
  focoMin: number;
  pausaCurtaMin: number;
  pausaLongaMin: number;
  longaACada: number;
}

@Component({
  selector: 'app-pomodoro-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pomodoro-timer.html',
  styleUrl: './pomodoro-timer.css',
})
export class PomodoroTimer implements OnInit, OnDestroy, OnChanges {
  @Input() enabled = false;
  @Input() config!: PomodoroConfig;
  @Input() sessaoFinalizada = false;
  @Input() sessaoPausada = false;
  
  @Output() stageEnded = new EventEmitter<PomodoroMode>();
  @Output() toggleEnabled = new EventEmitter<boolean>();
  @Output() skipStage = new EventEmitter<void>();
  @Output() modeChanged = new EventEmitter<PomodoroMode>();

  mode: PomodoroMode = 'FOCO';
  cycleIndex = 1;
  remainingMs = 0;
  timeLabel = '25:00';
  
  private pomodoroSub?: Subscription;

  constructor(
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializePomodoro();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['enabled'] || changes['sessaoPausada'] || changes['sessaoFinalizada']) {
      if (this.enabled && !this.sessaoFinalizada) {
        if (this.mode === 'FOCO' && this.sessaoPausada) {
          this.pararTicker();
        } else {
          this.maybeStartTicker();
        }
      } else {
        this.pararTicker();
      }
    }
  }

  ngOnDestroy(): void {
    this.pararTicker();
  }

  private initializePomodoro(): void {
    this.mode = 'FOCO';
    this.cycleIndex = 1;
    this.remainingMs = this.config.focoMin * 60 * 1000;
    this.timeLabel = TempoFormatUtil.formatMsToMMSS(this.remainingMs);
    
    if (this.enabled && !this.sessaoFinalizada && !this.sessaoPausada) {
      this.iniciarTicker();
    }
  }

  onToggleEnabled(): void {
    const newValue = !this.enabled;
    this.toggleEnabled.emit(newValue);
    
    if (!newValue) {
      this.pararTicker();
      return;
    }

    if (this.remainingMs <= 0) {
      this.remainingMs = this.getStageDurationMs(this.mode);
    }

    this.maybeStartTicker();
  }

  onSkipStage(): void {
    this.avancarEtapa();
    this.skipStage.emit();
  }

  maybeStartTicker(): void {
    if (this.sessaoFinalizada) return;
    if (this.mode === 'FOCO' && this.sessaoPausada) return;
    if (!this.enabled) return;

    this.iniciarTicker();
  }

  private iniciarTicker(): void {
    this.pararTicker();

    let last = Date.now();

    this.zone.runOutsideAngular(() => {
      this.pomodoroSub = interval(250).subscribe(() => {
        if (this.mode === 'FOCO' && this.sessaoPausada) return;
        if (this.sessaoFinalizada) return;
        if (!this.enabled) return;

        const now = Date.now();
        const dt = Math.max(0, now - last);
        last = now;

        this.remainingMs = Math.max(0, this.remainingMs - dt);
        const label = TempoFormatUtil.formatMsToMMSS(this.remainingMs);

        this.zone.run(() => {
          this.timeLabel = label;
          this.cdr.markForCheck();
        });

        if (this.remainingMs <= 0) {
          this.zone.run(() => {
            this.onStageEnd();
          });
        }
      });
    });
  }

  private pararTicker(): void {
    if (this.pomodoroSub) {
      this.pomodoroSub.unsubscribe();
      this.pomodoroSub = undefined;
    }
  }

  private onStageEnd(): void {
    this.pararTicker();
    this.remainingMs = 0;
    this.timeLabel = '00:00';
    
    const currentMode = this.mode;
    
    // Se terminou FOCO, avança para pausa imediatamente
    if (currentMode === 'FOCO') {
      this.avancarEtapa();
      // Inicia o ticker da pausa (a sessão estará pausada, então o ticker vai rodar)
      this.maybeStartTicker();
    } else {
      // Se terminou pausa, avança para foco automaticamente
      this.avancarEtapa();
    }
    
    this.stageEnded.emit(currentMode);
  }

  avancarEtapa(): void {
    if (this.mode === 'FOCO') {
      const isLong = (this.cycleIndex % this.config.longaACada) === 0;
      this.mode = isLong ? 'PAUSA_LONGA' : 'PAUSA_CURTA';
      
      this.remainingMs = this.getStageDurationMs(this.mode);
      this.timeLabel = TempoFormatUtil.formatMsToMMSS(this.remainingMs);
      this.modeChanged.emit(this.mode);
      this.maybeStartTicker();
      return;
    }

    this.mode = 'FOCO';
    this.cycleIndex = Math.min(this.config.longaACada, this.cycleIndex + 1);
    if (this.cycleIndex > this.config.longaACada) this.cycleIndex = 1;

    this.remainingMs = this.getStageDurationMs('FOCO');
    this.timeLabel = TempoFormatUtil.formatMsToMMSS(this.remainingMs);
    this.modeChanged.emit(this.mode);
  }

  private getStageDurationMs(mode: PomodoroMode): number {
    if (mode === 'FOCO') return this.config.focoMin * 60 * 1000;
    if (mode === 'PAUSA_LONGA') return this.config.pausaLongaMin * 60 * 1000;
    return this.config.pausaCurtaMin * 60 * 1000;
  }

  get modeLabel(): string {
    if (this.mode === 'FOCO') return 'FOCO';
    if (this.mode === 'PAUSA_CURTA') return 'PAUSA CURTA';
    return 'PAUSA LONGA';
  }

  get isFocusMode(): boolean {
    return this.mode === 'FOCO';
  }
}
