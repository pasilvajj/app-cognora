import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';

export type CicloItemView = {
  cicloItemId: number;
  ordem: number;
  disciplinaNome: string;
  tempoMinutos: number;

  visto?: boolean;
  sessaoAbertaId?: number | null;
  /** Só true depois de iniciar o cronómetro na sessão (comecar), não só ao reservar. */
  cronometroIniciado?: boolean;
  concluida?: boolean;
};

type Segment = {
  d: string;

  item?: CicloItemView;
  /** Pode clicar para iniciar trocar sessão (matérias concluídas são bloqueadas). */
  selectable: boolean;

  selected: boolean;
  recommended: boolean;

  /** Matéria ainda sem sessão ativa (inclui o que antes era “já vista”). */
  naoInicializada: boolean;
  emAndamento: boolean;
  concluida: boolean;

  ordemLabel: string;
  midDeg: number;
};

@Component({
  selector: 'app-escolher-materia-modal-circular',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './escolher-materia-modal-circular.html',
  styleUrl: './escolher-materia-modal-circular.css',
})
export class EscolherMateriaModalCircular implements OnChanges {
  @Input({ required: true }) open = false;
  @Input({ required: true }) items: CicloItemView[] = [];

  /** Sessões finalizadas na rodada; quando maior que {@link materiasConcluidas}, explica-se no cabeçalho. */
  @Input() sessoesConcluidasNaRodada: number | null = null;

  @Input() defaultSelectedItemId?: number;
  @Input() recommendedItemId?: number;

  @Output() close = new EventEmitter<void>();
  @Output() startSession = new EventEmitter<CicloItemView>();

  selectedItem?: CicloItemView;
  hoveredItem?: CicloItemView | null;

  // centro
  centerFocus = '';

  // toggle lista
  showList = false;

  // SVG
  size = 560;
  center = 280;
  outerR = 250;
  innerR = 170;
  gapDeg = 2.2;

  segments: Segment[] = [];

  /**
   * Itens ordenados pelo número do ciclo (`ordem` = #1…#N), não pela ordem do array na API.
   * Usado no anel e na lista para o desenho coincidir com os rótulos #ordem.
   */
  itemsOrdenados: CicloItemView[] = [];

  ngOnChanges(): void {
    this.itemsOrdenados = this.ordenarItemsPorOrdemDoCiclo();
    this.recalc();
  }

  private ordenarItemsPorOrdemDoCiclo(): CicloItemView[] {
    return [...(this.items ?? [])].sort(
      (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0),
    );
  }

  get totalItens(): number {
    return this.items?.length ?? 0;
  }

  /** Itens com estudo concluído no ciclo. */
  get materiasConcluidas(): number {
    return (this.items ?? []).filter((i) => !!i.concluida).length;
  }

  /** Ainda não concluídos (inclui “Não inicializada” e “Em andamento”). */
  get materiasPendentes(): number {
    return (this.items ?? []).filter((i) => !i.concluida).length;
  }

  /** Mostra linha extra quando há mais sessões concluídas do que posições distintas “verdes”. */
  get mostrarContagemSessoes(): boolean {
    const n = this.sessoesConcluidasNaRodada;
    if (n == null || n <= 0) {
      return false;
    }
    return n > this.materiasConcluidas;
  }

  onClose(): void {
    this.close.emit();
  }

  toggleList(): void {
    this.showList = !this.showList;
  }

  hover(it: CicloItemView | null): void {
    this.hoveredItem = it;

    if (it) {
      this.centerFocus = this.formatCenter(it);
      return;
    }

    this.centerFocus = this.selectedItem ? this.formatCenter(this.selectedItem) : '';
  }

  /** Matéria concluída não pode ser escolhida para novo estudo. */
  podeSelecionar(it: CicloItemView): boolean {
    return !it.concluida;
  }

  private primeiroItemSelecionavel(): CicloItemView | undefined {
    const list = this.itemsOrdenados;
    const emAndamento = list.find((i) => !!i.cronometroIniciado && !i.concluida);
    if (emAndamento) return emAndamento;
    return list.find((i) => !i.concluida);
  }

  // Clique já continua/troca
  selectBySegment(seg: Segment): void {
    if (!seg.item || !seg.selectable) return;

    this.selectedItem = seg.item;
    this.centerFocus = this.formatCenter(seg.item);
    this.buildSegments();

    this.startSession.emit(seg.item);
  }

