import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subscription, finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { CicloOption, CicloSelector, } from '../../../../shared/components/ciclo-selector/ciclo-selector';
import { MetricCard } from '../../../../shared/components/metric-card/metric-card';
import { ProgressBar, ProgressDisciplinaItem } from '../../../../shared/components/progress-bar/progress-bar';
import { WeekChart } from '../../../../shared/components/week-chart/week-chart';
import { ConstanciaStrip } from '../../../../shared/components/constancia-strip/constancia-strip';
import {
  normalizarNomeDisciplina,
  normalizarPercentualProgresso,
} from '../../../../shared/utils/progresso-disciplina.util';
import { alinharProximaSessaoAoItensDoCiclo } from '../../../../shared/utils/proxima-sessao-ciclo.util';
import { resolverCicloPadrao } from '../../../../shared/service/resolverCicloPadrao';
import { CicloMateriaDto, CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import { EstudoApiService } from '../../../estudo/data/estudo-api.service';
import { persistirCicloContextoEstudo } from '../../../estudo/utils/estudo-contexto-ciclo.storage';
import { ProgressoDisciplinaDto as ProgressoEstudoDto } from '../../../estudo/data/estudo.models';

import {
  DashboardApiService,
  DashboardResumoDto,
  DashboardSemanaSoDiarioDto,
  DiaConstanciaDto,
  ProgressoDisciplinaDto,
  SessaoCardDto,
  WeekDayDto,
} from '../../data/dashboard-api.service';

type FooterTone = 'success' | 'warn' | 'muted' | 'primary';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, MetricCard, WeekChart, ProgressBar, CicloSelector, ConstanciaStrip],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage implements OnInit, OnDestroy {

  toast = inject(ToastrService);

  ciclos: CicloOption[] = [];
  cicloId: number | null = null;
  ciclosLoading = signal(false);

  loading = true;
  resumo?: DashboardResumoDto;

  // ===== Card TIME =====
  timeValue = '—';
  timeFooterText = '';
  timeFooterTone: FooterTone = 'muted';

  // ===== Card STREAK =====
  streakValue = '—';
  streakFooterText = '';

  // ===== Faixa de CONSTÂNCIA (global, todos os ciclos) =====
  constanciaDias: DiaConstanciaDto[] = [];
  constanciaStreak: number | null = null;
  constanciaLoading = signal(false);
  /** Quantos dias mostrar na faixa de constância. */
  private static readonly CONSTANCIA_DIAS = 30;

  // ===== Card HORAS DO CICLO =====
  cicloHorasFeitas = '—';
  cicloHorasEsperadas = '—';
  cicloHorasFooterText = '';
  cicloHorasFooterTone: FooterTone = 'muted';

  // ===== Card AÇÃO (Retomar OU Próxima) =====
  actionTitle = '—';
  actionSubtitle = '';
  actionFooterText = '';
  actionFooterTone: FooterTone = 'muted';
  actionText = '';
  actionDisabled = signal(true);
  /** Loading ao iniciar sessão (próxima matéria) antes de ir para `/estudo/sessao`. */
  acaoCardLoading = signal(false);
  private actionSessaoId: number | null = null;
  /** Para “Iniciar”: `cicloItemId` da próxima matéria recomendada. */
  private actionCicloItemId: number | null = null;
  private actionIsRetomar = signal(false);

  // semana: WeekDayDto[] = []; // gráfico "Estudos da semana" desativado
  /** Gráfico ativo (teste): só `estudo_diario_ciclo`. */
  semanaSoDiario: WeekDayDto[] = [];
  /** Mesma fonte/normalização que Estudar Agora (`getProgressoCiclo` + meta das matérias). */
  progressoItems: ProgressDisciplinaItem[] = [];

  private readonly LS_KEY = 'cognora:lastCicloId';
  /** Preferência A/B: ordem dos 4 cards quando a grelha vira uma coluna (telemóvel / tablet estreito). */
  private static readonly LS_MOBILE_CARD_ORDER = 'cognora.dashboard.mobileCardOrder';

  /** `summary-first` = como no desktop (tempo → … → sessão). `session-first` = CTA “Sessão” no topo. */
  cardsMobileOrder = signal<'summary-first' | 'session-first'>('summary-first');

  // private weekStartIso = ''; // navegação do gráfico legado desativada

  /** Segunda-feira da semana exibida no gráfico “só diário”. */
  private weekStartIsoDiario = '';

  /** Pedido em curso só para `getSemanaSoDiario` (navegação do 2.º gráfico). */
  soDiarioLoading = signal(false);

  private resumoLoadSub?: Subscription;
  private soDiarioLoadSub?: Subscription;
  private constanciaLoadSub?: Subscription;

  dashboardApi = inject(DashboardApiService);
  ciclosApi = inject(CiclosApiService);
  estudoApi = inject(EstudoApiService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  auth = inject(AuthService);

  constructor() { }

  ngOnInit(): void {
    const user = this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.readMobileCardOrderPref();
    this.carregarCiclos();
    this.carregarConstancia();
  }

  /** Faixa de constância é global (todos os ciclos): carrega uma vez, independente do ciclo selecionado. */
  private carregarConstancia(): void {
    this.constanciaLoadSub?.unsubscribe();
    this.constanciaLoading.set(true);
    this.constanciaLoadSub = this.dashboardApi
      .getConstancia(DashboardPage.CONSTANCIA_DIAS)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.constanciaLoading.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe((res) => {
        this.constanciaDias = res?.dias ?? [];
        this.constanciaStreak = res?.streakAtual ?? null;
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.resumoLoadSub?.unsubscribe();
    this.soDiarioLoadSub?.unsubscribe();
    this.constanciaLoadSub?.unsubscribe();
  }

  private readMobileCardOrderPref(): void {
    try {
      const v = localStorage.getItem(DashboardPage.LS_MOBILE_CARD_ORDER);
      if (v === 'session-first' || v === 'summary-first') {
        this.cardsMobileOrder.set(v);
      }
    } catch {
      /* ignore */
    }
  }

  setMobileCardOrder(order: 'summary-first' | 'session-first'): void {
    this.cardsMobileOrder.set(order);
    try {
      localStorage.setItem(DashboardPage.LS_MOBILE_CARD_ORDER, order);
    } catch {
      /* ignore */
    }
  }

  onCicloChange(id: number): void {
    if (!id || id <= 0 || this.cicloId === id) return;
    this.cicloId = id;
    this.salvarCicloPreferido(id);
    const hojeSeg = this.getMondayIso(new Date());
    this.weekStartIsoDiario = hojeSeg;
    this.carregarResumo();
  }

  /*
  get intervaloSemanaLabel(): string { ... }
  get semanaPosteriorDesabilitada(): boolean { ... }
  semanaAnterior(): void { ... }
  proximaSemana(): void { ... }
  */

  get intervaloSemanaSoDiarioLabel(): string {
    const start = this.weekStartIsoDiario || this.getMondayIso(new Date());
    const end = this.addDaysIso(start, 6);
    return this.formatarIntervaloSemana(start, end);
  }

  get semanaPosteriorDesabilitadaSoDiario(): boolean {
    const cur = this.getMondayIso(new Date());
    const start = this.weekStartIsoDiario || this.getMondayIso(new Date());
    return start >= cur;
  }

  semanaAnteriorSoDiario(): void {
    if (!this.cicloId || this.loading || this.soDiarioLoading()) {
      return;
    }
    if (!this.weekStartIsoDiario) {
      this.weekStartIsoDiario = this.getMondayIso(new Date());
    }
    this.weekStartIsoDiario = this.addDaysIso(this.weekStartIsoDiario, -7);
    this.carregarSoDiarioSolo();
  }

  proximaSemanaSoDiario(): void {
    if (
      !this.cicloId ||
      this.loading ||
      this.soDiarioLoading() ||
      this.semanaPosteriorDesabilitadaSoDiario
    ) {
      return;
    }
    if (!this.weekStartIsoDiario) {
      this.weekStartIsoDiario = this.getMondayIso(new Date());
    }
    const cur = this.getMondayIso(new Date());
    const next = this.addDaysIso(this.weekStartIsoDiario, 7);
    if (next > cur) {
      return;
    }
    this.weekStartIsoDiario = next;
    this.carregarSoDiarioSolo();
  }

  private async carregarCiclos(): Promise<void> {
    this.ciclosLoading.set(true);

    try {
      // Aguarda a resposta da API de forma linear
      const list = await this.ciclosApi.listCiclos();

      this.ciclos = (list ?? []).map((c: any) => ({
        id: Number(c.id),
        nome: String(c.nome ?? `Ciclo ${c.id}`),
      }));

      const preferido = this.lerCicloPreferido();
      this.cicloId = resolverCicloPadrao(this.ciclos, preferido);

      if (this.cicloId) {
        this.salvarCicloPreferido(this.cicloId);
      }

      if (!this.weekStartIsoDiario) {
        this.weekStartIsoDiario = this.getMondayIso(new Date());
      }

      // Como é uma sequência lógica, o resumo só carrega após o sucesso dos ciclos
      await this.carregarResumo();

    } catch (error) {
      console.error('Erro ao carregar ciclos:', error);
      this.toast.error('Não foi possível carregar os ciclos.');
    } finally {
      // Executa sempre (sucesso ou erro), garantindo que o loading pare
      this.ciclosLoading.set(false);
      this.cdr.detectChanges();
    }
  }


  private carregarResumo(): Promise<void> {
    if (!this.cicloId) {
      return Promise.resolve();
    }

    const cicloId = this.cicloId;

    if (!this.weekStartIsoDiario) {
      this.weekStartIsoDiario = this.getMondayIso(new Date());
    }

    this.resumoLoadSub?.unsubscribe();
    this.loading = true;

    return new Promise((resolve, reject) => {
      this.resumoLoadSub = forkJoin({
        resumo: this.dashboardApi.getResumo(cicloId, {
          chartWeekStart: this.weekStartIsoDiario,
        }),
        estadoMaterias: this.ciclosApi.getMateriasCiclo(cicloId).pipe(
          catchError(() => of(null)),
        ),
      }).subscribe({
        next: ({ resumo: r, estadoMaterias }) => {
          this.resumo = r;
          this.timeValue = this.formatSecondsToHMin(r.estudadoSemanaSeg ?? 0);
          this.aplicarDeltaSemana(r.deltaSemanaSeg ?? 0);

          const streak = r.streakDias ?? 0;
          this.streakValue = `${streak} dia${streak === 1 ? '' : 's'} consecutivo${streak === 1 ? '' : 's'}`;
          this.streakFooterText = `Recorde: ${r.recordeStreakDias ?? 0} dias`;

          const materiasList = estadoMaterias?.materias ?? [];
          const aguardandoNovaRodada = estadoMaterias?.aguardandoNovaRodada ?? false;
          const proximaAlinhada = aguardandoNovaRodada
            ? null
            : alinharProximaSessaoAoItensDoCiclo(r.proximaSessao ?? undefined, materiasList);

          this.aplicarCardAcao(r.recentes ?? [], proximaAlinhada);

          const soDiario = r.semanaSoDiario;
          this.semanaSoDiario = soDiario?.semana ?? [];
          this.aplicarProgressoPorDisciplina(r.progresso ?? [], materiasList);

          this.loading = false;
          this.cdr.detectChanges();
          resolve();
        },
        error: (err) => {
          this.loading = false;
          this.cdr.detectChanges();
          reject(err);
        },
      });
    });
  }

  /** Atualiza só o gráfico “só diário” (navegação independente da semana do resumo). */
  private carregarSoDiarioSolo(): void {
    if (!this.cicloId) {
      return;
    }
    const cicloId = this.cicloId;
    if (!this.weekStartIsoDiario) {
      this.weekStartIsoDiario = this.getMondayIso(new Date());
    }
    this.soDiarioLoadSub?.unsubscribe();
    this.soDiarioLoading.set(true);
    this.soDiarioLoadSub = this.dashboardApi
      .getSemanaSoDiario(cicloId, this.weekStartIsoDiario)
      .pipe(
        catchError(() =>
          of<DashboardSemanaSoDiarioDto>({
            cicloId,
            segundaFeiraSemana: this.weekStartIsoDiario,
            estudadoSemanaSeg: 0,
            semana: [],
          }),
        ),
        finalize(() => {
          this.soDiarioLoading.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe((soDiario) => {
        this.semanaSoDiario = soDiario.semana ?? [];
        this.cdr.detectChanges();
      });
  }

  /**
   * Progresso por disciplina a partir do resumo do dashboard + metas das matérias do ciclo.
   * Só dispara `getProgressoCiclo` quando o resumo não trouxe progresso.
   */
  private aplicarProgressoPorDisciplina(
    fallbackResumo: ProgressoDisciplinaDto[],
    materiasList: CicloMateriaDto[],
  ): void {
    if (!this.cicloId) {
      this.progressoItems = [];
      return;
    }

    if (fallbackResumo.length > 0) {
      this.montarProgressoItems(fallbackResumo as unknown as ProgressoEstudoDto[], materiasList);
      return;
    }

    const cicloId = this.cicloId;
    this.estudoApi
      .getProgressoCiclo(cicloId)
      .pipe(catchError(() => of([] as ProgressoEstudoDto[])))
      .subscribe((progresso) => {
        this.montarProgressoItems(progresso ?? [], materiasList);
        this.cdr.detectChanges();
      });
  }

  private montarProgressoItems(lista: ProgressoEstudoDto[], materiasList: CicloMateriaDto[]): void {
    const getMeta = (nome: string): number => {
      const key = normalizarNomeDisciplina(nome);
      const item = materiasList.find((m) => normalizarNomeDisciplina(m.disciplinaNome) === key);
      const meta = Number(item?.tempoMinutos ?? 0);
      return Number.isFinite(meta) && meta > 0 ? meta : 0;
    };

    this.aplicarCardHorasCiclo(lista, materiasList, getMeta);

    this.progressoItems = lista.map((p) => ({
      name: p.disciplinaNome,
      percent: normalizarPercentualProgresso(p, getMeta),
      disciplinaId: Number.isFinite(Number(p.disciplinaId)) ? Number(p.disciplinaId) : undefined,
    }));
  }

  private aplicarCardHorasCiclo(
    lista: ProgressoEstudoDto[],
    materias: CicloMateriaDto[],
    getMeta: (nome: string) => number,
  ): void {
    const metaTotalMin = (materias ?? []).reduce((acc, m) => acc + Math.max(0, Number(m.tempoMinutos ?? 0)), 0);

    const feitosTotalMin = (lista ?? []).reduce((acc, p) => {
      const feitosDireto = Number((p as any).minutosFeitos ?? 0);
      if (Number.isFinite(feitosDireto) && feitosDireto > 0) {
        return acc + feitosDireto;
      }

      // Fallback quando vier apenas percentual no DTO.
      const meta = Number((p as any).minutosMeta ?? getMeta(p.disciplinaNome) ?? 0);
      const perc = Number((p as any).percentual ?? 0);
      if (!Number.isFinite(meta) || !Number.isFinite(perc) || meta <= 0 || perc <= 0) {
        return acc;
      }
      return acc + Math.round((meta * perc) / 100);
    }, 0);

    this.cicloHorasEsperadas = this.formatMinutesToHMin(metaTotalMin);
    this.cicloHorasFeitas = this.formatMinutesToHMin(feitosTotalMin);

    const percentual = metaTotalMin > 0 ? Math.min(100, Math.round((feitosTotalMin / metaTotalMin) * 100)) : 0;
    this.cicloHorasFooterText = `${percentual}% concluído do ciclo`;
    this.cicloHorasFooterTone = percentual >= 70 ? 'success' : percentual >= 35 ? 'primary' : 'warn';
  }

  private aplicarCardAcao(recentes: SessaoCardDto[], proxima: any): void {
    const ultima = (recentes ?? [])[0];
    const status = String(ultima?.status ?? '').toUpperCase();

    const podeRetomar = status === 'PAUSADA' || status === 'EM_ANDAMENTO';

    if (ultima && podeRetomar) {
      this.actionIsRetomar.set(true);
      this.actionSessaoId = Number(ultima.id);
      this.actionCicloItemId = null;

      this.actionTitle = ultima.disciplinaNome ?? 'Sessão em andamento';
      this.actionSubtitle = `Estudado: ${this.formatSecondsClock(
        Number((ultima as any).estudadoTotalSeg ?? ultima.segundosEstudados ?? 0)
      )}`;

      this.actionFooterText = this.mapStatus(status);
      this.actionFooterTone = status === 'PAUSADA' ? 'warn' : 'primary';
      this.actionText = 'Retomar';
      this.actionDisabled.set(false);
      return;
    }

    // PRÓXIMA SESSÃO
    if (proxima) {
      this.actionIsRetomar.set(false);
      this.actionSessaoId = null;
      this.actionCicloItemId =
        proxima.cicloItemId != null && Number.isFinite(Number(proxima.cicloItemId))
          ? Number(proxima.cicloItemId)
          : null;

      this.actionTitle = proxima.disciplinaNome ?? 'Próxima sessão';
      this.actionSubtitle = `${proxima.tempoMinutos ?? 0} minutos`;
      this.actionFooterText = 'Próxima sessão recomendada';
      this.actionFooterTone = 'success';
      this.actionText = 'Iniciar';
      this.actionDisabled.set(this.actionCicloItemId == null);
      return;
    }

    // NADA
    this.actionTitle = 'Sem sessões';
    this.actionSubtitle = '';
    this.actionFooterText = '';
    this.actionFooterTone = 'muted';
    this.actionText = '';
    this.actionCicloItemId = null;
    this.actionDisabled.set(true);
  }

  onDisciplinaHistorico(item: ProgressDisciplinaItem): void {
    if (this.cicloId == null || item.disciplinaId == null) {
      return;
    }
    void this.router.navigate(['/ciclos', this.cicloId, 'disciplina', item.disciplinaId, 'historico']);
  }

  onActionClick(): void {
    if (this.loading || this.acaoCardLoading()) {
      return;
    }

    if (this.actionIsRetomar() && this.actionSessaoId) {
      persistirCicloContextoEstudo(this.cicloId);
      this.router.navigate(['/estudo/sessao', this.actionSessaoId], {
        state: this.cicloId != null ? { cicloId: this.cicloId } : undefined,
      });
      return;
    }

    const cicloItemId = this.actionCicloItemId;
    if (this.cicloId && cicloItemId) {
      this.acaoCardLoading.set(true);
      this.estudoApi
        .iniciarSessao(this.cicloId, { cicloItemId })
        .pipe(
          finalize(() => {
            this.acaoCardLoading.set(false);
            this.cdr.detectChanges();
          }),
        )
        .subscribe({
          next: (s) => {
            if (s?.id) {
              persistirCicloContextoEstudo(this.cicloId);
              this.router.navigate(['/estudo/sessao', s.id], {
                state: this.cicloId != null ? { cicloId: this.cicloId } : undefined,
              });
            } else {
              this.toast.error('Resposta da sessão inválida.');
            }
          },
          error: () => this.toast.error('Não foi possível abrir a sessão de estudo.'),
        });
    }
  }

  private aplicarDeltaSemana(delta: number): void {
    const abs = this.formatSecondsToHMin(Math.abs(delta));
    if (delta > 0) {
      this.timeFooterText = `▲ ${abs} em relação à última semana`;
      this.timeFooterTone = 'success';
    } else if (delta < 0) {
      this.timeFooterText = `▼ ${abs} em relação à última semana`;
      this.timeFooterTone = 'warn';
    } else {
      this.timeFooterText = '• Sem variação em relação à última semana';
      this.timeFooterTone = 'muted';
    }
  }

  private formatSecondsToHMin(totalSec: number): string {
    const sec = Math.max(0, Math.floor(totalSec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  private formatSecondsClock(totalSec: number): string {
    const sec = Math.max(0, Math.floor(totalSec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  private formatMinutesToHMin(totalMin: number): string {
    const mins = Math.max(0, Math.floor(totalMin || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  private mapStatus(status: string): string {
    switch (status) {
      case 'PAUSADA': return 'Pausada';
      case 'EM_ANDAMENTO': return 'Em andamento';
      case 'CONCLUIDA': return 'Concluída';
      case 'ENCERRADA': return 'Encerrada';
      default: return '—';
    }
  }

  private getMondayIso(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    return this.toIsoDate(d);
  }

  private addDaysIso(iso: string, days: number): string {
    const d = this.parseIsoDate(iso);
    d.setDate(d.getDate() + days);
    return this.toIsoDate(d);
  }

  private parseIsoDate(iso: string): Date {
    const [y, m, d] = (iso ?? '').split('-').map((x) => Number(x));
    if (!y || !m || !d) {
      return new Date();
    }
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  }

  private formatarIntervaloSemana(weekStart: string, weekEnd: string): string {
    if (!weekStart || !weekEnd) {
      return '—';
    }
    const a = this.parseIsoDate(weekStart);
    const b = this.parseIsoDate(weekEnd);
    const fmt = (x: Date) =>
      x
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        .replace('.', '');
    return `${fmt(a)} – ${fmt(b)} ${b.getFullYear()}`;
  }

  private lerCicloPreferido(): number | null {
    const id = Number(localStorage.getItem(this.LS_KEY));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private salvarCicloPreferido(id: number): void {
    localStorage.setItem(this.LS_KEY, String(id));
  }
}