import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type MateriaCicloItem = {
  id: number;
  nome: string;
  tempoMin: number;
};

export type DisciplinaCicloItem = {
  id: number;
  nome: string;
  tempoMinutos: number;
  // campos do layout (podem começar default)
  checked: boolean;
  completouEdital: boolean;
  peso: number | null;
  nivel: number;         // 0..5
  horasLabel: string;    // ex: "0:00h"
};
export interface DisciplinaEditDto {
  id: number;
  nome: string;
  checked: boolean;
  completouEdital: boolean;
  peso: number | null;
  nivel: number;
}

export interface CicloEditResponseDto {
  cicloId: number;
  nome: string;
  cargaHorariaSemanal: number;
  ativo: boolean;
  cargoId: number;
  cargoNome: string;
  pomodoroAtivo?: boolean;
  disciplinas: DisciplinaEditDto[];
}

@Component({
  selector: 'app-materias-ciclo-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './materias-ciclo-list.html',
  styleUrl: './materias-ciclo-list.css',
})
export class MateriasCicloList implements OnChanges{
  @Input({ required: true }) items: DisciplinaCicloItem[] = [];
  @Input() readonly = false; 
  @Output() itemsChange = new EventEmitter<DisciplinaCicloItem[]>();

    stars = [1, 2, 3, 4, 5];

    ngOnChanges(): void {
    // normaliza defaults para não quebrar o template
    this.items = (this.items ?? []).map((it) => ({
      ...it,
      checked: it.checked ?? true,
      completouEdital: it.completouEdital ?? false,
      peso: it.peso ?? null,
      nivel: it.nivel ?? 0,
      horasLabel: it.horasLabel ?? '0:00h',
    }));

    this.emit();
  }

  trackById(_: number, it: DisciplinaCicloItem): number {
    return it.id;
  }

  onToggleChecked(it: DisciplinaCicloItem): void {
    it.checked = !it.checked;

    if (!it.checked) {
      // opcional: zera campos quando desmarca
      it.completouEdital = false;
    }

    this.emit();
  }

  setNivel(it: DisciplinaCicloItem, nivel: number): void {
    if (!it.checked) return;
    it.nivel = nivel;
    this.emit();
  }

  private emit(): void {
    this.itemsChange.emit(this.items);
  }
}
