import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { EstudoControles} from '../estudo-controles/estudo-controles';
import { EstudoProgresso } from '../estudo-progresso/estudo-progresso';

@Component({
  selector: 'app-estudo-timer',
  standalone: true,
  imports: [
    CommonModule,
   EstudoProgresso],
  templateUrl: './estudo-timer.html',
  styleUrl: './estudo-timer.css',
})
export class EstudoTimer {

  @Input() tempoFormatado!: string;
  @Input() disciplinaAtual!: string;
  @Input() ciclo!: {
    nome: string;
    itens: {
      disciplina: string;
      tempoAtual: number;
      tempoTotal: number;
      cor: 'blue' | 'green' | 'purple';
    }[];
    tempoRestante: number;
  };

  @Input() rodando!: boolean;
@Output() pausar = new EventEmitter<void>();
@Output() continuar = new EventEmitter<void>();
@Output() finalizar = new EventEmitter<void>(); 


}

