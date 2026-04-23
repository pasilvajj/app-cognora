import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type CicloOption = { id: number; nome: string };

@Component({
  selector: 'app-ciclo-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ciclo-selector.html',
  styleUrl: './ciclo-selector.css',
})
export class CicloSelector implements OnChanges {
  private static readonly STORAGE_KEY = 'cognora:lastCicloId';

  private readonly host = inject(ElementRef<HTMLElement>);

  /** IDs únicos por instância (acessibilidade). */
  private readonly uid = `${Math.random().toString(36).slice(2, 10)}`;
  readonly labelId = `ciclo-lbl-${this.uid}`;
  readonly comboboxId = `ciclo-cb-${this.uid}`;
  readonly listboxId = `ciclo-lb-${this.uid}`;

  @Input({ required: true }) ciclos: CicloOption[] = [];
  @Input() selectedId: number | null = null;

  @Input() loading = false;
  @Input() disabled = false;
  @Input() label = 'Ciclo';

  @Output() selectedIdChange = new EventEmitter<number>();

  /** Lista do combobox aberta. */
  listOpen = signal(false);
  /** Índice realçado para teclado (0..ciclos.length-1). */
  highlightedIndex = signal(0);

  ngOnChanges(changes: SimpleChanges): void {
    if (this.selectedId == null && this.ciclos?.length) {
      const last = this.getLastCicloId();
      if (last && this.ciclos.some((c) => c.id === last)) {
        this.selectedId = last;
        this.selectedIdChange.emit(last);
        this.setLastCicloId(last);
        this.syncHighlightToSelection();
        return;
      }

      const first = this.ciclos[0]?.id;
      if (first) {
        this.selectedId = first;
        this.setLastCicloId(first);
        this.selectedIdChange.emit(first);
      }
      this.syncHighlightToSelection();
      return;
    }

    if (this.selectedId != null && this.selectedId > 0) {
      this.setLastCicloId(this.selectedId);
    }

    this.syncHighlightToSelection();

    if (changes['ciclos'] && this.listOpen()) {
      const idx = this.indexOfSelected();
      this.highlightedIndex.set(idx >= 0 ? idx : 0);
    }
  }

  get selectedLabel(): string {
    if (this.loading) return 'Carregando…';
    if (!this.ciclos?.length) return 'Nenhum ciclo';
    const c = this.ciclos.find((x) => x.id === this.selectedId);
    return c?.nome ?? 'Selecione um ciclo';
  }

  optionDomId(cicloId: number): string {
    return `ciclo-opt-${this.uid}-${cicloId}`;
  }

  get activeDescendantId(): string | null {
    if (!this.listOpen() || !this.ciclos.length) return null;
    const i = Math.min(Math.max(0, this.highlightedIndex()), this.ciclos.length - 1);
    return this.optionDomId(this.ciclos[i].id);
  }

  toggleList(): void {
    if (this.disabled || this.loading || this.ciclos.length === 0) return;
    if (this.listOpen()) {
      this.closeList();
    } else {
      this.syncHighlightToSelection();
      this.listOpen.set(true);
    }
  }

  closeList(): void {
    this.listOpen.set(false);
  }

  selectCiclo(c: CicloOption): void {
    if (this.disabled || this.loading) return;
    this.onSelectId(c.id);
    this.closeList();
  }

  private onSelectId(id: number): void {
    if (!Number.isFinite(id) || id <= 0) return;
    this.selectedId = id;
    this.setLastCicloId(id);
    this.selectedIdChange.emit(id);
    this.syncHighlightToSelection();
  }

  onTriggerKeydown(ev: KeyboardEvent): void {
    if (this.disabled || this.loading || this.ciclos.length === 0) return;

    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      if (!this.listOpen()) {
        this.syncHighlightToSelection();
        this.listOpen.set(true);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        const c = this.ciclos[this.highlightedIndex()];
        if (c) this.selectCiclo(c);
      } else if (ev.key === 'ArrowDown') {
        this.moveHighlight(1);
      } else if (ev.key === 'ArrowUp') {
        this.moveHighlight(-1);
      }
      return;
    }

    if (ev.key === 'Escape' && this.listOpen()) {
      ev.preventDefault();
      this.closeList();
    }
  }

  onListboxKeydown(ev: KeyboardEvent): void {
    if (!this.listOpen()) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.closeList();
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.moveHighlight(1);
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.moveHighlight(-1);
      return;
    }
    if (ev.key === 'Home') {
      ev.preventDefault();
      this.highlightedIndex.set(0);
      return;
    }
    if (ev.key === 'End') {
      ev.preventDefault();
      this.highlightedIndex.set(Math.max(0, this.ciclos.length - 1));
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const c = this.ciclos[this.highlightedIndex()];
      if (c) this.selectCiclo(c);
    }
  }

  private moveHighlight(delta: number): void {
    const n = this.ciclos.length;
    if (n <= 0) return;
    const next = (this.highlightedIndex() + delta + n) % n;
    this.highlightedIndex.set(next);
  }

  private indexOfSelected(): number {
    if (this.selectedId == null) return -1;
    return this.ciclos.findIndex((c) => c.id === this.selectedId);
  }

  private syncHighlightToSelection(): void {
    const idx = this.indexOfSelected();
    this.highlightedIndex.set(idx >= 0 ? idx : 0);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.listOpen()) return;
    const root = this.host.nativeElement;
    if (root.contains(ev.target as Node)) return;
    this.closeList();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.listOpen()) {
      this.closeList();
    }
  }

  isHighlighted(i: number): boolean {
    return this.listOpen() && this.highlightedIndex() === i;
  }

  isSelected(c: CicloOption): boolean {
    return this.selectedId === c.id;
  }

  private getLastCicloId(): number | null {
    const raw = localStorage.getItem(CicloSelector.STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private setLastCicloId(cicloId: number): void {
    try {
      localStorage.setItem(CicloSelector.STORAGE_KEY, String(cicloId));
    } catch {
      /* storage pode estar bloqueado */
    }
  }
}
