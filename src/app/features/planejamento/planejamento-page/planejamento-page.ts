import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs/operators';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { AuthService } from '../../../core/auth/auth.service';
import { CicloOption, CicloSelector, } from '../../../shared/components/ciclo-selector/ciclo-selector';
import { CiclosApiService } from '../../ciclos/data/ciclos-api.service';
import { PlanejamentoApiService } from '../data/planejamento-api.service';
import { PlanejamentoPersonalizadoReq, PlanejamentoSemanalDto } from '../data/planejamento.models';
import { corDisciplina } from '../../../shared/utils/cor-disciplina.util';

type DiaView = {
  diaSemanaLabel: string; // "Seg"
  diaMes: number; // 22
  dataIso: string; // "2026-04-22"
  isHoje: boolean; // destaque no topo
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
  imports: [CommonModule, FormsModule, CicloSelector, DragDropModule],
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
  salvando = signal(false);

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
    // "Gerar planejamento" volta ao plano automático (descarta a organização manual da semana).
    this.resetarPlanejamento();
  }

  // ===== Drag & Drop (organização do usuário) =====

  /** Ids das listas (uma por dia) para conectar o arrastar entre dias. */
  get dropListIds(): string[] {
    return this.dias.map((_, i) => `dia-${i}`);
  }

  onDrop(event: CdkDragDrop<DiaView['itens']>): void {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) {
        return;
      }
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    this.recomputarTotais();
    this.persistirOrganizacao();
  }

  private recomputarTotais(): void {
    let totalSemana = 0;
    for (const d of this.dias) {
      d.totalDiaSeg = d.itens.reduce((acc, it) => acc + (it.duracaoSeg || 0), 0);
      totalSemana += d.totalDiaSeg;
    }
    this.totalSemanaLabel = this.formatarTempo(totalSemana);
  }

  private persistirOrganizacao(): void {
    if (!this.cicloIdSelecionado) return;

    const payload: PlanejamentoPersonalizadoReq = {
      weekStart: this.weekStartIso,
      dias: this.dias.map((d) => ({
        data: d.dataIso,
        itens: d.itens.map((it) => ({
          disciplinaId: it.disciplinaId,
          duracaoSeg: it.duracaoSeg,
        })),
      })),
    };

    this.salvando.set(true);
    this.api
      .salvarPlanejamentoSemanal(this.cicloIdSelecionado, payload)
      .pipe(
        finalize(() => {
          this.salvando.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (dto) => {
          this.aplicarDto(dto);
          this.cdr.detectChanges();
        },
        error: (e) => {
          console.error('Erro ao salvar organização do planejamento', e);
          this.toast.error('Não foi possível salvar a organização.');
        },
      });
  }

  resetarPlanejamento(): void {
    if (!this.cicloIdSelecionado || this.carregando || this.gerando) return;
    if (!this.weekStartIso) this.weekStartIso = this.getMondayIso(new Date());

    this.gerando = true;
    this.api
      .resetarPlanejamentoSemanal(this.cicloIdSelecionado, this.weekStartIso)
      .pipe(
        finalize(() => {
          this.gerando = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (dto) => {
          this.aplicarDto(dto);
          this.cdr.detectChanges();
        },
        error: (e) => {
          console.error('Erro ao redefinir planejamento', e);
          this.toast.error('Não foi possível redefinir o planejamento.');
        },
      });
  }

  // ===== Edição via modal =====

  modalAberto = false;
  itemEdicao: DiaView['itens'][number] | null = null;
  edicaoHoras = 0;
  edicaoMinutos = 0;

  /** Abre o modal de edição do item clicado. */
  abrirEdicao(_dia: DiaView, item: DiaView['itens'][number]): void {
    this.itemEdicao = item;
    const seg = Math.max(0, item.duracaoSeg || 0);
    this.edicaoHoras = Math.floor(seg / 3600);
    this.edicaoMinutos = Math.floor((seg % 3600) / 60);
    this.modalAberto = true;
    this.cdr.detectChanges();
  }

  fecharEdicao(): void {
    this.modalAberto = false;
    this.itemEdicao = null;
    this.cdr.detectChanges();
  }

  /** Soma/subtrai minutos no tempo em edição (botões − / +). */
  ajustarMinutos(delta: number): void {
    let total = (Number(this.edicaoHoras) || 0) * 60 + (Number(this.edicaoMinutos) || 0) + delta;
    if (total < 0) total = 0;
    this.edicaoHoras = Math.floor(total / 60);
    this.edicaoMinutos = total % 60;
  }

  /** Prévia do tempo em edição (ex.: "1h 30min"). */
  get previewTempoEdicao(): string {
    const seg = (Number(this.edicaoHoras) || 0) * 3600 + (Number(this.edicaoMinutos) || 0) * 60;
    return this.formatarTempo(seg);
  }

  salvarEdicao(): void {
    if (!this.itemEdicao) return;
    const h = Math.max(0, Math.floor(Number(this.edicaoHoras) || 0));
    const m = Math.max(0, Math.min(59, Math.floor(Number(this.edicaoMinutos) || 0)));
    this.itemEdicao.duracaoSeg = h * 3600 + m * 60;
    this.recomputarTotais();
    this.persistirOrganizacao();
    this.fecharEdicao();
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
    const hojeIso = this.toIsoDate(new Date());
    this.dias = (dto.dias ?? []).map((d) => {
      const dt = this.parseIsoDate(d.data);
      return {
        diaSemanaLabel: d.diaLabel,
        diaMes: dt.getDate(),
        dataIso: d.data,
        isHoje: d.data === hojeIso,
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

  /** Cor fixa por disciplina (mesma das telas de edital/ciclo). */
  corDisciplina(nome: string | null | undefined): string {
    return corDisciplina(nome);
  }

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