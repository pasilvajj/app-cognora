import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CicloItem {
  disciplina: string;
  tempoAtual: number;
  tempoTotal: number;
  cor: 'blue' | 'green' | 'purple';
}

export interface Ciclo {
  nome: string;
  itens: CicloItem[];
  tempoRestante: number;
}

@Component({
  selector: 'app-estudo-progresso',
    standalone: true,
  imports: [CommonModule],
  templateUrl: './estudo-progresso.html',
  styleUrl: './estudo-progresso.css',
})
export class EstudoProgresso {
    @Input() ciclo!: Ciclo;
}
