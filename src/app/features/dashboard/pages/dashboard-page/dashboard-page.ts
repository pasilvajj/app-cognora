import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MetricCard } from '../../../../shared/components/metric-card/metric-card';
import { WeekChart } from '../../../../shared/components/week-chart/week-chart';
import { ProgressBar } from '../../../../shared/components/progress-bar/progress-bar';
import { DashboardApiService, DashboardResumoDto, ProgressoDisciplinaDto, WeekDayDto,  SessaoCardDto,
} from '../../data/dashboard-api.service';
import { CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import { CicloSelector, CicloOption,} from '../../../../shared/components/ciclo-selector/ciclo-selector';
import { resolverCicloPadrao } from '../../../../shared/service/resolverCicloPadrao';
import { AuthService } from '../../../../core/auth/auth.service';

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

  ciclos: CicloOption[] = [];
  cicloId: number | null = null;
  ciclosLoading = false;

  loading = true;
  resumo?: DashboardResumoDto;

  // ===== Card TIME =====
  timeValue = '—';
  timeFooterText = '';
  timeFooterTone: FooterTone = 'muted';

  // ===== Card STREAK =====
  streakValue = '—';
  streakFooterText = '';

  // ===== Card AÇÃO (Retomar OU Próxima) =====
  actionTitle = '—';
  actionSubtitle = '';
  actionFooterText = '';
  actionFooterTone: FooterTone = 'muted';
  actionText = '';
  actionDisabled = true;
  private actionSessaoId: number | null = null;
  private actionIsRetomar = false;

  semana: WeekDayDto[] = [];
  progresso: ProgressoDisciplinaDto[] = [];

  private readonly LS_KEY = 'cognora:lastCicloId';

  constructor(
    private dashboardApi: DashboardApiService,
    private ciclosApi: CiclosApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.usuarioId = user.id;
    this.carregarCiclos();
  }

  onCicloChange(id: number): void {
    if (!id || id <= 0 || this.cicloId === id) return;
    this.cicloId = id;
    this.salvarCicloPreferido(id);
    this.carregarResumo();
  }

  private carregarCiclos(): void {
    this.ciclosLoading = true;

    this.ciclosApi.listCiclos().subscribe({
      next: (list) => {
        this.ciclos = (list ?? []).map((c: any) => ({
          id: Number(c.id),
          nome: String(c.nome ?? `Ciclo ${c.id}`),
        }));

        const preferido = this.lerCicloPreferido();
        this.cicloId = resolverCicloPadrao(this.ciclos, preferido);

        if (this.cicloId) this.salvarCicloPreferido(this.cicloId);

        this.ciclosLoading = false;
        this.cdr.detectChanges();

        this.carregarResumo();
      },
      error: () => {
        this.ciclosLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private carregarResumo(): void {
    if (!this.cicloId) return;

    this.loading = true;

    this.dashboardApi.getResumo(this.usuarioId, this.cicloId).subscribe({
      next: (r) => {
        this.resumo = r;

        // ===== TIME =====
        this.timeValue = this.formatSecondsToHMin(r.estudadoSemanaSeg ?? 0);
        this.aplicarDeltaSemana(r.deltaSemanaSeg ?? 0);

        // ===== STREAK =====
        const streak = r.streakDias ?? 0;
        this.streakValue = `${streak} dia${streak === 1 ? '' : 's'} consecutivo${streak === 1 ? '' : 's'}`;
        this.streakFooterText = `Recorde: ${r.recordeStreakDias ?? 0} dias`;

        // ===== CARD DE AÇÃO =====
        this.aplicarCardAcao(r.recentes ?? [], r.proximaSessao);

        // ===== CHART / PROGRESSO =====
        this.semana = r.semana ?? [];
        this.progresso = r.progresso ?? [];

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private aplicarCardAcao(recentes: SessaoCardDto[], proxima: any): void {
    const ultima = (recentes ?? [])[0];
    const status = String(ultima?.status ?? '').toUpperCase();

    const podeRetomar = status === 'PAUSADA' || status === 'EM_ANDAMENTO';

    if (ultima && podeRetomar) {
      this.actionIsRetomar = true;
      this.actionSessaoId = Number(ultima.id);

      this.actionTitle = ultima.disciplinaNome ?? 'Sessão em andamento';
      this.actionSubtitle = `Estudado: ${this.formatSecondsClock(
        Number((ultima as any).estudadoTotalSeg ?? ultima.segundosEstudados ?? 0)
      )}`;

      this.actionFooterText = this.mapStatus(status);
      this.actionFooterTone = status === 'PAUSADA' ? 'warn' : 'primary';
      this.actionText = 'Retomar';
      this.actionDisabled = false;
      return;
    }

    // PRÓXIMA SESSÃO
    if (proxima) {
      this.actionIsRetomar = false;
      this.actionSessaoId = null;

      this.actionTitle = proxima.disciplinaNome ?? 'Próxima sessão';
      this.actionSubtitle = `${proxima.tempoMinutos ?? 0} minutos`;
      this.actionFooterText = 'Próxima sessão recomendada';
      this.actionFooterTone = 'success';
      this.actionText = 'Iniciar';
      this.actionDisabled = false;
      return;
    }

    // NADA
    this.actionTitle = 'Sem sessões';
    this.actionSubtitle = '';
    this.actionFooterText = '';
    this.actionFooterTone = 'muted';
    this.actionText = '';
    this.actionDisabled = true;
  }

  onActionClick(): void {
    if (this.actionIsRetomar && this.actionSessaoId) {
      this.router.navigate(['/estudo/sessao', this.actionSessaoId]);
      return;
    }

    if (this.cicloId) {
      this.router.navigate(['/estudaAgora'], {
        queryParams: { cicloId: this.cicloId },
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

  private mapStatus(status: string): string {
    switch (status) {
      case 'PAUSADA': return 'Pausada';
      case 'EM_ANDAMENTO': return 'Em andamento';
      case 'CONCLUIDA': return 'Concluída';
      case 'ENCERRADA': return 'Encerrada';
      default: return '—';
    }
  }

  private lerCicloPreferido(): number | null {
    const id = Number(localStorage.getItem(this.LS_KEY));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private salvarCicloPreferido(id: number): void {
    localStorage.setItem(this.LS_KEY, String(id));
  }
}