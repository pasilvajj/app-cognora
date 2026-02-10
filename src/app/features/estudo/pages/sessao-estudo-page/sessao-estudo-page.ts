import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, OnDestroy, resource, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom, map, Observable, of } from 'rxjs';

import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { ObservacoesEditor } from '../../components/observacoes-editor/observacoes-editor';
import { PomodoroOverlay } from '../../components/pomodoro-overlay/pomodoro-overlay';
import { PomodoroTimer } from '../../components/pomodoro-timer/pomodoro-timer';
import { TimerDisplay } from '../../components/timer-display/timer-display';
import { EstudoApiService } from '../../data/estudo-api.service';
import { SessaoDetalheDto } from '../../data/estudo.models';
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
export class SessaoEstudoPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EstudoApiService);

  readonly pomodoro = inject(PomodoroEngineService);
  readonly timer = inject(SessionTimerService);

  // ================= STATE =================
  observacoes = signal('');
  tempoPlanejado = signal('');
  acaoLoading = signal(false);
  pomodoroEnabled = signal(false);

  private readonly params = toSignal(this.route.paramMap);

  private readonly sessaoId = computed(() => {
    const id = this.params()?.get('id') ?? this.route.parent?.snapshot.paramMap.get('id');
    return Number(id);
  });

  // ================= RESOURCE =================
  readonly sessaoResource = resource({
    params: () => this.sessaoId(),
    loader: async ({ params: id }) => {
      if (!id || isNaN(id) || id <= 0) return null;
      const dados = await this.api.getSessao1(id);
      untracked(() => this.initSessao(dados));
      return dados;
    },
  });

  readonly sessao = computed(() => this.sessaoResource.value());
  readonly loading = computed(() => this.sessaoResource.isLoading());

  // ================= POMODORO VIEW MODEL =================
  readonly pomodoroMode = computed(() => this.pomodoro.mode());
  readonly pomodoroTexto = computed(() => this.pomodoro.overlayText());
  readonly pomodoroVisible = computed(() => this.pomodoro.overlayVisible());

  constructor() {
    // 🔒 Garante que fim de foco pausa sessão real
    effect(() => {
      if (this.pomodoro.focusFinished()) {
        untracked(() => {
          if (!this.timer.pausada() && !this.timer.finalizada()) {
            this.pausarSessao();
          }
        });
      }
    });
  }

  // ================= STATUS =================
  readonly statusLabel = computed(() => {
    const s = this.sessao();
    if (!s) return 'Carregando...';

    if (s.fim || this.timer.finalizada()) return s.concluido ? 'Concluída' : 'Encerrada';

    if (this.timer.pausada()) return s.inicio ? 'Pausada' : 'Pronta para iniciar';

    return 'Em andamento';
  });

  ngOnDestroy(): void {
    const s = this.sessao();

    if (s && !s.fim) {
      this.api.atualizarObservacoes(s.id, this.observacoes()).subscribe();
    }

    this.timer.stop();
    this.pomodoro.stop();
  }

  // ================= INIT =================

  private initSessao(s: SessaoDetalheDto): void {
    if (!s) return;

    const metaMs = TempoFormatUtil.minutosParaMs(s.tempoMinutos);
    const baseMs = (Number(s.estudadoTotalSeg ?? 0)) * 1000;

    this.tempoPlanejado.set(TempoFormatUtil.minutosParaHorasMin(s.tempoMinutos));
    this.observacoes.set(s.observacoes ?? '');

    const pausada = !!s.pausadoEm || !s.inicio;
    const finalizada = !!s.fim;

    this.timer.init(metaMs, baseMs, pausada, finalizada);

    // 🔒 Nunca deixa iniciar sozinho
    if (pausada || finalizada) {
      this.timer.stop();
    }

    // ================= POMODORO =================

    if (s.pomodoroAtivo && !this.pomodoroEnabled()) {
      this.pomodoroEnabled.set(true);

      this.pomodoro.init({
        focoMin: s.pomodoroFocoMin ?? 25,
        pausaCurtaMin: s.pomodoroPausaCurtaMin ?? 5,
        pausaLongaMin: s.pomodoroPausaLongaMin ?? 15,
        longaACada: s.pomodoroLongaACada ?? 4,
      });

      const primeiraVez = s.pomodoroCicloIndex == null;

      if (!primeiraVez) {
        this.pomodoro.restore({
          modo: s.pomodoroModo as any,
          cicloIndex: s.pomodoroCicloIndex,
          restanteSeg: s.pomodoroRestanteSeg,
          rodando: !s.pausadoEm && !!s.inicio && !s.fim
        });
      }

      // 🔒 Se veio restante > 0, força estado pausado
      // if (s.pausadoEm) {
      //   this.pomodoro.pause();
      // }
    }
  }

  // ================= MAIN ACTION =================

  async onMainActionClick() {
    const s = this.sessao();

    if (!s || this.timer.finalizada() || this.acaoLoading()) return;

    if (this.statusLabel() === 'Pronta para iniciar') await this.comecar();
    else if (this.timer.pausada()) await this.retomar();
    else await this.pausarSessao();
  }

  private async comecar() {
    const sessao = this.sessao()!;

    this.executarAcao(async () => {
      const s = await firstValueFrom(this.api.comecarSessao(sessao.id, sessao.pomodoroAtivo));

      this.initSessao(s);

      this.timer.start();

      if (this.pomodoroEnabled()) {
        this.pomodoro.start();
        this.pomodoro.closeOverlay();
      }
    });
  }

  private async pausarSessao(): Promise<void> {
    this.executarAcao(async () => {
      const estudadoSeg = this.timer.pause();
      this.pomodoro.pause();

      await firstValueFrom(this.api.pausarSessao(this.sessao()!.id, estudadoSeg));
    });
  }

  private async retomar(): Promise<void> {
    this.executarAcao(async () => {
      const s = await firstValueFrom(this.api.retomarSessao(this.sessao()!.id));

      this.initSessao(s);

      this.timer.start();

      if (this.pomodoroEnabled() && this.pomodoro.isFocusMode()) {
        this.pomodoro.start();
      }

      this.pomodoro.closeOverlay();
    });
  }

  private async executarAcao(fn: () => Promise<void>) {
    this.acaoLoading.set(true);

    try {
      await fn();
    } finally {
      this.acaoLoading.set(false);
    }
  }

  finalizar(concluido: boolean): void {
    const s = this.sessao();
    if (!s) return;

    this.timer.finish();

    this.api.finalizarSessao({
      id: s.id,
      concluido,
      observacoes: this.observacoes(),
    }).subscribe((novo) => this.initSessao(novo));
  }

  // ================= POMODORO EVENTS =================

  onPomodoroSkipStage(): void {
    this.pomodoro.skip();
  }

  onPomodoroCloseOverlay(): void {
    if (!this.timer.pausada()) {
      this.pausarSessao();
    }

    this.pomodoro.closeOverlay();
  }

  onPomodoroNextStage(): void {
    this.pomodoro.closeOverlay();
  }

  // ================= GUARD =================

  devePausarAntesDeSair(): boolean {
    return !!this.sessao() && !this.timer.finalizada() && !this.timer.pausada();
  }

  pausarAntesDeSair(): Observable<boolean> {
    const s = this.sessao();

    if (!s || this.timer.finalizada()) return of(true);

    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();

    return this.api.pausarSessao(s.id, estudadoSeg).pipe(map(() => true));
  }

  // ================= OBSERVAÇÕES =================

  onObservacoesChange(value: string): void {
    this.observacoes.set(value);
  }

  onObservacoesSaveRequest(text: string): void {
    const s = this.sessao();
    if (!s || s.fim) return;

    this.api.atualizarObservacoes(s.id, text ?? '').subscribe((novo) => {
      this.observacoes.set(novo.observacoes ?? '');
    });
  }

  voltar(): void {
    const s = this.sessao();
    this.router.navigate(['/estudaAgora', (s as any)?.cicloId]);
  }

  @HostListener('window:beforeunload')
  beforeUnload(): void {
    const s = this.sessao();

    if (!s || this.timer.finalizada() || this.timer.pausada()) return;

    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();

    this.api.pausarSessao(s.id, estudadoSeg).subscribe();
  }
}