  // Clique na lista também continua/troca
  select(it: CicloItemView): void {
    if (!this.podeSelecionar(it)) return;

    this.selectedItem = it;
    this.centerFocus = this.formatCenter(it);
    this.buildSegments();

    this.startSession.emit(it);
  }

  // fallback do botão central
  confirmar(): void {
    if (!this.selectedItem || !this.podeSelecionar(this.selectedItem)) return;
    this.startSession.emit(this.selectedItem);
  }

  /**
   * Apenas três estados na UI:
   * - Concluído — meta do ciclo cumprida
   * - Em andamento — existe sessão aberta (após iniciar estudo / “inicializar” o item)
   * - Não inicializada — demais casos (o flag “visto” não gera estado próprio)
   */
  statusText(it: CicloItemView): string {
    if (it.concluida) return 'Concluído';
    if (it.cronometroIniciado) return 'Em andamento';
    return 'Não inicializada';
  }

  statusKey(it: CicloItemView): 'RUNNING' | 'DONE' | 'NEW' {
    if (it.concluida) return 'DONE';
    if (it.cronometroIniciado) return 'RUNNING';
    return 'NEW';
  }

  trackById(_: number, it: CicloItemView): number {
    return it.cicloItemId;
  }

  tempoSessaoLabel(it: CicloItemView): string {
    return TempoFormatUtil.minutosParaHorasLabel(it.tempoMinutos);
  }

  private recalc(): void {
    const list = this.items ?? [];

    // seleção padrão (nunca aponta para matéria já concluída)
    if (!this.selectedItem) {
      const tryId = (id: number | undefined): CicloItemView | undefined => {
        if (id == null) return undefined;
        const found = list.find((i) => i.cicloItemId === id);
        if (found && this.podeSelecionar(found)) return found;
        return undefined;
      };

      const fromDefault = tryId(this.defaultSelectedItemId);
      const fromRec = tryId(this.recommendedItemId);
      this.selectedItem =
        fromDefault ?? fromRec ?? this.primeiroItemSelecionavel();
    } else {
      // se items foi recarregado, re-aponta a selectedItem pelo id (evita referência antiga)
      const refreshed = list.find(i => i.cicloItemId === this.selectedItem!.cicloItemId);
      if (refreshed) {
        this.selectedItem = this.podeSelecionar(refreshed)
          ? refreshed
          : this.primeiroItemSelecionavel();
      }
    }

    this.centerFocus = this.selectedItem ? this.formatCenter(this.selectedItem) : '';
    this.buildSegments();
  }

  private buildSegments(): void {
    const list = this.itemsOrdenados;
    const totalSeg = list.length;

    // sem itens: zera o anel
    if (totalSeg === 0) {
      this.segments = [];
      return;
    }

    const slice = 360 / totalSeg;
    const gap = this.gapDeg;

    const segs: Segment[] = [];

    for (let i = 0; i < totalSeg; i++) {
      const start = i * slice + gap / 2;
      const end = (i + 1) * slice - gap / 2;
      const mid = (start + end) / 2;

      const d = this.arcPath(this.center, this.center, this.outerR, this.innerR, start, end);
      const it = list[i];

      const isSelected = !!this.selectedItem && it.cicloItemId === this.selectedItem.cicloItemId;
      const sel = this.podeSelecionar(it);
      const isRec =
        sel &&
        this.recommendedItemId != null &&
        it.cicloItemId === this.recommendedItemId;

      const concluida = !!it.concluida;
      const emAndamento = !!it.cronometroIniciado && !concluida;

      segs.push({
        d,
        item: it,
        selectable: sel,

        selected: isSelected,
        recommended: isRec,

        naoInicializada: !concluida && !emAndamento,
        emAndamento,
        concluida,

        ordemLabel: `#${it.ordem}`,
        midDeg: mid,
      });
    }

    this.segments = segs;
  }

  private formatCenter(it: CicloItemView): string {
    return `#${it.ordem} • ${it.disciplinaNome}`;
  }

  private arcPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number): string {
    const start = this.polarToCartesian(cx, cy, rOuter, endDeg);
    const end = this.polarToCartesian(cx, cy, rOuter, startDeg);
    const startInner = this.polarToCartesian(cx, cy, rInner, startDeg);
    const endInner = this.polarToCartesian(cx, cy, rInner, endDeg);

    const largeArc = endDeg - startDeg <= 180 ? 0 : 1;

    return [
      `M ${start.x} ${start.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${end.x} ${end.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
      'Z',
    ].join(' ');
  }

  private polarToCartesian(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
}
