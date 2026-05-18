import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../core/auth/auth.service';
import { CicloOption, CicloSelector, } from '../../../shared/components/ciclo-selector/ciclo-selector';
import { CiclosApiService } from '../../ciclos/data/ciclos-api.service';
import { PlanejamentoApiService } from '../data/planejamento-api.service';
import { PlanejamentoSemanalDto } from '../data/planejamento.models';

type DiaView = {
  diaSemanaLabel: string; // "Seg"
  diaMes: number; // 22
  dataIso: string; // "2026-04-22"
  totalDiaSeg: number;
  observacao?: string;
  itens: Array<{
    disciplinaId: number;
    disciplinaNome: string;
    duracaoSeg: number;
    corTag?: string; // ex: "c-azul"
    topico?: string; // opcional (front only)
  }>;
};

@Component({
  selector: 'app-planejamento-page',
  standalone: true,
  imports: [CommonModule, CicloSelector],
  templateUrl: './planejamento-page.html',
  styleUrl: './planejamento-page.css',
})
export class PlanejamentoPage implements OnInit {

  toast = inject(ToastrService);

  // ciclo selector
  ciclos: CicloOption[] = [];
  cicloIdSelecionado: number | null = null;

  ciclosLoading = signal(false);

  planejamento?: PlanejamentoSemanalDto;

  // UI
  carregando = false;
  gerando = false;

  intervaloSemanaLabel = '—';
  totalSemanaLabel = '—';

  // dados para o template
  dias: DiaView[] = [];
  distribuicao: PlanejamentoSemanalDto['distribuicao'] = [];

  resumoDiaMaisLeve = '—';
  resumoDiaMaisPesado = '—';

  // controle de semana
  private weekStartIso = '';

  constructor(
    private api: PlanejamentoApiService,
    private ciclosApi: CiclosApiService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private auth: AuthService
  ) { }

  ngOnInit(): void {

    const user = this.auth.getUser();

    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.weekStartIso = this.getMondayIso(new Date());
    this.carregarCiclos();
  }

  // ===== Template helpers =====

  /** Botão “Atualizar” (recarrega semana atual do ciclo selecionado) */
  carregar(): void {
    if (this.carregando || this.gerando) return;
    if (!this.cicloIdSelecionado) return;
    if (!this.weekStartIso) this.weekStartIso = this.getMondayIso(new Date());

    this.carregarPlanejamento(false);
  }

  // Chamado pelo (selectedIdChange) do CicloSelector
  onCicloChange(id: number): void {
    if (!id || id <= 0) return;
    if (this.cicloIdSelecionado === id) return;

    this.cicloIdSelecionado = id;

    // ao trocar ciclo, volta para a semana atual (UX mais previsível)
    this.weekStartIso = this.getMondayIso(new Date());

    this.carregarPlanejamento(false);
  }

  // ===== Ciclos =====

  // No seu componente, certifique-se de usar Signals para estados de UI


  private async carregarCiclos(): Promise<void> {
    this.ciclosLoading.set(true);

    try {
      // 1. Uso de Promise para fluxo linear
      const list = await this.ciclosApi.listCiclos();

      this.ciclos = (list ?? []).map(c => ({
        id: Number(c.id),
        nome: String(c.nome ?? `Ciclo ${c.id}`),
      }));

      // 2. Lógica de inicialização de estado
      if (!this.cicloIdSelecionado && this.ciclos.length > 0) {
        this.cicloIdSelecionado = this.ciclos[0].id;

        if (!this.weekStartIso) {
          this.weekStartIso = this.getMondayIso(new Date());
        }
        // 3. Carregamento encadeado (aguarda o planejamento se necessário)
        await this.carregarPlanejamento(false);
      }

    } catch (err) {
      console.error('Erro ao carregar ciclos:', err);
      this.toast.error('Falha ao obter lista de ciclos.');
    } finally {
      // 4. Garantia de fechamento de loading e detecção de mudanças
      this.ciclosLoading.set(false);
      this.cdr.detectChanges();
    }
  }


