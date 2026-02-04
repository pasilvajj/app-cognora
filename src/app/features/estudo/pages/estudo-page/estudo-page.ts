import { Component, inject, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { EstudoTimer } from '../../components/estudo-timer/estudo-timer';
import { EstudoService } from '../../services/estudo-service';

 type CorBarra = 'blue' | 'green' | 'purple';

type CicloVm = {
  nome: string;
  itens: {
    disciplina: string;
    tempoAtual: number;
    tempoTotal: number;
    cor: CorBarra;
  }[];
  tempoRestante: number;
};

@Component({
  selector: 'app-estudo-page',
  standalone: true,
  imports: [
    CommonModule,
],
  templateUrl: './estudo-page.html',
  styleUrl: './estudo-page.css',
})

export class EstudoPage implements OnInit  {

   private session = inject(EstudoService);

  tempo$ = this.session.segundos$.pipe(
    map(s => this.session.formatarTempo(s))
  );

  rodando$ = this.session.rodando$;

  disciplinaAtual = 'Direito Constitucional';

 ciclo: CicloVm = {
    nome: 'PF 2025 - Agente',
    itens: [
      { disciplina: 'Português', tempoAtual: 15, tempoTotal: 30, cor: 'blue' },
      { disciplina: 'Direito Constitucional', tempoAtual: 18, tempoTotal: 40, cor: 'green' },
      { disciplina: 'Informática', tempoAtual: 0, tempoTotal: 30, cor: 'purple' }
    ],
    tempoRestante: 45
  };

  ngOnInit() {
    // this.session.iniciarOuContinuar();
  }

  alternar() {
    this.session.iniciarOuContinuar();
  }

  pausar() {
    this.session.pausar();
  }

  finalizar() {
    this.session.finalizar();
  }

}