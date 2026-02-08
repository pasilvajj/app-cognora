import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { map, Observable, of } from 'rxjs';

import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { ObservacoesEditor } from '../../components/observacoes-editor/observacoes-editor';
import { PomodoroTimer } from '../../components/pomodoro-timer/pomodoro-timer';
import { TimerDisplay } from '../../components/timer-display/timer-display';
import { EstudoApiService } from '../../data/estudo-api.service';
import { SessaoDetalheDto } from '../../data/estudo.models';

import { PomodoroOverlay } from '../../components/pomodoro-overlay/pomodoro-overlay';
import { PomodoroEngineService } from '../../services/pomodoro-engine-service';
import { SessionTimerService } from '../../services/session-timer-service';

@Component({
  selector: 'app-sessao-estudo-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, PomodoroTimer, TimerDisplay, ObservacoesEditor, PomodoroOverlay],
  templateUrl: './sessao-estudo-page.html',
  styleUrl: './sessao-estudo-page.css',
})
export class SessaoEstudoPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EstudoApiService);
  private readonly pomodoro = inject(PomodoroEngineService);
  readonly timer = inject(SessionTimerService);


  // ================= STATE =================

  loading = signal(true);
  sessao?: SessaoDetalheDto;

  observacoes = '';
  tempoPlanejado = '';

  statusLabel = signal('Carregando...');
  acaoLoading = signal(false);
  pomodoroEnabled = signal(false);

  // ================= POMODORO VIEW MODEL =================

  readonly pomodoroMode = computed(() => this.pomodoro.mode());
  readonly pomodoroTexto = computed(() => this.pomodoro.overlayText());
  readonly pomodoroVisible = computed(() => this.pomodoro.overlayVisible());

  // ================= INIT =================

  ngOnInit(): void {
    const idRaw =
      this.route.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('id');

    const sessaoId = Number(idRaw);

    if (!idRaw || Number.isNaN(sessaoId) || sessaoId <= 0) {
      this.router.navigate(['/estudaAgora']);
      return;
    }

    this.api.getSessao(sessaoId).subscribe({
      next: (s) => this.initSessao(s),
      error: () => this.loading.set(false),
    });

    // 🔥 pausa automática quando FOCO termina
    effect(() => {
      if (!this.pomodoro.focusFinished()) return;

      // pausa cronômetro principal
      if (!this.timer.pausada() && !this.timer.finalizada()) {
        this.pausarSessao();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.sessao && !this.sessao.fim) {
      this.api.atualizarObservacoes(this.sessao.id, this.observacoes).subscribe();
    }
  }

  // ================= INIT HELPER =================

  private initSessao(s: SessaoDetalheDto): void {
    this.sessao = s;

    const metaMs = TempoFormatUtil.minutosParaMs(s.tempoMinutos);
    const baseMs = this.getBaseMsFromSessao(s);

    this.tempoPlanejado = TempoFormatUtil.minutosParaHorasMin(s.tempoMinutos);
    this.observacoes = s.observacoes ?? '';

    this.timer.init(metaMs, baseMs, !!s.pausadoEm || !s.inicio, !!s.fim);

    if (s.fim) this.statusLabel.set(s.concluido ? 'Concluída' : 'Encerrada');
    else if (s.pausadoEm) this.statusLabel.set('Pausada');
    else if (!s.inicio) this.statusLabel.set('Pronta para iniciar');
    else this.statusLabel.set('Em andamento');

    if (s.pomodoroAtivo) {
      this.pomodoroEnabled.set(true);

      this.pomodoro.init({
        focoMin: Number(s.pomodoroFocoMin ?? 25),
        pausaCurtaMin: Number(s.pomodoroPausaCurtaMin ?? 5),
        pausaLongaMin: Number(s.pomodoroPausaLongaMin ?? 15),
        longaACada: Number(s.pomodoroLongaACada ?? 4),
      });
    }

    this.loading.set(false);
  }

  private getBaseMsFromSessao(s: SessaoDetalheDto): number {
    return Math.max(0, Math.floor(Number((s as any).estudadoTotalSeg ?? 0))) * 1000;
  }

  // ================= BOTÃO PRINCIPAL =================

  onMainActionClick(): void {
    if (!this.sessao || this.timer.finalizada() || this.acaoLoading()) return;

    if (this.statusLabel() === 'Pronta para iniciar') return this.comecar();
    if (this.timer.pausada()) return this.retomar();

    this.pausarSessao();
  }

  private comecar(): void {
    this.acaoLoading.set(true);

    this.api.comecarSessao(this.sessao!.id).subscribe({
      next: (s) => {
        this.initSessao(s);
        this.timer.start();
        this.pomodoro.start();
        this.pomodoro.closeOverlay();
        this.statusLabel.set('Em andamento');
        this.acaoLoading.set(false);
      },
      error: () => this.acaoLoading.set(false),
    });
  }

  private pausarSessao(): void {
    if (!this.sessao) return;

    this.acaoLoading.set(true);

    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();

    this.api.pausarSessao(this.sessao.id, estudadoSeg).subscribe({
      next: (s) => {
        this.initSessao(s);
        this.statusLabel.set('Pausada');
        this.acaoLoading.set(false);
      },
      error: () => this.acaoLoading.set(false),
    });
  }

  private retomar(): void {
    this.acaoLoading.set(true);

    this.api.retomarSessao(this.sessao!.id).subscribe({
      next: (s) => {
        this.initSessao(s);
        this.timer.start();
        this.pomodoro.start();
        this.pomodoro.closeOverlay();
        this.statusLabel.set('Em andamento');
        this.acaoLoading.set(false);
      },
      error: () => this.acaoLoading.set(false),
    });
  }

  finalizar(concluido: boolean): void {
    if (!this.sessao) return;

    this.timer.finish();

    this.api.finalizarSessao({
      id: this.sessao.id,
      concluido,
      observacoes: this.observacoes,
    }).subscribe((s) => this.initSessao(s));
  }

  // ================= POMODORO EVENTS =================

  onPomodoroSkipStage(): void {
    this.pomodoro.skip();
  }

  onPomodoroCloseOverlay(): void {
    this.pomodoro.closeOverlay();
  }

  onPomodoroNextStage(): void {
    this.pomodoro.skip();
  }

  // ================= GUARD =================

  devePausarAntesDeSair(): boolean {
    return !!this.sessao && !this.timer.finalizada() && !this.timer.pausada();
  }

  pausarAntesDeSair(): Observable<boolean> {
    if (!this.sessao || this.timer.finalizada()) return of(true);

    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();

    return this.api.pausarSessao(this.sessao.id, estudadoSeg).pipe(map(() => true));
  }

  // ================= OBSERVAÇÕES =================

  onObservacoesChange(value: string): void {
    this.observacoes = value;
  }

  onObservacoesSaveRequest(text: string): void {
    if (!this.sessao || this.sessao.fim) return;

    this.api.atualizarObservacoes(this.sessao.id, text ?? '').subscribe((s) => {
      this.sessao = s;
      this.observacoes = s.observacoes ?? '';
    });
  }

  // ================= VOLTAR =================

  voltar(): void {
    this.router.navigate(['/estudaAgora', (this.sessao as any)?.cicloId]);
  }

  @HostListener('window:beforeunload')
  beforeUnload(): void {
    if (!this.sessao || this.timer.finalizada() || this.timer.pausada()) return;

    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();
    this.api.pausarSessao(this.sessao.id, estudadoSeg).subscribe();
  }
}