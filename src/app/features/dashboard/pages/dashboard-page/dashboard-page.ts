import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../core/auth/auth.service';
import { CicloOption, CicloSelector, } from '../../../../shared/components/ciclo-selector/ciclo-selector';
import { MetricCard } from '../../../../shared/components/metric-card/metric-card';
import { ProgressBar } from '../../../../shared/components/progress-bar/progress-bar';
import { WeekChart } from '../../../../shared/components/week-chart/week-chart';
import { resolverCicloPadrao } from '../../../../shared/service/resolverCicloPadrao';
import { CiclosApiService } from '../../../ciclos/data/ciclos-api.service';

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

  // ===== Card AÇÃO (Retomar OU Próxima) =====
  actionTitle = '—';
  actionSubtitle = '';
  actionFooterText = '';
  actionFooterTone: FooterTone = 'muted';
  actionText = '';
  actionDisabled = signal(true);
  private actionSessaoId: number | null = null;
  private actionIsRetomar = signal(false);

  semana: WeekDayDto[] = [];
  progresso: ProgressoDisciplinaDto[] = [];

  private readonly LS_KEY = 'cognora:lastCicloId';

  dashboardApi = inject(DashboardApiService);
  ciclosApi = inject(CiclosApiService);
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
    this.carregarCiclos();
  }

  onCicloChange(id: number): void {
    if (!id || id <= 0 || this.cicloId === id) return;
    this.cicloId = id;
    this.salvarCicloPreferido(id);
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
      this.actionIsRetomar.set(true);
      this.actionSessaoId = Number(ultima.id);

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

      this.actionTitle = proxima.disciplinaNome ?? 'Próxima sessão';
      this.actionSubtitle = `${proxima.tempoMinutos ?? 0} minutos`;
      this.actionFooterText = 'Próxima sessão recomendada';
      this.actionFooterTone = 'success';
      this.actionText = 'Iniciar';
      this.actionDisabled.set(false);
      return;
    }

    // NADA
    this.actionTitle = 'Sem sessões';
    this.actionSubtitle = '';
    this.actionFooterText = '';
    this.actionFooterTone = 'muted';
    this.actionText = '';
    this.actionDisabled.set(true);
  }

  onActionClick(): void {
    if (this.actionIsRetomar() && this.actionSessaoId) {
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