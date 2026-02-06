import { Component, OnDestroy, OnInit, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EstudoApiService, SessaoDetalheDto } from '../../data/estudo-api.service';
import { Subscription, interval, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { PomodoroAlertService } from '../../../../shared/service/pomodoro-alert.service';
import { PomodoroTimer, PomodoroMode, PomodoroConfig } from '../../components/pomodoro-timer/pomodoro-timer';
import { TimerDisplay } from '../../components/timer-display/timer-display';
import { ObservacoesEditor } from '../../components/observacoes-editor/observacoes-editor';
import { PomodoroOverlay } from '../../components/pomodoro-overlay/pomodoro-overlay';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-sessao-estudo-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PomodoroTimer,
    TimerDisplay,
    ObservacoesEditor,
    PomodoroOverlay,
  ],
  templateUrl: './sessao-estudo-page.html',
  styleUrl: './sessao-estudo-page.css',
})
export class SessaoEstudoPage implements OnInit, OnDestroy {
  loading = true;
  sessao?: SessaoDetalheDto;

  // ===== Estado de UI =====
  pausada = false;
  statusLabel = 'Em andamento';
  acaoLoading = false;

  // ===== Tempo principal (ms) =====
  private decorridoMs = 0;
  private metaMs = 0;

  tempoExibido = '0:00';
  tempoMeta = '0:00';
  tempoRestante = '0:00';

  planejadoLabel = '0 min';
  observacoes = '';

  private tickerSub?: Subscription;
  private autoFinalizando = false;

  // Base robusta do ticker (decorrido ao retomar + delta)
  private usarBaseRetomar = false;
  private baseRetomarDecorridoMs = 0;
  private baseRetomarAgoraMs = 0;

