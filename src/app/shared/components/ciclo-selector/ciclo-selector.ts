import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type CicloOption = { id: number; nome: string };

@Component({
  selector: 'app-ciclo-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ciclo-selector.html',
  styleUrl: './ciclo-selector.css',
})
export class CicloSelector {
  private static readonly STORAGE_KEY = 'cognora:lastCicloId';

  @Input({ required: true }) ciclos: CicloOption[] = [];
  @Input() selectedId: number | null = null;

  @Input() loading = false;
  @Input() disabled = false;
  @Input() label = 'Ciclo';

  @Output() selectedIdChange = new EventEmitter<number>();

  ngOnChanges(): void {
    // Se não veio selecionado pela tela, tenta aplicar o último ciclo persistido.
    if (this.selectedId == null && this.ciclos?.length) {
      const last = this.getLastCicloId();
      if (last && this.ciclos.some((c) => c.id === last)) {
        this.selectedId = last;
        this.selectedIdChange.emit(last);
        return;
      }

      // Fallback: primeiro ciclo disponível (e persiste)
      const first = this.ciclos[0]?.id;
      if (first) {
        this.selectedId = first;
        this.setLastCicloId(first);
        this.selectedIdChange.emit(first);
      }
    }

    // Se veio selecionado, persiste
    if (this.selectedId != null && this.selectedId > 0) {
      this.setLastCicloId(this.selectedId);
    }
  }

  onChange(value: any): void {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) return;

    this.selectedId = id;
    this.setLastCicloId(id);
    this.selectedIdChange.emit(id);
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
      // sem ação: storage pode estar bloqueado
    }
  }
}