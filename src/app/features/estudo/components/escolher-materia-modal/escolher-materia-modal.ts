import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CicloItemView = {
  cicloItemId: number;
  ordem: number;
  disciplinaNome: string;
  tempoMinutos: number;
};

@Component({
  selector: 'app-escolher-materia-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './escolher-materia-modal.html',
  styleUrl: './escolher-materia-modal.css',
})
export class EscolherMateriaModal {
  @Input() open = false;
  @Input() recomendadoId?: number;
  @Input() itens: CicloItemView[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() select = new EventEmitter<CicloItemView>();

  onBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('backdrop')) this.close.emit();
  }

  escolher(i: CicloItemView) {
    this.select.emit(i);
  }
}
