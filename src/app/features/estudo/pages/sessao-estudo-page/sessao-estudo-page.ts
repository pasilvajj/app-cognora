import { CommonModule, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, OnDestroy, resource, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, finalize, firstValueFrom, map, Observable, of } from 'rxjs';

import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { PomodoroOverlay } from '../../components/pomodoro-overlay/pomodoro-overlay';
import { SessaoEstudoPageHeader } from '../../components/sessao-estudo/sessao-estudo-page-header/sessao-estudo-page-header';
import { SessaoEstudoSessionCard } from '../../components/sessao-estudo/sessao-estudo-session-card/sessao-estudo-session-card';
import { EstudoApiService } from '../../data/estudo-api.service';
import { SessaoDetalheDto } from '../../data/estudo.models';
import { PomodoroEngineService } from '../../services/pomodoro-engine-service';
import { PomodoroMode } from '../../data/pomodoro.types';
import { getPomodoroRestanteStrategy } from '../../strategies/pomodoro-restante/pomodoro-restante-strategy.factory';
import { SessionTimerService } from '../../services/session-timer-service';
import { StudyAlertSoundService } from '../../services/study-alert-sound.service';
import { StudySessionClockCoordinatorService } from '../../services/study-session-clock-coordinator.service';
import { StudySessionPomodoroSnapshotService } from '../../services/study-session-pomodoro-snapshot.service';
import {
  obterCicloContextoEstudoGuardado,
  persistirCicloContextoEstudo,
} from '../../utils/estudo-contexto-ciclo.storage';