  // =========================
  // Pomodoro
  // =========================
  pomodoroConfig: PomodoroConfig = {
    focoMin: 25,
    pausaCurtaMin: 5,
    pausaLongaMin: 15,
    longaACada: 4,
  };
  pomodoroEnabled = false;
  pomodoroMode: PomodoroMode = 'FOCO';
  pomodoroOverlayVisible = false;
  pomodoroOverlayText = '';
  // =========================

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: EstudoApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly pomodoroAlert: PomodoroAlertService,
    private readonly toastr: ToastrService
    
  ) {}

  ngOnInit(): void {
    const idRaw =
      this.route.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('id');

    const sessaoId = Number(idRaw);

    if (!idRaw || Number.isNaN(sessaoId) || sessaoId <= 0) {
      console.error('ID de sessão inválido:', idRaw);
      this.router.navigate(['/estudaAgora']);
      return;
    }

    this.loading = true;

    this.api.getSessao(sessaoId).subscribe({
      next: (s) => {
        this.sessao = s;

        // ===== Planejado =====
        this.planejadoLabel = TempoFormatUtil.minutosParaHorasMin(s.tempoMinutos);
        this.observacoes = s.observacoes ?? '';
        this.metaMs = TempoFormatUtil.minutosParaMs(s.tempoMinutos);

        // ===== Pomodoro configs do ciclo =====
        this.aplicarPomodoroFromSessao(s);
        // ===== Base estudada (vem do banco) =====
        const baseMs = this.getBaseMsFromSessao(s);
        // ===== sessão finalizada =====
        if (s.fim) {
          this.decorridoMs = this.limitarDecorrido(baseMs);
          this.pausada = true;
          this.statusLabel = s.concluido ? 'Concluída' : 'Encerrada';
          this.pararTicker();
          this.atualizarLabels();
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        // ===== sessão pausada =====
        if (s.pausadoEm) {
          this.decorridoMs = this.limitarDecorrido(baseMs);

          this.pausada = true;
          this.statusLabel = 'Pausada';
          this.pararTicker();
          this.atualizarLabels();
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }
        // ===== sessão pronta =====
        if (!s.inicio) {
          this.decorridoMs = 0;
          this.pausada = true;
          this.statusLabel = 'Pronta para iniciar';
          this.pararTicker();
          this.atualizarLabels();
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        // ===== sessão em andamento =====
        this.usarBaseRetomar = true;
        this.baseRetomarDecorridoMs = this.limitarDecorrido(baseMs);
        this.baseRetomarAgoraMs = Date.now();
        this.decorridoMs = this.baseRetomarDecorridoMs;
        this.pausada = false;
        this.statusLabel = 'Em andamento';
        this.iniciarTicker();
        this.atualizarLabels();

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Erro ao carregar sessão', e);
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy(): void {
    this.pararTicker();

    if (this.sessao && !this.sessao.fim) {
      this.api.atualizarObservacoes(this.sessao.id, this.observacoes ?? '').subscribe({
        next: () => {},
        error: () => {},
      });
    }
  }

  // =========================
  // Observações
  // =========================
  onObservacoesChange(value: string): void {
    this.observacoes = value;
  }

  onObservacoesSaveRequest(text: string): void {
    if (!this.sessao) return;
    if (this.sessao.fim) return;

    this.api.atualizarObservacoes(this.sessao.id, text ?? '').subscribe({
      next: (s) => {
        this.sessao = s;
        this.observacoes = s.observacoes ?? '';
      },
      error: (e) => {
        console.error('Erro ao salvar observações', e);
      },
    });
  }

  onPomodoroModeChange(mode: PomodoroMode): void {
    this.pomodoroMode = mode;
  }

  // =========================
  // Tick do cronômetro principal
  // =========================
  private iniciarTicker(): void {
    this.pararTicker();

    this.zone.runOutsideAngular(() => {
      this.tickerSub = interval(250).subscribe(() => {
        if (this.pausada) return;
        if (!this.sessao || this.sessao.fim) return;
        const agora = Date.now();

        if (this.usarBaseRetomar) {
          const delta = agora - this.baseRetomarAgoraMs;
          this.decorridoMs = this.limitarDecorrido(this.baseRetomarDecorridoMs + delta);
        }
        // auto-finaliza quando atingir meta (se quiser manter)
        if (!this.autoFinalizando && this.metaMs > 0 && this.decorridoMs >= this.metaMs) {
          this.autoFinalizando = true;
          this.decorridoMs = this.metaMs;

          this.zone.run(() => {
            this.atualizarLabels();
            this.cdr.detectChanges();
            this.pararTicker();
            this.finalizar(true);
          });
          return;
        }

        this.zone.run(() => {
          this.atualizarLabels();
          this.cdr.markForCheck();
        });
      });
    });
  }

  private pararTicker(): void {
    if (this.tickerSub) {
      this.tickerSub.unsubscribe();
      this.tickerSub = undefined;
    }
  }

  private limitarDecorrido(ms: number): number {
    const safe = Math.max(0, ms);
    if (this.metaMs > 0) return Math.min(safe, this.metaMs);
    return safe;
  }

  private atualizarLabels(): void {
    this.tempoExibido = TempoFormatUtil.msParaRelogio(this.decorridoMs, 'floor');
    this.tempoMeta = TempoFormatUtil.msParaRelogio(this.metaMs, 'floor');

    const restante = Math.max(0, this.metaMs - this.decorridoMs);
    this.tempoRestante = TempoFormatUtil.msParaRelogio(restante, 'ceil');
  }

  private getBaseMsFromSessao(s: SessaoDetalheDto): number {
    const baseSeg = Number((s as any).estudadoTotalSeg ?? 0);
    const safeSeg = Number.isFinite(baseSeg) ? Math.max(0, Math.floor(baseSeg)) : 0;
    return safeSeg * 1000;
  }

  // =========================
  // API: pausar (único ponto)
  // =========================
  private pausarSessaoNoBackend(): Observable<SessaoDetalheDto> {
    if (!this.sessao) return of(null as any);

    const id = this.sessao.id;
    const estudadoSeg = Math.max(0, Math.floor(this.decorridoMs / 1000));

    return this.api.pausarSessao(id, estudadoSeg).pipe(
      map((s) => {
        this.sessao = s;

        const baseMs = this.getBaseMsFromSessao(s);
        this.decorridoMs = this.limitarDecorrido(baseMs);
        this.acaoLoading = false;
        this.atualizarLabels();
        this.cdr.detectChanges();
        return s;
      }),
      catchError((e) => {
        this.acaoLoading = false;
        this.cdr.detectChanges();
        throw e;
      })
    );
  }

  // =========================
  // Botão principal (iniciar/pausar/retomar)
  // =========================
  onMainActionClick(): void {
    if (!this.sessao || this.sessao.fim) return;
    if (this.acaoLoading) return;

    if (this.statusLabel === 'Pronta para iniciar') {
      this.comecarSessaoNoBackend();
      return;
    }
    if (this.pausada) {
      this.retomarSessao();
    } else {
      this.pausarSessao();
    }
  }

  private comecarSessaoNoBackend(): void {
    if (!this.sessao || this.sessao.fim) return;

    this.acaoLoading = true;

    this.api.comecarSessao(this.sessao.id).subscribe({
      next: (s) => {
        this.sessao = s;

        const baseMs = this.getBaseMsFromSessao(s);
        this.usarBaseRetomar = true;
        this.baseRetomarDecorridoMs = this.limitarDecorrido(baseMs);
        this.baseRetomarAgoraMs = Date.now();
        this.decorridoMs = this.baseRetomarDecorridoMs;
        this.pausada = false;
        this.statusLabel = 'Em andamento';
        this.acaoLoading = false;
        this.iniciarTicker();
        this.atualizarLabels();
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Erro ao começar sessão', e);
        this.acaoLoading = false;

        this.pausada = true;
        this.statusLabel = 'Pronta para iniciar';
        this.cdr.detectChanges();
      },
    });
  }

  private pausarSessao(): void {
    if (!this.sessao || this.sessao.fim) return;

    this.acaoLoading = true;

    // congela UI
    this.pararTicker();
    this.decorridoMs = this.limitarDecorrido(this.decorridoMs);
    this.pausada = true;
    this.statusLabel = 'Pausada';
    this.usarBaseRetomar = false;
    this.atualizarLabels();
    this.cdr.detectChanges();

    this.pausarSessaoNoBackend().subscribe({
      next: () => {},
      error: (e) => {
        console.error('Erro ao pausar sessão', e);

        this.acaoLoading = false;
        this.pausada = false;
        this.statusLabel = 'Em andamento';

        this.usarBaseRetomar = true;
        this.baseRetomarDecorridoMs = this.decorridoMs;
        this.baseRetomarAgoraMs = Date.now();

        this.iniciarTicker();

        this.cdr.detectChanges();
      },
    });
  }

  private retomarSessao(): void {
    if (!this.sessao || this.sessao.fim) return;

    this.acaoLoading = true;

    this.api.retomarSessao(this.sessao.id).subscribe({
      next: (s) => {
        this.sessao = s;

        const baseMs = this.getBaseMsFromSessao(s);
        this.usarBaseRetomar = true;
        this.baseRetomarDecorridoMs = this.limitarDecorrido(baseMs);
        this.baseRetomarAgoraMs = Date.now();
        this.decorridoMs = this.baseRetomarDecorridoMs;
        this.pausada = false;
        this.statusLabel = 'Em andamento';
        this.acaoLoading = false;
        this.iniciarTicker();
        this.atualizarLabels();
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Erro ao retomar sessão', e);

        this.acaoLoading = false;
        this.pausada = true;
        this.statusLabel = 'Pausada';
        this.cdr.detectChanges();
      },
    });
  }

  finalizar(concluido: boolean): void {
    if (!this.sessao) return;
    this.decorridoMs = this.limitarDecorrido(this.decorridoMs);
    this.pararTicker();
    this.usarBaseRetomar = false;
    this.acaoLoading = false;

    const payload: any = {
      id: this.sessao.id,
      concluido,
      observacoes: this.observacoes ?? '',
    };

    this.api.finalizarSessao(payload).subscribe({
      next: (sAtualizada) => {
        this.sessao = sAtualizada;

        this.pausada = true;
        this.statusLabel = concluido ? 'Concluída' : 'Encerrada';

        if (concluido === true) {
        // Finalização por meta → trava exatamente na meta
          this.decorridoMs = this.metaMs;
        } else {
          // Encerramento manual → usa o backend
          const baseMs = this.getBaseMsFromSessao(sAtualizada);
          this.decorridoMs = this.limitarDecorrido(baseMs);
        }
        this.atualizarLabels();
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Erro ao finalizar sessão', e);
        if (this.sessao && !this.sessao.fim && !this.pausada) {
          this.usarBaseRetomar = true;
          this.baseRetomarDecorridoMs = this.decorridoMs;
          this.baseRetomarAgoraMs = Date.now();
          this.iniciarTicker();
        }
      },
    });
  }

  // =========================
  // Pomodoro
  // =========================
  private aplicarPomodoroFromSessao(s: SessaoDetalheDto): void {
    const ativo = Boolean((s as any).pomodoroAtivo);
    this.pomodoroEnabled = ativo;

    this.pomodoroConfig = {
      focoMin: Number((s as any).pomodoroFocoMin ?? 25),
      pausaCurtaMin: Number((s as any).pomodoroPausaCurtaMin ?? 5),
      pausaLongaMin: Number((s as any).pomodoroPausaLongaMin ?? 15),
      longaACada: Number((s as any).pomodoroLongaACada ?? 4),
    };

    this.pomodoroMode = 'FOCO';
    this.pomodoroOverlayVisible = false;
    this.pomodoroOverlayText = '';
  }

  onPomodoroToggle(enabled: boolean): void {
    this.pomodoroEnabled = enabled;
  }

  onPomodoroStageEnd(mode: PomodoroMode): void {
    this.pomodoroAlert.play();
    this.abrirOverlayPomodoro();

    if (mode === 'FOCO') {
      // Termina foco → pausa sessão e entra em pausa
      if (!this.pausada && this.sessao && !this.sessao.fim) {
        this.pausarSessaoPorPomodoro();
      }
    }
    // Se terminou pausa, o componente PomodoroTimer já avança automaticamente
  }

  private pausarSessaoPorPomodoro(): void {
    if (!this.sessao || this.sessao.fim) return;

    this.pararTicker();
    this.decorridoMs = this.limitarDecorrido(this.decorridoMs);
    this.pausada = true;
    this.statusLabel = 'Pausada';
    this.usarBaseRetomar = false;
    this.atualizarLabels();
    this.cdr.detectChanges();
    this.acaoLoading = true;

    this.pausarSessaoNoBackend().subscribe({
      next: () => {
        this.acaoLoading = false;
      },
      error: (e) => {
        console.error('Erro ao pausar por Pomodoro', e);
        this.acaoLoading = false;
        this.pausada = false;
        this.statusLabel = 'Em andamento';

        this.usarBaseRetomar = true;
        this.baseRetomarDecorridoMs = this.decorridoMs;
        this.baseRetomarAgoraMs = Date.now();

        this.iniciarTicker();
        this.cdr.detectChanges();
      },
    });
  }

  onPomodoroSkipStage(): void {
    this.fecharOverlayPomodoro();

    // Se estava em foco, ao pular a etapa vamos para pausa e pausamos a sessão
    if (this.pomodoroMode === 'FOCO' && !this.pausada && this.sessao && !this.sessao.fim) {
      this.pausarSessaoPorPomodoro();
    }
    // Se estava em pausa, apenas avança para foco (o componente faz isso)
  }

  private abrirOverlayPomodoro(): void {
    this.pomodoroOverlayVisible = true;

    if (this.pomodoroMode === 'FOCO') {
      this.pomodoroOverlayText = `Pausa curta encerrada. Quando estiver pronto, retome o foco.`;
    } else if (this.pomodoroMode === 'PAUSA_CURTA') {
      this.pomodoroOverlayText = `Tempo de foco encerrado. Faça uma pausa agora.`;
    } else {
      this.pomodoroOverlayText = `Pausa longa encerrada. Quando estiver pronto, retome o foco.`;
    }
  }

  fecharOverlayPomodoro(): void {
    this.pomodoroOverlayVisible = false;
  }

  onPomodoroNextStage(): void {
    this.fecharOverlayPomodoro();
    // O componente PomodoroTimer avança a etapa automaticamente
  }
  // =========================
  // Voltar / Guard
  // =========================
  voltar(): void {
    if (!this.sessao) {
      this.router.navigate(['/estudaAgora']);
      return;
    }

    const precisaPausar = !this.pausada && !this.sessao.fim;
    if (precisaPausar) {
      if (this.acaoLoading) return;
      this.pausarSessaoEVoltar();
      return;
    }

    this.navegarParaEstudarAgora();
  }

  private pausarSessaoEVoltar(): void {
    if (!this.sessao || this.sessao.fim) {
      this.navegarParaEstudarAgora();
      return;
    }

    this.pararTicker();
    this.decorridoMs = this.limitarDecorrido(this.decorridoMs);
    this.pausada = true;
    this.statusLabel = 'Pausada';
    this.usarBaseRetomar = false;
    this.atualizarLabels();
    this.cdr.detectChanges();
    this.acaoLoading = true;
    this.pausarSessaoNoBackend().subscribe({
      next: () => this.navegarParaEstudarAgora(),
      error: (e) => {
        console.error('Erro ao pausar automaticamente antes de voltar', e);
        this.navegarParaEstudarAgora();
      },
    });
  }
    // =========================
  // Guard: PauseSessionGuard
  // =========================
  devePausarAntesDeSair(): boolean {
    return !!this.sessao && !this.sessao.fim && !this.pausada && !this.acaoLoading;
  }

  pausarAntesDeSair(): Observable<boolean> {
    if (!this.sessao || this.sessao.fim) return of(true);

    // congela UI
    this.pararTicker();

    this.decorridoMs = this.limitarDecorrido(this.decorridoMs);
    this.pausada = true;
    this.statusLabel = 'Pausada';
    this.usarBaseRetomar = false;
    this.atualizarLabels();
    this.cdr.detectChanges();
    this.acaoLoading = true;
    return this.pausarSessaoNoBackend().pipe(map(() => true));
  }

  private navegarParaEstudarAgora(): void {
    const cicloId = (this.sessao as any)?.cicloId;

    if (!cicloId) {
      this.router.navigate(['/estudaAgora']);
      return;
    }

    this.router.navigate(['/estudaAgora', cicloId]);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    if (!this.sessao || this.sessao.fim) return;
    if (this.pausada) return;

    this.pararTicker();

    this.decorridoMs = this.limitarDecorrido(this.decorridoMs);
    this.pausada = true;
    this.statusLabel = 'Pausada';

    try {
      this.pausarSessaoNoBackend().subscribe({ next: () => {}, error: () => {} });
    } catch {}
  }
}