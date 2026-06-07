import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { EMPTY, Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { EstudarAgoraCicloFimBanner } from '../../components/estudar-agora/estudar-agora-ciclo-fim-banner/estudar-agora-ciclo-fim-banner';
import { EstudarAgoraObservacoesCard } from '../../components/estudar-agora/estudar-agora-observacoes-card/estudar-agora-observacoes-card';
import { EstudarAgoraPageHeader } from '../../components/estudar-agora/estudar-agora-page-header/estudar-agora-page-header';
import { EstudarAgoraProgressoCicloCard } from '../../components/estudar-agora/estudar-agora-progresso-ciclo-card/estudar-agora-progresso-ciclo-card';
import { EstudarAgoraProximaSessaoCard } from '../../components/estudar-agora/estudar-agora-proxima-sessao-card/estudar-agora-proxima-sessao-card';
import { EstudarAgoraObservacaoItem, EstudarAgoraProgressItem } from '../../components/estudar-agora/estudar-agora-view.models';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { CicloMateriaDto, CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import {
  normalizarNomeDisciplina,
  normalizarPercentualProgresso as normalizarPercentualProgressoUtil,
} from '../../../../shared/utils/progresso-disciplina.util';
import { CicloDto } from '../../../ciclos/data/ciclos.models'; // ajuste para seu tipo real
import { alinharProximaSessaoAoItensDoCiclo } from '../../../../shared/utils/proxima-sessao-ciclo.util';
import { CicloItemView, EscolherMateriaModalCircular } from '../../components/escolher-materia-modal-circular/escolher-materia-modal-circular';
import { RecentSession, UltimasSessoesCard } from '../../components/ultimas-sessoes-card/ultimas-sessoes-card';
import { EstudoApiService, } from '../../data/estudo-api.service';
import { persistirCicloContextoEstudo } from '../../utils/estudo-contexto-ciclo.storage';
import { ProgressoDisciplinaDto, ProximaSessaoDto, SessaoCardDto } from '../../data/estudo.models';


@Component({
  selector: 'app-estudar-agora',
  imports: [
    CommonModule,
    UltimasSessoesCard,
    EscolherMateriaModalCircular,
    EstudarAgoraPageHeader,
    EstudarAgoraCicloFimBanner,
    EstudarAgoraProximaSessaoCard,
    EstudarAgoraProgressoCicloCard,
    EstudarAgoraObservacoesCard,
  ],
  templateUrl: './estudar-agora.html',
  styleUrl: './estudar-agora.css',
})
export class EstudarAgora implements OnInit, OnDestroy {

  cicloId!: number;
  loading = signal(true);
  isProcessando = signal(false);
  // recomendado pelo backend (ordem do ciclo)
  proximaSessaoDto?: ProximaSessaoDto;
  tempoPlanejadoLabel = '';
  // ciclo completo (itens do ciclo) para o modal listar
  ciclo?: CicloDto;
  selecionadoCicloItemId?: number;
  // itens para o modal (shape simples)
  itens: CicloItemView[] = [];
  /** Sessões concluídas na rodada atual (GET materias); opcional até API antiga. */
  sessoesConcluidasNaRodada: number | null = null;
  // item selecionado (override). Por padrão = recomendado
  selecionado?: CicloItemView;
  // controla abertura do modal
  modalOpen = false;
  progress: EstudarAgoraProgressItem[] = [];
  recentSessions: RecentSession[] = [];
  observacoesMateria: EstudarAgoraObservacaoItem[] = [];
  observacoesLoading = signal(false);
  /** Disciplinas que ainda têm bloco no ciclo (ordem definida); exclui só linha de config / removidas do ciclo. */
  private disciplinaIdsComExecNoCiclo = new Set<number>();
  /** Fallback quando GET materias não trouxer disciplinaId (API antiga). */
  private nomesDisciplinasComExecNoCiclo = new Set<string>();
  private progressoBruto: ProgressoDisciplinaDto[] = [];

  /** Ciclo completo na última rodada — à espera de confirmar nova volta. */
  aguardandoNovaRodada = signal(false);
  ultimaRodadaConcluidaNumero = signal<number | null>(null);
  rodadaAtualNumero = signal<number | null>(null);
  iniciandoNovaRodada = signal(false);

  private loadSub?: Subscription;

  constructor(
    private readonly ciclosApi: CiclosApiService,
    private readonly estudoApi: EstudoApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly toastr: ToastrService,
  ) { }

  ngOnInit(): void {

    if (!this.auth.getUser()) {
      void this.router.navigate(['/login']);
      return;
    }

    const idRaw = this.route.snapshot.paramMap.get('cicloId');
    const parsed = Number(idRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.toastr.error('Ciclo inválido ou não informado na rota.');
      void this.router.navigate(['/ciclos']);
      return;
    }
    this.cicloId = parsed;
    persistirCicloContextoEstudo(this.cicloId);

    this.carregarEstudarAgora();
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
  }

  voltarParaMeusCiclos(): void {
    this.router.navigate(['/ciclos']);
  }

  /** Recarrega próxima sessão, matérias (com estado de rodada), progresso e últimas sessões. */
  private carregarEstudarAgora(): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.loadSub = this.estudoApi
      .getEstudarAgoraCarga(this.cicloId)
      .pipe(
        catchError(() => {
          this.toastr.error('Erro ao carregar a página de estudo.');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (carga) => {
          const estadoMaterias = carga.estadoMaterias;
          if (!estadoMaterias) {
            this.toastr.error('Não foi possível carregar as matérias do ciclo.');
            return;
          }

          this.aguardandoNovaRodada.set(estadoMaterias.aguardandoNovaRodada);
          this.ultimaRodadaConcluidaNumero.set(estadoMaterias.ultimaRodadaConcluidaNumero ?? null);
          this.rodadaAtualNumero.set(estadoMaterias.rodadaAtualNumero ?? null);

          this.itens = estadoMaterias.materias.map((m) => ({
            cicloItemId: m.cicloItemId,
            ordem: m.ordem,
            disciplinaNome: m.disciplinaNome,
            tempoMinutos: m.tempoMinutos,
            visto: m.visto,
            sessaoAbertaId: m.sessaoAbertaId,
            cronometroIniciado: m.cronometroIniciado ?? false,
            concluida: m.concluida,
          }));

          const sc = estadoMaterias.sessoesConcluidasNaRodada;
          this.sessoesConcluidasNaRodada =
            typeof sc === 'number' && Number.isFinite(sc) ? sc : null;

          this.disciplinaIdsComExecNoCiclo = new Set(
            estadoMaterias.materias
              .map((m) => m.disciplinaId)
              .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
          );
          this.nomesDisciplinasComExecNoCiclo = new Set(
            estadoMaterias.materias.map((m) => normalizarNomeDisciplina(m.disciplinaNome)),
          );

          const proxima = carga.proximaSessao ?? undefined;
          if (estadoMaterias.aguardandoNovaRodada) {
            this.proximaSessaoDto = undefined;
            this.selecionadoCicloItemId = undefined;
            this.selecionado = undefined;
            this.tempoPlanejadoLabel = '';
          } else if (proxima) {
            this.proximaSessaoDto = proxima;
            this.selecionadoCicloItemId = proxima.cicloItemId;
            this.tempoPlanejadoLabel = TempoFormatUtil.minutosParaHorasMin(proxima.tempoMinutos);
            this.alinharProximaSessaoAoCiclo();
          }

          this.progressoBruto = carga.progresso ?? [];
          this.recalcularProgresso();

          const lista = carga.recentes ?? [];
          const inicializadas = lista
            .filter((s) => this.sessaoCronometroJaIniciou(s))
            .filter((s) => this.disciplinaAindaNoCicloExec(s.disciplinaId, s.disciplinaNome));
          this.recentSessions = inicializadas.map((s) => this.mapSessaoParaCard(s));
          this.aplicarObservacoesDasSessoes(inicializadas);

          this.cdr.detectChanges();
        },
      });
  }

  iniciarNovaRodadaConfirmada(): void {
    if (this.iniciandoNovaRodada()) {
      return;
    }
    this.iniciandoNovaRodada.set(true);
    this.ciclosApi
      .iniciarNovaRodada(this.cicloId)
      .pipe(finalize(() => this.iniciandoNovaRodada.set(false)))
      .subscribe({
        next: (nr) => {
          this.toastr.success(`Nova rodada iniciada (rodada nº ${nr.numeroRodada}).`);
          this.carregarEstudarAgora();
        },
        error: () => this.toastr.error('Não foi possível iniciar a nova rodada. Tente novamente.'),
      });
  }

  /** Mesma regra das observações: só matérias que ainda têm bloco com ordem no ciclo atual. */
  private disciplinaAindaNoCicloExec(disciplinaId?: number | null, disciplinaNome?: string | null): boolean {
    if (this.disciplinaIdsComExecNoCiclo.size > 0) {
      return typeof disciplinaId === 'number' && Number.isFinite(disciplinaId)
        && this.disciplinaIdsComExecNoCiclo.has(disciplinaId);
    }
    return this.nomesDisciplinasComExecNoCiclo.has(normalizarNomeDisciplina(disciplinaNome ?? ''));
  }

  /** Só entra em “Últimas sessões” após o primeiro comecar (campo inicio preenchido). */
  private sessaoCronometroJaIniciou(s: SessaoCardDto): boolean {
    const ini = s.inicio;
    if (ini == null || String(ini).trim() === '') {
      return false;
    }
    const t = Date.parse(String(ini));
    return !Number.isNaN(t);
  }

  private mapSessaoParaCard(s: SessaoCardDto) {
    const estudadoSeg = Number(s.estudadoTotalSeg ?? s.segundosEstudados ?? 0);
    const restanteSeg = Math.max(0, Number(s.segundosRestantes ?? 0));
    const baseDate = s.fim ?? s.inicio;
    const statusNormalizado = this.normalizarStatusSessao(s.status, estudadoSeg, restanteSeg);

    const ordem = s.ordemNoCiclo;
    const numero =
      ordem != null && Number.isFinite(Number(ordem)) && Number(ordem) > 0 ? Number(ordem) : undefined;

    return {
      sessaoId: s.id,
      numero,
      label: baseDate ? this.formatLabelFromFimOrInicio(baseDate) : '—',
      disciplina: s.disciplinaNome,
      studiedLabel: this.formatSeconds(estudadoSeg),
      remainingLabel: s.fim ? undefined : this.formatSeconds(restanteSeg),
      status: statusNormalizado,
      estudadoTotalSeg: s.estudadoTotalSeg,
    };
  }

  private normalizarStatusSessao(
    status: SessaoCardDto['status'],
    estudadoSeg: number,
    restanteSeg: number,
  ): SessaoCardDto['status'] {
    // Sessão sem progresso real não pode aparecer como concluída
    // quando ainda existe tempo restante.
    if (estudadoSeg <= 0 && restanteSeg > 0) {
      return 'PAUSADA';
    }
    return status;
  }

  private recalcularProgresso(): void {
    this.progress = this.progressoBruto.map((p) => ({
      disciplina: p.disciplinaNome,
      disciplinaId:
        p.disciplinaId != null && Number.isFinite(Number(p.disciplinaId))
          ? Number(p.disciplinaId)
          : undefined,
      percent: normalizarPercentualProgressoUtil(p, (nome) => this.obterMetaDaDisciplina(nome)),
    }));
    this.cdr.detectChanges();
  }

  irHistoricoDisciplina(disciplinaId: number): void {
    if (!Number.isFinite(this.cicloId) || this.cicloId <= 0 || !Number.isFinite(disciplinaId)) {
      return;
    }
    void this.router.navigate(['/ciclos', this.cicloId, 'disciplina', disciplinaId, 'historico']);
  }

  private obterMetaDaDisciplina(disciplinaNome: string): number {
    const key = normalizarNomeDisciplina(disciplinaNome);
    if (!key) return 0;
    const item = this.itens.find((i) => normalizarNomeDisciplina(i.disciplinaNome) === key);
    const meta = Number(item?.tempoMinutos ?? 0);
    return Number.isFinite(meta) && meta > 0 ? meta : 0;
  }

  iniciarEstudo(): void {
    if (this.aguardandoNovaRodada()) {
      this.toastr.info('Inicie uma nova rodada para continuar estudando este ciclo.');
      return;
    }
    if (!this.proximaSessaoDto) {
      return;
    }
    this.executarInicioDeSessao(this.proximaSessaoDto.cicloItemId);
  }

  /**
   * Se a API indicar como próxima uma matéria já concluída, alinha ao primeiro item elegível do ciclo
   * (lógica partilhada com o dashboard — ver {@link alinharProximaSessaoAoItensDoCiclo}).
   */
  private alinharProximaSessaoAoCiclo(): void {
    const dto = this.proximaSessaoDto;
    if (!dto || !this.itens.length) {
      return;
    }

    const alinhado = alinharProximaSessaoAoItensDoCiclo(
      dto,
      this.itens as unknown as CicloMateriaDto[],
    );
    if (!alinhado) {
      this.proximaSessaoDto = undefined;
      this.selecionadoCicloItemId = undefined;
      this.selecionado = undefined;
      this.tempoPlanejadoLabel = '';
      return;
    }

    this.proximaSessaoDto = alinhado;
    const sel = this.itens.find((i) => i.cicloItemId === alinhado.cicloItemId);
    this.selecionadoCicloItemId = alinhado.cicloItemId;
    this.selecionado = sel;
    this.tempoPlanejadoLabel = TempoFormatUtil.minutosParaHorasMin(alinhado.tempoMinutos);
  }

  onStartSession(item: CicloItemView): void {
    if (this.aguardandoNovaRodada()) {
      this.toastr.info('Inicie uma nova rodada para escolher uma matéria.');
      this.modalOpen = false;
      return;
    }
    if (item.concluida) {
      this.toastr.warning('Esta matéria já foi concluída no ciclo.');
      return;
    }
    this.modalOpen = false;
    this.executarInicioDeSessao(item.cicloItemId);
  }

  private executarInicioDeSessao(cicloItemId: number): void {
    if (this.isProcessando()) return;
    if (this.aguardandoNovaRodada()) {
      this.toastr.info('Inicie uma nova rodada antes de abrir uma sessão.');
      return;
    }

    const meta = this.itens.find((i) => i.cicloItemId === cicloItemId);
    if (meta?.concluida) {
      this.toastr.warning('Esta matéria já foi concluída no ciclo.');
      return;
    }

    this.estudoApi.iniciarSessao(this.cicloId, { cicloItemId }).pipe(
      finalize(() => this.isProcessando.set(false))
    ).subscribe({
      next: (s) => {
        if (s?.id) {
          this.router.navigate(['/estudo/sessao', s.id], { state: { cicloId: this.cicloId } });
        } else {
          this.toastr.error('Erro de ID');
        }
      },
      error: () => this.toastr.error('Erro ao iniciar')
    });
  }

  abrirEscolha(): void {
    if (this.aguardandoNovaRodada()) {
      this.toastr.info('Inicie uma nova rodada para escolher uma matéria.');
      return;
    }
    this.modalOpen = true;
  }

  onSelectItem(i: CicloItemView): void {
    this.selecionado = i;
    this.modalOpen = false;
  }

  private formatSeconds(total: number): string {
    const sec = Math.max(0, Math.floor(total));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  private formatLabelFromFimOrInicio(iso: string): string {
    const d = new Date(iso);
    const now = new Date();

    const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86400000);

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  private aplicarObservacoesDasSessoes(sessoes: SessaoCardDto[]): void {
    this.observacoesLoading.set(false);
    const notas = (sessoes ?? [])
      .filter((s) => this.disciplinaAindaNoCicloExec(s.disciplinaId, s.disciplinaNome))
      .map((s) => {
        const dataSessao = s.inicio ?? s.fim;
        return {
          sessaoId: s.id,
          disciplina: s.disciplinaNome,
          observacao: (s.observacoes ?? '').trim(),
          dataIso: dataSessao ?? '',
          dataLabel: this.formatDataHora(dataSessao),
        };
      })
      .filter((n) => !!n.observacao)
      .sort((a, b) => Date.parse(b.dataIso) - Date.parse(a.dataIso));

    this.observacoesMateria = notas;
  }

  private formatDataHora(iso?: string | null): string {
    if (!iso) return 'Sem data';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Sem data';

    // Exibição fixa no card: dd/MM
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

}
