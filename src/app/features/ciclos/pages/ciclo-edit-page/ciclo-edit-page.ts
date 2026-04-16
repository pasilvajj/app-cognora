import { Component, OnInit ,ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CiclosApiService } from '../../data/ciclos-api.service';
import { Subject } from 'rxjs';
import { calcularHorasPorMateria } from '../../utils/carga-horaria.utils';
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
    this.router.navigate(['/estudaAgora', this.ciclo.id]);
  }

  aplicarHorasPorMateria(): void {
      const result = calcularHorasPorMateria({
        cargaHorariaSemanal: this.ciclo?.cargaHorariaSemanal! ,
        materias: (this.disciplinas ?? []).map((m: any) => ({
          id: m.id,
          checked: !!m.checked,
          peso: m.peso ?? null,
        })),
        minHorasPorMateria: 2,
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
  
      // this.minimoHorasViolado = result.warningMinimoNaoAtendido;
    }


    atualizar(): void {
    const nome = (this.nomeCiclo ?? '').trim();
  
    const payload: any = {
      ownerId: this.ownerId,
      nome,
      cargaHorariaSemanal: this.cargaHorariaSemanal,
      ativo: this.ativo,
      concursoId: this.concursoId,
      cargoId: this.cargoId,
      tempoBlocoMin: 120, // se você usa isso no backend, ajuste aqui conforme sua UI
      itens: (this.disciplinas ?? []).map((d: any) => ({
        idDisciplina: d.id,          // 👈 nome correto
        checked: !!d.checked,
        completouEdital: !!d.completouEdital,
        nivel: d.nivel ?? 0
      })),

       pomodoroAtivo: this.usarPomodoro,
     
    };

    console.log('Salvar ciclo', payload);

    this.api.saveCiclo(payload).subscribe({
      next: (ciclo) => {
        console.log('Ciclo criado:', ciclo);
        this.router.navigate(['/ciclos']);
      },
      error: (err) => {
        console.error('Erro ao salvar ciclo', err);
      },
    });
  }

      private mapEditDtoToCicloItems(
        disciplinas: DisciplinaEditDto[]
      ): DisciplinaCicloItem[] {
        return disciplinas.map(d => ({
          id: d.id,
          nome: d.nome,
          tempoMinutos: 0,
          checked: d.checked,
          completouEdital: d.completouEdital,
          peso: d.peso,
          nivel: d.nivel,
          horasLabel: '0:00h',
        }));
      }

}