  // ===== Ações do template (semana) =====

  semanaAnterior(): void {
    if (this.carregando || this.gerando) return;
    if (!this.cicloIdSelecionado) return;

    this.weekStartIso = this.addDaysIso(this.weekStartIso, -7);
    this.carregarPlanejamento(false);
  }

  proximaSemana(): void {
    if (this.carregando || this.gerando) return;
    if (!this.cicloIdSelecionado) return;

    this.weekStartIso = this.addDaysIso(this.weekStartIso, 7);
    this.carregarPlanejamento(false);
  }

  gerarPlanejamento(): void {
    if (!this.cicloIdSelecionado) return;
    this.carregarPlanejamento(true);
  }

  // ===== Integração com backend =====

  private carregarPlanejamento(forcarGeracao: boolean): void {
    if (!this.cicloIdSelecionado) return;

    if (!this.weekStartIso) {
      this.weekStartIso = this.getMondayIso(new Date());
    }

    this.carregando = !forcarGeracao;
    this.gerando = forcarGeracao;

    const req$ = forcarGeracao
      ? this.api.gerarPlanejamentoSemanal(
        this.cicloIdSelecionado,
        this.weekStartIso
      )
      : this.api.getPlanejamentoSemanal(
        this.cicloIdSelecionado,
        this.weekStartIso
      );

    req$.subscribe({
      next: (dto) => {
        this.aplicarDto(dto);
        this.carregando = false;
        this.gerando = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Erro ao carregar planejamento', e);
        this.carregando = false;
        this.gerando = false;
        this.cdr.detectChanges();
      },
    });
  }

  private aplicarDto(dto: PlanejamentoSemanalDto): void {
    this.planejamento = dto;

    // semana
    this.weekStartIso = dto.weekStart || this.weekStartIso;
    this.intervaloSemanaLabel = this.formatarIntervaloSemana(
      dto.weekStart,
      dto.weekEnd
    );
    this.totalSemanaLabel = this.formatarTempo(dto.totalSugeridoSeg);

    // dias
    this.dias = (dto.dias ?? []).map((d) => {
      const dt = this.parseIsoDate(d.data);
      return {
        diaSemanaLabel: d.diaLabel,
        diaMes: dt.getDate(),
        dataIso: d.data,
        totalDiaSeg: d.totalDiaSeg ?? 0,
        observacao: undefined,
        itens: (d.itens ?? []).map((it) => ({
          disciplinaId: it.disciplinaId,
          disciplinaNome: it.disciplinaNome,
          duracaoSeg: it.duracaoSeg ?? 0,
          corTag: it.corTag ?? 'c-cinza',
          topico: undefined,
        })),
      };
    });

    // distribuição
    this.distribuicao = dto.distribuicao ?? [];

    // resumo
    this.resumoDiaMaisLeve = dto.resumo?.diaMaisLeve ?? '—';
    this.resumoDiaMaisPesado = dto.resumo?.diaMaisPesado ?? '—';
  }

  // ===== Helpers usados no HTML =====

  formatarTempo(totalSeg: number | null | undefined): string {
    const sec = Math.max(0, Math.floor(Number(totalSeg ?? 0)));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);

    if (h <= 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  // ===== Datas (ISO) =====

  private getMondayIso(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const day = d.getDay(); // 0=Dom..6=Sáb
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
    if (!y || !m || !d) return new Date();
    // meio-dia local para reduzir risco de “virar” o dia por fuso
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private formatarIntervaloSemana(weekStart: string, weekEnd: string): string {
    if (!weekStart || !weekEnd) return '—';
    const a = this.parseIsoDate(weekStart);
    const b = this.parseIsoDate(weekEnd);

    const fmt = (x: Date) =>
      x
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        .replace('.', '');

    return `${fmt(a)} – ${fmt(b)} ${b.getFullYear()}`;
  }
}