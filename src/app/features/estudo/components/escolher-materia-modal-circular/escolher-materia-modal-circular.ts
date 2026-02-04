import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CicloItemView = {
  cicloItemId: number;
  ordem: number;
  disciplinaNome: string;
  tempoMinutos: number;

  visto?: boolean;
  sessaoAbertaId?: number | null;
  concluida?: boolean;
};

type Segment = {
  d: string;

  item?: CicloItemView;
  active: boolean;

  selected: boolean;
  recommended: boolean;

  visto: boolean;
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

  ngOnChanges(): void {
    this.recalc();
  }

  get totalItens(): number {
    return this.items?.length ?? 0;
  }

  get vistas(): number {
    return (this.items ?? []).filter(i => !!i.visto).length;
  }

  get restantes(): number {
    return Math.max(0, this.totalItens - this.vistas);
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

  // Clique já continua/troca
  selectBySegment(seg: Segment): void {
    if (!seg.item) return;

    this.selectedItem = seg.item;
    this.centerFocus = this.formatCenter(seg.item);
    this.buildSegments();

    this.startSession.emit(seg.item);
  }

  // Clique na lista também continua/troca
  select(it: CicloItemView): void {
    this.selectedItem = it;
    this.centerFocus = this.formatCenter(it);
    this.buildSegments();

    this.startSession.emit(it);
  }

  // fallback do botão central
  confirmar(): void {
    if (!this.selectedItem) return;
    this.startSession.emit(this.selectedItem);
  }

  statusText(it: CicloItemView): string {
    if (it.sessaoAbertaId) return 'Em andamento';
    if (it.concluida) return 'Concluída';
    if (it.visto) return 'Já vista';
    return 'Não vista';
  }

  statusKey(it: CicloItemView): 'RUNNING' | 'DONE' | 'SEEN' | 'NEW' {
    if (it.sessaoAbertaId) return 'RUNNING';
    if (it.concluida) return 'DONE';
    if (it.visto) return 'SEEN';
    return 'NEW';
  }

  trackById(_: number, it: CicloItemView): number {
    return it.cicloItemId;
  }

  private recalc(): void {
    const list = this.items ?? [];

    // seleção padrão
    if (!this.selectedItem) {
      if (this.defaultSelectedItemId != null) {
        const found = list.find(i => i.cicloItemId === this.defaultSelectedItemId);
        if (found) this.selectedItem = found;
      } else if (this.recommendedItemId != null) {
        const found = list.find(i => i.cicloItemId === this.recommendedItemId);
        if (found) this.selectedItem = found;
      }
    } else {
      // se items foi recarregado, re-aponta a selectedItem pelo id (evita referência antiga)
      const refreshed = list.find(i => i.cicloItemId === this.selectedItem!.cicloItemId);
      if (refreshed) this.selectedItem = refreshed;
    }

    this.centerFocus = this.selectedItem ? this.formatCenter(this.selectedItem) : '';
    this.buildSegments();
  }

  private buildSegments(): void {
    const list = this.items ?? [];
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
      const isRec = this.recommendedItemId != null && it.cicloItemId === this.recommendedItemId;

      segs.push({
        d,
        item: it,
        active: true,

        selected: isSelected,
        recommended: isRec,

        visto: !!it.visto,
        emAndamento: !!it.sessaoAbertaId,
        concluida: !!it.concluida,

        ordemLabel: `#${it.ordem}`,
        midDeg: mid,
      });
    }

    this.segments = segs;
  }

  private formatCenter(it: CicloItemView): string {
    const status = this.statusText(it);
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
