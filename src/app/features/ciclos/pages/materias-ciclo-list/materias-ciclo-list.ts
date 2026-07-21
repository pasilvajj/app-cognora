import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ESTUDO_LIVRE_HORAS, ESTUDO_LIVRE_NOME } from '../../constants/estudo-livre.constants';

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
  tempoPlanejadoMinutos: number;
}

export interface CicloEditResponseDto {
  cicloId: number;
  nome: string;
  cargaHorariaSemanal: number;
  ativo: boolean;
  cargoId: number;
  cargoNome: string;
  pomodoroAtivo?: boolean;
  pomodoroFocoMin?: number;
  pomodoroPausaCurtaMin?: number;
  pomodoroPausaLongaMin?: number;
  pomodoroLongaACada?: number;
  disciplinas: DisciplinaEditDto[];
}

@Component({
  selector: 'app-materias-ciclo-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './materias-ciclo-list.html',
  styleUrl: './materias-ciclo-list.css',
})
export class MateriasCicloList {
  @Input({ required: true }) items: DisciplinaCicloItem[] = [];
  @Input() readonly = false; 
  @Output() itemsChange = new EventEmitter<DisciplinaCicloItem[]>();

  readonly estudoLivreNome = ESTUDO_LIVRE_NOME;
  readonly estudoLivreHorasLabel = `${String(ESTUDO_LIVRE_HORAS).padStart(2, '0')}:00h`;

  stars = [1, 2, 3, 4, 5];

  trackById(_: number, it: DisciplinaCicloItem): number {
    return it.id;
  }

  onCheckedChange(checked: boolean, it: DisciplinaCicloItem): void {
    if (!checked) {
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
