import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { CiclosApiService } from '../../data/ciclos-api.service';
import { calcularHorasPorMateria } from '../../utils/carga-horaria.utils';
import { CicloHeaderComponent } from '../../../../shared/components/ciclo-header/ciclo-header.component';

import {
  MateriasCicloList,
  DisciplinaCicloItem,
  DisciplinaEditDto,
  CicloEditResponseDto
} from '../materias-ciclo-list/materias-ciclo-list';

@Component({
  selector: 'app-ciclo-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, MateriasCicloList, CicloHeaderComponent],
  templateUrl: './ciclo-detail-page.html',
  styleUrl: './ciclo-detail-page.css',
})
export class CicloDetailPage implements OnInit {
  loading = false;
  ciclo?: CicloEditResponseDto;
  disciplinas: DisciplinaCicloItem[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: CiclosApiService,
    private cdr: ChangeDetectorRef
  ) {}

  modo: 'view' | 'edit' = 'view';

  ngOnInit(): void {
    const url = this.route.snapshot.url.map(u => u.path).join('/');
    this.modo = url.includes('editar') ? 'edit' : 'view';

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.carregarCiclo(id);
    }
  }

  // ngOnInit(): void {
  //   const id = Number(this.route.snapshot.paramMap.get('id'));
  //   if (id) {
  //     this.carregarCiclo(id);
  //   }
  // }

  /* =====================================================
     CARREGAR CICLO (VISUALIZAÇÃO)
     ===================================================== */
  private carregarCiclo(cicloId: number): void {
    this.loading = true;

    this.api.detalharCicloParaEdicao(cicloId).subscribe({
      next: (data) => {
        this.ciclo = data; // agora data é UM objeto
       
        this.disciplinas = this.mapEditDtoToCicloItems(data.disciplinas );
        console.log('disciplina',this.disciplinas);
        this.aplicarHorasPorMateria();
      },
      error: err => console.error(err),
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onItemsChange(items: DisciplinaCicloItem[]): void {
    this.disciplinas = items;
   
    this.aplicarHorasPorMateria();
  }

  /* =====================================================
     INICIAR CICLO
     ===================================================== */
  iniciarCiclo(): void {
    if (!this.ciclo) return;

    this.router.navigate(['/estudaAgora'], {
      queryParams: { cicloId: this.ciclo.id },
    });
  }

  salvar(): void{

  }

  /* =====================================================
     CÁLCULO DE HORAS
     ===================================================== */
  private aplicarHorasPorMateria(): void {
    if (!this.ciclo) return;

    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: this.ciclo.cargaHorariaSemanal,
      materias: this.disciplinas.map(m => ({
        id: m.id,
        checked: m.checked,
        peso: m.peso ?? null,
      })),
      minHorasPorMateria: 2,
    });
  console.log(result);  
    const byId = new Map(result.perMateria.map(x => [x.id, x]));

    this.disciplinas = this.disciplinas.map(m => {
      const calc = byId.get(m.id);
      return {
        ...m,
        horasLabel: calc?.horasLabel ?? '0:00h',
      };
    });
  }

  /* =====================================================
     ADAPTER (BACKEND → UI)
     ===================================================== */
  private mapEditDtoToCicloItems( disciplinas: DisciplinaEditDto[]): DisciplinaCicloItem[] {
     console.log('disciplina config:',disciplinas);
    
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