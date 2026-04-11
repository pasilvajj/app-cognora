import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, OnDestroy, resource, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, finalize, firstValueFrom, map, Observable, of } from 'rxjs';

import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { ObservacoesEditor } from '../../components/observacoes-editor/observacoes-editor';
import { PomodoroOverlay } from '../../components/pomodoro-overlay/pomodoro-overlay';
import { PomodoroTimer } from '../../components/pomodoro-timer/pomodoro-timer';
import { TimerDisplay } from '../../components/timer-display/timer-display';
import { EstudoApiService } from '../../data/estudo-api.service';
import { SessaoDetalheDto } from '../../data/estudo.models';
import { PomodoroEngineService } from '../../services/pomodoro-engine-service';
import { SessionTimerService } from '../../services/session-timer-service';
import { StudyAlertSoundService } from '../../services/study-alert-sound.service';
import { StudySessionClockCoordinatorService } from '../../services/study-session-clock-coordinator.service';
import { StudySessionPomodoroSnapshotService } from '../../services/study-session-pomodoro-snapshot.service';

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
  private readonly sounds = inject(StudyAlertSoundService);
  private readonly coordenador = inject(StudySessionClockCoordinatorService);
  private readonly pomodoroSnapshot = inject(StudySessionPomodoroSnapshotService);

  // ================= STATE =================
  observacoes = signal('');
  tempoPlanejado = signal('');
  acaoLoading = signal(false);
  pomodoroEnabled = signal(false);
  private readonly finalizandoSessao = signal(false);
  readonly pomodoroTemporariamenteDesativado = signal(false);

  /**
   * Cópia local do último DTO recebido da API (via initSessao).
   * Sobrepõe sessaoResource.value() para que statusLabel e comecar/retomar
   * usem sempre os dados mais atuais, mesmo sem recarregar o resource.
   */
  private readonly _sessao = signal<SessaoDetalheDto | null>(null);

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
      untracked(() => this.initSessao(dados, false));
      return dados;
    },
  });

  readonly sessao = computed(() => this._sessao() ?? this.sessaoResource.value());
  readonly loading = computed(() => this.sessaoResource.isLoading());

  // ================= POMODORO VIEW MODEL =================
  readonly pomodoroMode = computed(() => this.pomodoro.mode());
  readonly pomodoroTexto = computed(() => this.pomodoro.overlayText());
  readonly pomodoroVisible = computed(() => this.pomodoro.overlayVisible());
  /** Bloqueia Retomar na sessão enquanto estiver em PAUSA_CURTA (regra de negócio), inclusive com Pomodoro “desativado”. */
  readonly retomarBloqueadoNaPausaCurta = computed(() =>
    this.timer.pausada() && this.pomodoroEnabled() && this.pomodoroMode() === 'PAUSA_CURTA',
  );

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

    // ✅ Ao atingir a meta do cronômetro principal, conclui/finaliza automaticamente
    // a sessão, mesmo que o Pomodoro ainda esteja correndo.
    effect(() => {
      const s = this.sessao();
      if (!s || !s.inicio || !!s.fim) return;
      if (!this.timer.finalizada()) return;
      if (this.finalizandoSessao()) return;

      untracked(() => this.finalizar(true));
    });

    // Persiste o modal Pomodoro (F5) até o usuário confirmar em Ok / Próxima etapa.
    effect(() => {
      const id = this.sessao()?.id;
      const vis = this.pomodoro.overlayVisible();
      const txt = this.pomodoro.overlayText();
      const ff = this.pomodoro.focusFinished();
      if (!id || !vis || !txt) return;

      untracked(() => {
        this.pomodoroSnapshot.setOverlayPending(id, { texto: txt, focusFinished: ff });
      });
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

    if (s && !s.fim && !this.sessaoAindaNaoIniciada(s)) {
      this.api.atualizarObservacoes(s.id, this.observacoes()).subscribe();
      this.salvarSnapshotPomodoro(s.id);
    } else if (s && this.sessaoAindaNaoIniciada(s)) {
      this.pomodoroSnapshot.clear(s.id);
    }

    this.timer.stop();
    this.pomodoro.stop();
  }

  // ================= INIT =================

  /**
   * Inicializa o estado local a partir do DTO da API.
   * @param defer  Quando true, o tick dos relógios NÃO é iniciado aqui;
   *               o coordenador fará isso logo em seguida com um anchor único.
   */
  private initSessao(s: SessaoDetalheDto, defer = false): void {
    if (!s) return;

    const sessaoAnteriorId = this._sessao()?.id ?? null;
    if (sessaoAnteriorId !== s.id) {
      this.pomodoroTemporariamenteDesativado.set(false);
    }

    // Mantém o sinal local sempre atualizado com o último DTO da API.
    this._sessao.set(s);

    const metaMs = TempoFormatUtil.minutosParaMs(s.tempoMinutos);
    const baseMsRaw = Number(s.estudadoTotalSeg ?? 0) * 1000;
    const baseMs = metaMs > 0 ? Math.min(baseMsRaw, metaMs) : Math.max(0, baseMsRaw);
    const pausada = !!s.pausadoEm || !s.inicio;
    const finalizada = !!s.fim;

    this.tempoPlanejado.set(TempoFormatUtil.minutosParaHorasMin(s.tempoMinutos));
    this.observacoes.set(s.observacoes ?? '');

    this.timer.init(metaMs, baseMs, pausada, finalizada, { deferTicker: defer });

    if (pausada || finalizada) {
      this.timer.stop();
    }

    if (finalizada || !s.pomodoroAtivo) {
      this.pomodoroSnapshot.clear(s.id);
    }

    this.sincronizarPomodoro(s, defer);
  }

  private sincronizarPomodoro(s: SessaoDetalheDto, defer: boolean): void {
    if (!s.pomodoroAtivo) return;

    if (!this.pomodoroEnabled()) {
      this.pomodoroEnabled.set(true);
      this.pomodoro.init({
        focoMin:        s.pomodoroFocoMin        ?? 25,
        pausaCurtaMin:  s.pomodoroPausaCurtaMin  ?? 5,
        pausaLongaMin:  s.pomodoroPausaLongaMin  ?? 15,
        longaACada:     s.pomodoroLongaACada     ?? 4,
      });
    }

    const sessaoRodandoBackend = !!s.inicio && !s.fim && !s.pausadoEm;
    const sessaoRodando = sessaoRodandoBackend && !this.pomodoroTemporariamenteDesativado();
    const estudadoSeg = s.estudadoTotalSeg ?? 0;
    const focoSeg = (s.pomodoroFocoMin ?? 25) * 60;
    const snapshotLocal = this.pomodoroSnapshot.get(s.id);

    // Sessão nova (sem progresso real): sempre começar no FOCO padrão
    // para evitar cair em PAUSA_LONGA 15:00 por dados stale.
    if (estudadoSeg <= 0) {
      this.pomodoroSnapshot.clear(s.id);
      this.pomodoro.restore({
        modo: 'FOCO',
        cicloIndex: 1,
        restanteSeg: focoSeg,
        rodando: sessaoRodando,
        deferTicker: defer,
      });
      return;
    }

    // Sessão pausada: o snapshot local é a fonte mais confiável (cliente),
    // principalmente no primeiro retorno à tela, quando o backend pode vir stale.
    if (!sessaoRodando && snapshotLocal && snapshotLocal.restanteSeg > 0) {
      this.pomodoro.restore({
        modo: snapshotLocal.modo,
        cicloIndex: snapshotLocal.cicloIndex,
        restanteSeg: snapshotLocal.restanteSeg,
        rodando: false,
        deferTicker: defer,
      });
      this.reaplicarOverlayPomodoroSePendente(s.id);
      return;
    }

    if (s.pomodoroCicloIndex == null) return;

    let   modo          = s.pomodoroModo;
    let   cicloIndex    = s.pomodoroCicloIndex;
    let   restanteSeg   = this.corrigirRestantePomodoro(s);

    // Fallback para pausas: quando a API vier stale, deriva do início da etapa
    // até o instante de pausa (ou agora, se rodando).
    const restantePorEtapaInicio = this.calcularRestantePorEtapaInicio(s);
    if (restantePorEtapaInicio != null) {
      restanteSeg = restanteSeg > 0
        ? Math.min(restanteSeg, restantePorEtapaInicio)
        : restantePorEtapaInicio;
    }

    // Sessão pausada ao voltar para a tela: prioriza snapshot local
    // (incluindo modo/ciclo), pois o backend pode retornar etapa/restante stale.
    if (!sessaoRodando && snapshotLocal && snapshotLocal.restanteSeg > 0) {
      modo = snapshotLocal.modo;
      cicloIndex = snapshotLocal.cicloIndex;
      restanteSeg = Math.min(restanteSeg, snapshotLocal.restanteSeg);
    }

    // ── Preservar progresso do break ativo no cliente ──────────────────────────
    // O break do Pomodoro roda CLIENT-SIDE enquanto a sessão está pausada.
    // O servidor não acompanha o progresso do break (retorna a duração completa
    // em pomodoroRestanteSeg). Se o break já está rodando, usamos o valor real
    // calculado a partir do anchor local — impedindo que o timer reinicie do zero.
    if (this.pomodoro.running() && this.pomodoro.mode() !== 'FOCO') {
      const clienteRestanteSeg = this.pomodoro.restanteSegAtual();
      restanteSeg = Math.min(restanteSeg, clienteRestanteSeg);
    }

    // Servidor ainda não computou o restante da etapa (ex.: início de sessão ou
    // pomodoroRestanteSeg = 0 no início de um ciclo). Garante running=false para
    // que o coordenador use startAt() com a duração completa de init().
    if (sessaoRodando && restanteSeg <= 0) {
      this.pomodoro.stop();
      return;
    }

    this.pomodoro.restore({
      modo,
      cicloIndex,
      restanteSeg,
      rodando:     sessaoRodando,
      deferTicker: defer,
    });
    this.reaplicarOverlayPomodoroSePendente(s.id);
  }

  /** Reabre o alerta Pomodoro após F5, se ainda não houve Ok. */
  private reaplicarOverlayPomodoroSePendente(sessaoId: number): void {
    if (!this.pomodoroEnabled()) return;

    const p = this.pomodoroSnapshot.getOverlayPending(sessaoId);
    if (!p) return;

    this.pomodoro.applyPendingOverlay({ texto: p.texto, focusFinished: p.focusFinished });
  }

  /**
   * Calcula os segundos restantes para a etapa atual do Pomodoro.
   *
   * Estratégia:
   *
   * FOCO — deriva de `estudadoTotalSeg`, que o servidor calcula corretamente
   * (é também a base do cronômetro da sessão). O campo `pomodoroRestanteSeg`
   * é ignorado para FOCO porque o servidor frequentemente retorna valores
   * desatualizados ou inconsistentes (ex.: 900 quando só 25s foram estudados).
   *
   *   restante = focoSeg − (estudadoTotalSeg % focoSeg)
   *
   * Como breaks não contam em `estudadoTotalSeg`, o módulo isola o tempo
   * estudado no ciclo atual, funcionando corretamente em qualquer ciclo.
   *
   * PAUSA (CURTA / LONGA) — servidor salva com floor(); compensamos com +1,
   * limitado à duração máxima da etapa. Zeros são passados como-está
   * (break encerrado).
   */
  private corrigirRestantePomodoro(s: SessaoDetalheDto): number {
    const estudadoSeg  = s.estudadoTotalSeg ?? 0;
    const restanteServ = s.pomodoroRestanteSeg ?? 0;
    const focoSeg      = (s.pomodoroFocoMin ?? 25) * 60;

    if (s.pomodoroModo === 'FOCO') {
      // Segundos estudados no ciclo corrente = estudadoSeg módulo focoSeg.
      // Ex.: 25 s estudados, ciclo 1 → 1500 − 25 = 1475 = 24:35
      // Ex.: 600 s estudados, ciclo 1 → 1500 − 600 = 900 = 15:00
      // Ex.: 1525 s estudados (ciclo 2) → 1500 − (1525 % 1500) = 1475 = 24:35
      const cycleStudied = estudadoSeg % focoSeg;
      return Math.max(0, focoSeg - cycleStudied);
    }

    // Break encerrado: retorna 0 para que a guard do ciclo o trate.
    if (restanteServ <= 0) return 0;

    // PAUSA_CURTA / PAUSA_LONGA: compensar floor() do servidor.
    const maxSeg = s.pomodoroModo === 'PAUSA_CURTA'
      ? (s.pomodoroPausaCurtaMin ?? 5) * 60
      : (s.pomodoroPausaLongaMin ?? 15) * 60;

    return Math.min(restanteServ + 1, maxSeg);
  }

  private calcularRestantePorEtapaInicio(s: SessaoDetalheDto): number | null {
    if (s.pomodoroModo === 'FOCO' || !s.pomodoroEtapaInicio) return null;

    const inicioEtapaMs = Date.parse(s.pomodoroEtapaInicio);
    if (Number.isNaN(inicioEtapaMs)) return null;

    const fimRefMs = s.pausadoEm ? Date.parse(s.pausadoEm) : Date.now();
    if (Number.isNaN(fimRefMs) || fimRefMs <= inicioEtapaMs) return null;

    const duracaoSeg = s.pomodoroModo === 'PAUSA_CURTA'
      ? (s.pomodoroPausaCurtaMin ?? 5) * 60
      : (s.pomodoroPausaLongaMin ?? 15) * 60;

    const elapsedSeg = Math.floor((fimRefMs - inicioEtapaMs) / 1000);
    return Math.max(0, duracaoSeg - elapsedSeg);
  }

  // ================= MAIN ACTION =================

  async onMainActionClick() {
    const s = this.sessao();

    if (!s || this.timer.finalizada() || this.acaoLoading()) return;
    if (this.retomarBloqueadoNaPausaCurta()) return;

    if (this.statusLabel() === 'Pronta para iniciar') await this.comecar();
    else if (this.timer.pausada()) await this.retomar();
    else await this.pausarSessao();
  }

  private async comecar() {
    const sessao = this.sessao()!;

    this.executarAcao(async () => {
      const s = await firstValueFrom(this.api.comecarSessao(sessao.id, sessao.pomodoroAtivo));

      this.initSessao(s, true);

      this.coordenador.ativarRelógios(
        Date.now(),
        this.pomodoroEnabled() && !this.pomodoroTemporariamenteDesativado(),
      );
      this.pomodoroSnapshot.clearOverlayPending(s.id);
    });
  }

  private async pausarSessao(): Promise<void> {
    this.executarAcao(async () => {
      const estudadoSeg = this.timer.pause();
      this.pomodoro.pause();
      this.salvarSnapshotPomodoro(this.sessao()!.id);

      await firstValueFrom(this.api.pausarSessao(this.sessao()!.id, estudadoSeg));
    });
  }

  private async retomar(): Promise<void> {
    // Snapshot local antes da chamada de API.
    // O progresso do Pomodoro (principalmente em pausa) pode existir apenas no cliente;
    // ao retomar, preferimos continuar desse ponto em vez de resetar para a duração cheia.
    const localPomodoro = this.pomodoroEnabled()
      ? {
          modo: this.pomodoro.mode(),
          cicloIndex: this.pomodoro.cicloAtual(),
          restanteSeg: this.pomodoro.restanteSegAtual(),
        }
      : null;

    this.executarAcao(async () => {
      const s = await firstValueFrom(this.api.retomarSessao(this.sessao()!.id));

      this.initSessao(s, true);

      // Se houver estado local válido, ele prevalece no Retomar para evitar
      // reinício indevido da etapa (ex.: voltar para 15:00 em vez de continuar).
      if (localPomodoro && localPomodoro.restanteSeg > 0) {
        this.pomodoro.restore({
          modo: localPomodoro.modo,
          cicloIndex: localPomodoro.cicloIndex,
          restanteSeg: localPomodoro.restanteSeg,
          rodando: !this.pomodoroTemporariamenteDesativado(),
          deferTicker: true,
        });
      }

      this.coordenador.ativarRelógios(
        Date.now(),
        this.pomodoroEnabled() && !this.pomodoroTemporariamenteDesativado(),
      );
      this.pomodoroSnapshot.clearOverlayPending(s.id);
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
    if (!s || this.finalizandoSessao() || !!s.fim) return;

    this.finalizandoSessao.set(true);
    this.acaoLoading.set(true);
    this.timer.finish();
    this.pomodoro.stop();

    this.api.finalizarSessao({
      id: s.id,
      concluido,
      observacoes: this.observacoes(),
    }).pipe(
      finalize(() => {
        this.finalizandoSessao.set(false);
        this.acaoLoading.set(false);
      }),
    ).subscribe({
      next: (novo) => {
        if (concluido) {
          this.sounds.playSessionFinished();
        }
        this.pomodoroSnapshot.clear(s.id);
        this.initSessao(novo);
      },
    });
  }

  // ================= POMODORO EVENTS =================

  onPomodoroSkipStage(): void {
    this.pomodoro.skip();
    // Com Pomodoro em “Ativar agora”, volta o rótulo para “Desativar agora” após pular etapa.
    this.pomodoroTemporariamenteDesativado.set(false);
    const id = this.sessao()?.id;
    if (id && !this.pomodoro.overlayVisible()) {
      this.pomodoroSnapshot.clearOverlayPending(id);
    }
    if (id) {
      this.salvarSnapshotPomodoro(id);
    }
  }

  onPomodoroToggleEnabled(): void {
    const s = this.sessao();
    if (!s || !!s.fim || this.timer.finalizada()) return;

    const desativado = this.pomodoroTemporariamenteDesativado();
    if (!desativado) {
      this.pomodoro.pause();
      this.pomodoro.dismissOverlay();
      this.pomodoroSnapshot.clearOverlayPending(s.id);
      this.pomodoroTemporariamenteDesativado.set(true);
      return;
    }

    this.pomodoroTemporariamenteDesativado.set(false);
    // PAUSA_CURTA/LONGA: sessão pausada, mas o descanso do Pomodoro segue no cliente ao reativar.
    // FOCO + sessão pausada: não iniciar o Pomodoro aqui — só após Retomar (coordenador.ativarRelógios).
    const adiarPomodoroAteRetomar =
      this.timer.pausada() && this.pomodoro.mode() === 'FOCO';

    if (!this.timer.finalizada() && !this.pomodoro.finished() && !adiarPomodoroAteRetomar) {
      this.pomodoro.startAt(Date.now());
    }
  }

  onPomodoroCloseOverlay(): void {
    if (!this.timer.pausada()) {
      this.pausarSessao();
    }

    this.pomodoro.closeOverlay();
    this.pomodoroSnapshot.clearOverlayPending(this.sessao()!.id);
  }

  onPomodoroNextStage(): void {
    this.pomodoro.closeOverlay();
    this.pomodoroSnapshot.clearOverlayPending(this.sessao()!.id);
  }

  // ================= GUARD =================

  devePausarAntesDeSair(): boolean {
    const s = this.sessao();
    if (!s) return false;
    if (this.sessaoAindaNaoIniciada(s)) return false;
    return !this.timer.finalizada() && !this.timer.pausada();
  }

  pausarAntesDeSair(): Observable<boolean> {
    const s = this.sessao();

    if (!s || this.timer.finalizada()) return of(true);
    if (this.sessaoAindaNaoIniciada(s)) {
      this.pomodoroSnapshot.clear(s.id);
      return of(true);
    }

    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();
    this.salvarSnapshotPomodoro(s.id);

    return this.api.pausarSessao(s.id, estudadoSeg).pipe(
      map(() => true),
      // Se a sessão já expirou no backend, não bloqueia a navegação.
      catchError(() => of(true)),
    );
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

    if (!s || this.timer.finalizada() || this.timer.pausada() || this.sessaoAindaNaoIniciada(s)) return;

    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();
    this.salvarSnapshotPomodoro(s.id);

    this.api.pausarSessao(s.id, estudadoSeg).subscribe();
  }

  private salvarSnapshotPomodoro(sessaoId: number): void {
    if (!this.pomodoroEnabled()) return;

    const restanteSeg = this.pomodoro.restanteSegAtual();
    if (restanteSeg <= 0) {
      this.pomodoroSnapshot.clear(sessaoId);
      return;
    }

    this.pomodoroSnapshot.set(sessaoId, {
      modo: this.pomodoro.mode(),
      cicloIndex: this.pomodoro.cicloAtual(),
      restanteSeg,
      savedAtEpochMs: Date.now(),
    });
  }

  private sessaoAindaNaoIniciada(s: SessaoDetalheDto): boolean {
    return !s.inicio && !s.fim && (s.estudadoTotalSeg ?? 0) <= 0;
  }
}
