import { Component, OnInit ,ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CiclosApiService } from '../../data/ciclos-api.service';
import { Subject } from 'rxjs';
import { calcularHorasPorMateria } from '../../utils/carga-horaria.utils';
import { ESTUDO_LIVRE_HORAS, BLOCO_SESSAO_MINUTOS, isDisciplinaEstudoLivre } from '../../constants/estudo-livre.constants';
import { AuthService } from '../../../../core/auth/auth.service';
import {  MateriasCicloList, DisciplinaCicloItem,CicloEditResponseDto,DisciplinaEditDto} from '../materias-ciclo-list/materias-ciclo-list';

@Component({
  selector: 'app-ciclo-edit-page',
   imports: [CommonModule, RouterModule, MateriasCicloList,FormsModule],
  templateUrl: './ciclo-edit-page.html',
  styleUrl: './ciclo-edit-page.css',
})
export class CicloEditPage implements OnInit{
   loading = false;
   ciclo?: CicloEditResponseDto;
   disciplinas: DisciplinaCicloItem[] = [];

   private ownerId!: number;
   
     nomeCiclo = '';
     cargaHorariaSemanal = 30;
     ativo = true;
     concursoId: number | null = null;
     cargoId: number | null = null;
     editalId: number | null = null;
   
     loadingConcursos = false;
     loadingDisciplinas = false;
     loadingCargo = false;
     minimoHorasViolado = false;
   
     // =========================
     // Pomodoro (Opção A)
     // =========================
     usarPomodoro = false;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: CiclosApiService,
    private cdr: ChangeDetectorRef
  ) {}

 
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.carregarCiclo(id);
    }
  }

  /* =====================================================
     CARREGAR CICLO (VISUALIZAÇÃO)
     ===================================================== */
  private carregarCiclo(cicloId: number): void {
    this.loading = true;

    this.api.detalharCicloParaEdicao(cicloId).subscribe({
      next: (data) => {
        this.ciclo = data; // agora data é UM objeto

        this.disciplinas = this.mapEditDtoToCicloItems(data.disciplinas );

        this.nomeCiclo = this.ciclo.nome

        this.aplicarHorasPorMateria();
      },
      error: err => console.error(err),
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  iniciarCiclo(): void {
    if (!this.ciclo) return;
    this.router.navigate(['/estudaAgora', this.ciclo.cicloId]);
  }

  aplicarHorasPorMateria(): void {
    const cargaHorariaSemanal = this.ciclo?.cargaHorariaSemanal ?? this.cargaHorariaSemanal;
    const cargaParaMaterias = Math.max(0, (Number(cargaHorariaSemanal) || 0) - ESTUDO_LIVRE_HORAS);

    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: cargaParaMaterias,
      materias: (this.disciplinas ?? []).map((m: any) => ({
        id: m.id,
        checked: !!m.checked,
        peso: m.peso ?? null,
      })),
    });

    const byId = new Map(result.perMateria.map((x) => [x.id, x]));

    this.disciplinas = (this.disciplinas ?? []).map((m: any) => {
      const calc = byId.get(m.id);
      return {
        ...m,
        horasLabel: calc?.horasLabel ?? '0:00h',
        horas: calc?.horas ?? 0,
      };
    });

    const nAtivas = this.disciplinas.filter(m => m.checked).length;
    const cargaTotal = Number(cargaHorariaSemanal) || 0;
    this.minimoHorasViolado =
      cargaTotal <= ESTUDO_LIVRE_HORAS ||
      result.warningMinimoNaoAtendido ||
      nAtivas === 0;
  }


  atualizar(): void {
    if (!this.ciclo) return;

    const nome = (this.nomeCiclo ?? '').trim();
    if (!nome) return;

    const payload = {
      nome,
      cargaHorariaSemanal: this.cargaHorariaSemanal,
      ativo: this.ativo,
      pomodoroAtivo: this.usarPomodoro,
      itens: (this.disciplinas ?? []).map(d => ({
        idDisciplina: d.id,
        checked: !!d.checked,
        completouEdital: !!d.completouEdital,
        nivel: d.nivel ?? 0,
        peso: d.peso ?? null,
      })),
    };

    this.api.atualizarCiclo(this.ciclo.cicloId, payload).subscribe({
      next: () => this.router.navigate(['/ciclos']),
      error: err => console.error('Erro ao salvar ciclo', err),
    });
  }

      private mapEditDtoToCicloItems(
        disciplinas: DisciplinaEditDto[]
      ): DisciplinaCicloItem[] {
        return disciplinas
          .filter(d => !isDisciplinaEstudoLivre(d.nome))
          .map(d => ({
          id: d.id,
          nome: d.nome,
          tempoMinutos: BLOCO_SESSAO_MINUTOS,
          checked: d.checked,
          completouEdital: d.completouEdital,
          peso: d.peso,
          nivel: d.nivel,
          horasLabel: '0:00h',
        }));
      }

}
