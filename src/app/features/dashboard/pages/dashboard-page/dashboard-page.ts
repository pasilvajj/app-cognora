import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { finalize, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { CicloOption, CicloSelector, } from '../../../../shared/components/ciclo-selector/ciclo-selector';
import { MetricCard } from '../../../../shared/components/metric-card/metric-card';
import { ProgressBar, ProgressDisciplinaItem } from '../../../../shared/components/progress-bar/progress-bar';
import { WeekChart } from '../../../../shared/components/week-chart/week-chart';
import {
  normalizarNomeDisciplina,
  normalizarPercentualProgresso,
} from '../../../../shared/utils/progresso-disciplina.util';
import { alinharProximaSessaoAoItensDoCiclo } from '../../../../shared/utils/proxima-sessao-ciclo.util';
import { resolverCicloPadrao } from '../../../../shared/service/resolverCicloPadrao';
import { CicloMateriaDto, CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import { EstudoApiService } from '../../../estudo/data/estudo-api.service';
import { ProgressoDisciplinaDto as ProgressoEstudoDto } from '../../../estudo/data/estudo.models';

import {
  DashboardApiService, DashboardResumoDto, ProgressoDisciplinaDto,
  SessaoCardDto,
  WeekDayDto,
} from '../../data/dashboard-api.service';

type FooterTone = 'success' | 'warn' | 'muted' | 'primary';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, MetricCard, WeekChart, ProgressBar, CicloSelector],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage implements OnInit {

  private usuarioId!: number;

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

  semana: WeekDayDto[] = [];
  /** Mesma fonte/normalização que Estudar Agora (`getProgressoCiclo` + meta das matérias). */
  progressoItems: ProgressDisciplinaItem[] = [];

  private readonly LS_KEY = 'cognora:lastCicloId';
  /** Preferência A/B: ordem dos 4 cards quando a grelha vira uma coluna (telemóvel / tablet estreito). */
  private static readonly LS_MOBILE_CARD_ORDER = 'cognora.dashboard.mobileCardOrder';

  /** `summary-first` = como no desktop (tempo → … → sessão). `session-first` = CTA “Sessão” no topo. */
  cardsMobileOrder = signal<'summary-first' | 'session-first'>('summary-first');

  /** Segunda-feira (yyyy-MM-dd) da semana exibida no resumo e no gráfico. */
  private weekStartIso = '';

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

    this.usuarioId = user.id;
    this.readMobileCardOrderPref();
    this.carregarCiclos();
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
    this.weekStartIso = this.getMondayIso(new Date());
    this.carregarResumo();
  }

  get intervaloSemanaLabel(): string {
    const start = this.weekStartIso || this.getMondayIso(new Date());
    const end = this.addDaysIso(start, 6);
    return this.formatarIntervaloSemana(start, end);
  }

  get semanaPosteriorDesabilitada(): boolean {
    const cur = this.getMondayIso(new Date());
    return !this.weekStartIso || this.weekStartIso >= cur;
  }

  semanaAnterior(): void {
    if (!this.cicloId || this.loading) {
      return;
    }
    if (!this.weekStartIso) {
      this.weekStartIso = this.getMondayIso(new Date());
    }
    this.weekStartIso = this.addDaysIso(this.weekStartIso, -7);
    this.carregarResumo();
  }

  proximaSemana(): void {
    if (!this.cicloId || this.loading || this.semanaPosteriorDesabilitada) {
      return;
    }
    const cur = this.getMondayIso(new Date());
    const next = this.addDaysIso(this.weekStartIso, 7);
    if (next > cur) {
      return;
    }
    this.weekStartIso = next;
    this.carregarResumo();
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

      if (!this.weekStartIso) {
        this.weekStartIso = this.getMondayIso(new Date());
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


  private carregarResumo(): void {
    if (!this.cicloId) return;

    const cicloId = this.cicloId;
    const usuarioId = this.usuarioId;

    if (!this.weekStartIso) {
      this.weekStartIso = this.getMondayIso(new Date());
    }

    this.loading = true;

    forkJoin({
      resumo: this.dashboardApi.getResumo(usuarioId, cicloId, this.weekStartIso),
      estadoMaterias: this.ciclosApi.getMateriasCiclo(cicloId, usuarioId).pipe(
        catchError(() => of(null)),
      ),
    }).subscribe({
      next: ({ resumo: r, estadoMaterias }) => {
        this.resumo = r;
        this.timeValue = this.formatSecondsToHMin(r.estudadoSemanaSeg ?? 0);
        this.aplicarDeltaSemana(r.deltaSemanaSeg ?? 0);

        // ===== STREAK =====
        const streak = r.streakDias ?? 0;
        this.streakValue = `${streak} dia${streak === 1 ? '' : 's'} consecutivo${streak === 1 ? '' : 's'}`;
        this.streakFooterText = `Recorde: ${r.recordeStreakDias ?? 0} dias`;

        const materiasList = estadoMaterias?.materias ?? [];
        const aguardandoNovaRodada = estadoMaterias?.aguardandoNovaRodada ?? false;
        const proximaAlinhada = aguardandoNovaRodada
          ? null
          : alinharProximaSessaoAoItensDoCiclo(r.proximaSessao ?? undefined, materiasList);

        // ===== CARD DE AÇÃO (sem “próxima matéria” entre rodadas até confirmar nova volta no Estudar Agora) =====
        this.aplicarCardAcao(r.recentes ?? [], proximaAlinhada);

        // ===== CHART / PROGRESSO =====
        this.semana = r.semana ?? [];
        this.carregarProgressoPorDisciplina(r.progresso ?? [], materiasList);

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Progresso por disciplina: `EstudoApiService.getProgressoCiclo` + meta via matérias do ciclo
   * (equivalente ao painel em Estudar Agora). Em falha parcial, usa `progresso` do resumo do dashboard.
   */
  private carregarProgressoPorDisciplina(
    fallbackResumo: ProgressoDisciplinaDto[],
    materiasPrefetched?: CicloMateriaDto[],
  ): void {
    if (!this.cicloId) {
      this.progressoItems = [];
      return;
    }

    const cicloId = this.cicloId;
    const usuarioId = this.usuarioId;

    const materias$ =
      materiasPrefetched !== undefined
        ? of(materiasPrefetched)
        : this.ciclosApi.getMateriasCiclo(cicloId, usuarioId).pipe(
            map((resp) => resp?.materias ?? []),
            catchError(() => of([] as CicloMateriaDto[])),
          );

    forkJoin({
      progresso: this.estudoApi.getProgressoCiclo(cicloId, usuarioId).pipe(
        catchError(() => of([] as ProgressoEstudoDto[])),
      ),
      materias: materias$,
    }).subscribe(({ progresso, materias }) => {
      const materiasList = materias ?? [];
      const getMeta = (nome: string): number => {
        const key = normalizarNomeDisciplina(nome);
        const item = materiasList.find((m) => normalizarNomeDisciplina(m.disciplinaNome) === key);
        const meta = Number(item?.tempoMinutos ?? 0);
        return Number.isFinite(meta) && meta > 0 ? meta : 0;
      };

      let lista: ProgressoEstudoDto[] = progresso ?? [];
      if (!lista.length && fallbackResumo.length) {
        lista = fallbackResumo as unknown as ProgressoEstudoDto[];
      }

      this.aplicarCardHorasCiclo(lista, materiasList, getMeta);

      this.progressoItems = lista.map((p) => ({
        name: p.disciplinaNome,
        percent: normalizarPercentualProgresso(p, getMeta),
      }));
      this.cdr.detectChanges();
    });
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

  onActionClick(): void {
    if (this.loading || this.acaoCardLoading()) {
      return;
    }

    if (this.actionIsRetomar() && this.actionSessaoId) {
      this.router.navigate(['/estudo/sessao', this.actionSessaoId]);
      return;
    }

    const cicloItemId = this.actionCicloItemId;
    if (this.cicloId && cicloItemId) {
      this.acaoCardLoading.set(true);
      this.estudoApi
        .iniciarSessao({
          usuarioId: this.usuarioId,
          cicloId: this.cicloId,
          cicloItemId,
        })
        .pipe(
          finalize(() => {
            this.acaoCardLoading.set(false);
            this.cdr.detectChanges();
          }),
        )
        .subscribe({
          next: (s) => {
            if (s?.id) {
              this.router.navigate(['/estudo/sessao', s.id]);
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