@Component({
  selector: 'app-sessao-estudo-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, SessaoEstudoPageHeader, SessaoEstudoSessionCard, PomodoroOverlay],
  templateUrl: './sessao-estudo-page.html',
  styleUrl: './sessao-estudo-page.css',
})
export class SessaoEstudoPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly api = inject(EstudoApiService);
  private readonly toastr = inject(ToastrService);

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
  /** Evita duplicar POST ao sair quando {@code beforeunload} e {@code pagehide} disparam os dois. */
  private pausaAoSairJaEnviada = false;

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
      try {
        const dados = await this.api.getSessao1(id);
        untracked(() => this.initSessao(dados, false));
        return dados;
      } catch (err: unknown) {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 404 || status === 403) {
          untracked(() => {
            this._sessao.set(null);
            const cicloId = this.cicloIdParaRedirectAposErroSessao();
            if (cicloId != null) {
              this.toastr.warning(
                'Esta sessão não existe ou você não tem permissão para abri-la. Redirecionando para o estudo deste ciclo.',
              );
              void this.router.navigate(['/estudaAgora', cicloId]);
            } else {
              this.toastr.warning(
                'Esta sessão não existe ou você não tem permissão para abri-la. Redirecionando para seus ciclos.',
              );
              void this.router.navigate(['/ciclos']);
            }
          });
          return null;
        }
        throw err;
      }
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

    // Quando o tempo da pausa (curta/longa) esgota no relógio, o motor incrementa o ciclo localmente;
    // sem POST o servidor continua no modo/ciclo anteriores até pausar manualmente.
    effect(() => {
      const tick = this.pomodoro.pomodoroServerSyncTick();
      if (tick === 0) return;
      untracked(() => {
        const s = this.sessao();
        if (s?.id) this.salvarSnapshotPomodoro(s.id);
        this.enviarEstadoPomodoroAoServidor('fim-pausa-por-timer');
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

  /** Navegação com `Router.navigate(..., { state: { cicloId } })` ou último ciclo em `sessionStorage`. */
  private cicloIdParaRedirectAposErroSessao(): number | null {
    const st = this.location.getState();
    if (st && typeof st === 'object' && 'cicloId' in st) {
      const raw = (st as { cicloId?: unknown }).cicloId;
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(n) && n > 0) {
        return Math.floor(n);
      }
    }
    return obterCicloContextoEstudoGuardado();
  }

  /**
   * Inicializa o estado local a partir do DTO da API.
   * @param defer  Quando true, o tick dos relógios NÃO é iniciado aqui;
   *               o coordenador fará isso logo em seguida com um anchor único.
   */
  private initSessao(s: SessaoDetalheDto, defer = false): void {
    if (!s) return;

    const sessaoAnteriorId = this._sessao()?.id ?? null;
    if (sessaoAnteriorId != null && sessaoAnteriorId !== s.id) {
      this.pomodoroTemporariamenteDesativado.set(false);
    }

    // Mantém o sinal local sempre atualizado com o último DTO da API.
    this._sessao.set(s);
    persistirCicloContextoEstudo(s.cicloId);

    // “Desativar agora” é só no cliente — reaplica após F5 (mesma sessão).
    if (s.pomodoroAtivo !== false && this.pomodoroSnapshot.getTemporariamenteDesativado(s.id)) {
      this.pomodoroTemporariamenteDesativado.set(true);
    }

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

    // Sessão pausada: snapshot local é confiável nas PAUSAS (servidor manda duração cheia).
    // Em FOCO o restante deve vir de estudadoTotalSeg (ver corrigirRestantePomodoro):
    // após "Pular etapa" o cliente gravava FOCO com bloco cheio — desincronizava 1s do cronômetro principal.
    const snapshotEhPausa =
      snapshotLocal &&
      (snapshotLocal.modo === 'PAUSA_CURTA' || snapshotLocal.modo === 'PAUSA_LONGA');

    if (!sessaoRodando && snapshotEhPausa && snapshotLocal!.restanteSeg > 0) {
      this.pomodoro.restore({
        modo: snapshotLocal!.modo,
        cicloIndex: snapshotLocal!.cicloIndex,
        restanteSeg: snapshotLocal!.restanteSeg,
        rodando: false,
        deferTicker: defer,
      });
      this.reaplicarOverlayPomodoroSePendente(s.id);
      return;
    }

    const cicloIndexApiOuSnap = s.pomodoroCicloIndex ?? snapshotLocal?.cicloIndex;
    if (cicloIndexApiOuSnap == null) return;

    const modoParaSync = this.resolveModoPomodoro(s);
    let modo = modoParaSync;
    let cicloIndex = cicloIndexApiOuSnap;
    if (
      snapshotLocal?.modo === 'FOCO' &&
      (s.pomodoroModo === 'PAUSA_CURTA' || s.pomodoroModo === 'PAUSA_LONGA') &&
      snapshotLocal.cicloIndex != null
    ) {
      cicloIndex = snapshotLocal.cicloIndex;
    }
    let restanteSeg = this.corrigirRestantePomodoro(s, modoParaSync);

    // Fallback para pausas: quando a API vier stale, deriva do início da etapa
    // até o instante de pausa (ou agora, se rodando).
    const restantePorEtapaInicio = this.calcularRestantePorEtapaInicio(s, modoParaSync);
    if (restantePorEtapaInicio != null) {
      restanteSeg = restanteSeg > 0
        ? Math.min(restanteSeg, restantePorEtapaInicio)
        : restantePorEtapaInicio;
    }

    // Sessão pausada: mescla snapshot só em pausa — em FOCO o mínimo com snapshot cheio
    // escondia o tempo já estudado no bloco (mesma origem do bug do “Pular etapa”).
    if (
      !sessaoRodando &&
      snapshotLocal &&
      snapshotLocal.restanteSeg > 0 &&
      (snapshotLocal.modo === 'PAUSA_CURTA' || snapshotLocal.modo === 'PAUSA_LONGA')
    ) {
      modo = snapshotLocal.modo as PomodoroMode;
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
      modo: modo as PomodoroMode,
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

  /** Coordena API vs snapshot quando "Pular etapa" adianta FOCO face ao backend. */
  private resolveModoPomodoro(s: SessaoDetalheDto): string {
    const api = s.pomodoroModo ?? 'FOCO';
    const snap = this.pomodoroSnapshot.get(s.id);
    const apiPausa = api === 'PAUSA_CURTA' || api === 'PAUSA_LONGA';
    if (snap?.modo === 'FOCO' && apiPausa) {
      return 'FOCO';
    }
    return api;
  }

  private corrigirRestantePomodoro(s: SessaoDetalheDto, modoEfetivo?: string): number {
    const modo = (modoEfetivo ?? this.resolveModoPomodoro(s)) as PomodoroMode;
    return getPomodoroRestanteStrategy(modo).correctRemainingFromServer(s);
  }

  private calcularRestantePorEtapaInicio(s: SessaoDetalheDto, modoEfetivo?: string): number | null {
    const modo = (modoEfetivo ?? this.resolveModoPomodoro(s)) as PomodoroMode;
    return getPomodoroRestanteStrategy(modo).remainingFromEtapaInicio(s);
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

      await firstValueFrom(
        this.api.pausarSessao(this.sessao()!.id, estudadoSeg, this.pomodoroPausaParaApi()),
      );
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

      // Em PAUSA o servidor manda duração cheia — o cliente preserva o restante real.
      // Em FOCO o restante deve seguir estudadoTotalSeg (initSessao + corrigirRestantePomodoro);
      // restaurar FOCO local aqui após “Pular etapa” reintroduzia o bloco cheio e o desvio de 1s.
      const localEhPausa =
        localPomodoro &&
        (localPomodoro.modo === 'PAUSA_CURTA' || localPomodoro.modo === 'PAUSA_LONGA');

      if (localEhPausa && localPomodoro!.restanteSeg > 0) {
        this.pomodoro.restore({
          modo: localPomodoro!.modo,
          cicloIndex: localPomodoro!.cicloIndex,
          restanteSeg: localPomodoro!.restanteSeg,
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
    const id = this.sessao()?.id;
    if (id && !this.pomodoro.overlayVisible()) {
      this.pomodoroSnapshot.clearOverlayPending(id);
    }
    if (id) {
      this.salvarSnapshotPomodoro(id);
    }

    this.enviarEstadoPomodoroAoServidor('pular-etapa');
  }

  /** Persiste modo / restante / ciclo após transição local (pular etapa ou fim da pausa pelo timer). */
  private enviarEstadoPomodoroAoServidor(contexto: string): void {
    const s = this.sessao();
    if (!s || !!s.fim || (!s.pomodoroAtivo && !this.pomodoroEnabled())) return;

    this.api
      .sincronizarPomodoroEstado(s.id, {
        pomodoroModo: this.pomodoro.mode(),
        pomodoroRestanteSeg: Math.floor(this.pomodoro.restanteSegAtual()),
        pomodoroCiclo: this.pomodoro.cicloAtual(),
      })
      .subscribe({
        next: (dto) => {
          this._sessao.update((prev) => {
            if (!prev || prev.id !== dto.id) return prev;
            return {
              ...prev,
              pomodoroModo: dto.pomodoroModo,
              pomodoroCicloIndex: dto.pomodoroCicloIndex,
              pomodoroRestanteSeg: dto.pomodoroRestanteSeg,
              pomodoroEtapaInicio: dto.pomodoroEtapaInicio,
            };
          });
          this.salvarSnapshotPomodoro(s.id);
        },
        error: (err) => {
          console.warn(`[Pomodoro] Falha ao sincronizar (${contexto})`, err);
        },
      });
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
      this.pomodoroSnapshot.setTemporariamenteDesativado(s.id, true);
      return;
    }

    this.pomodoroTemporariamenteDesativado.set(false);
    this.pomodoroSnapshot.setTemporariamenteDesativado(s.id, false);
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

    return this.api.pausarSessao(s.id, estudadoSeg, this.pomodoroPausaParaApi()).pipe(
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
    if (!s?.cicloId) {
      void this.router.navigate(['/ciclos']);
      return;
    }
    void this.router.navigate(['/estudaAgora', s.cicloId]);
  }

  @HostListener('window:beforeunload')
  beforeUnload(): void {
    this.tentarPausarAoFecharAba();
  }

  @HostListener('window:pagehide', ['$event'])
  pageHide(ev: PageTransitionEvent): void {
    if (ev.persisted) {
      return;
    }
    this.tentarPausarAoFecharAba();
  }

  /**
   * Usa fetch keepalive (via API) para a pausa chegar ao servidor ao fechar a aba;
   * o HttpClient comum é frequentemente abortado antes do envio.
   */
  private tentarPausarAoFecharAba(): void {
    if (this.pausaAoSairJaEnviada) {
      return;
    }
    const s = this.sessao();
    if (!s || this.timer.finalizada() || this.timer.pausada() || this.sessaoAindaNaoIniciada(s)) {
      return;
    }

    this.pausaAoSairJaEnviada = true;
    const estudadoSeg = this.timer.pause();
    this.pomodoro.pause();
    this.salvarSnapshotPomodoro(s.id);
    this.api.pausarSessaoKeepAlive(s.id, estudadoSeg, this.pomodoroPausaParaApi());
  }

  /** Modo, restante e ciclo após pausar — enviados ao servidor para gravar Pomodoro na sessão. */
  private pomodoroPausaParaApi():
    | { modo: string; restanteSeg: number; cicloIndex: number }
    | undefined {
    if (!this.pomodoroEnabled()) return undefined;
    return {
      modo: this.pomodoro.mode(),
      restanteSeg: this.pomodoro.restanteSegAtual(),
      cicloIndex: this.pomodoro.cicloAtual(),
    };
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
