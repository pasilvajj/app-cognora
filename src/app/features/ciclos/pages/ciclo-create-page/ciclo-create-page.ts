import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { calcularHorasPorMateria } from '../../utils/carga-horaria.utils';
import { CiclosApiService } from '../../data/ciclos-api.service';
import { BR_UFS } from '../../constants/br-ufs';
import { AuthService } from '../../../../core/auth/auth.service';
import {  MateriasCicloList, DisciplinaCicloItem} from '../materias-ciclo-list/materias-ciclo-list';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';

type Concurso = {
  id: number;
  nome: string;
  escopo?: 'NACIONAL' | 'ESTADUAL';
  uf?: string | null;
};
type Cargo = { id: number; nome: string };
type EstrategiaCiclo = 'FIXA' | 'AUTO' | 'ATRASADAS';
type EscopoRegiao = 'NACIONAL' | 'ESTADUAL';

@Component({
  selector: 'app-ciclo-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MateriasCicloList,AppButtonComponent],
  templateUrl: './ciclo-create-page.html',
  styleUrl: './ciclo-create-page.css',
})
export class CicloCreatePage implements OnInit {

 private ownerId!: number;

  nomeCiclo = 'PF 2025 - Agente';
  cargaHorariaSemanal = 30;
  ativo = true;

  estrategia: EstrategiaCiclo = 'AUTO';
  disciplinas: DisciplinaCicloItem[] = [];

  /** Filtro de região antes de listar concursos (cadastro no backend por escopo + UF). */
  escopoRegiao: EscopoRegiao | null = null;
  ufRegiao: string | null = null;
  readonly ufsBr = BR_UFS;

  concursos: Concurso[] = [];
  cargos: Cargo[] = [];
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

  // Se você quiser salvar configurações no ciclo (opcional, backend já suporta na entidade):
  // pomodoroFocoMin = 25;
  // pomodoroPausaCurtaMin = 5;
  // pomodoroPausaLongaMin = 15;
  // pomodoroLongaACada = 4;
  // =========================

  constructor(
    private router: Router,
    private api: CiclosApiService,
    private cdr: ChangeDetectorRef,
      private auth: AuthService,
  ) {}
  ngOnInit(): void {

    const user = this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.ownerId = user.id;
    this.aplicarHorasPorMateria();
  }

  voltarParaMeusCiclos(): void {
    this.router.navigate(['/ciclos']);
  }

  /** Rótulo no select: nome + indicação de escopo/UF quando vier da API. */
  labelConcurso(c: Concurso): string {
    if (c.escopo === 'ESTADUAL' && c.uf) {
      return `${c.nome} (${c.uf})`;
    }
    if (c.escopo === 'NACIONAL') {
      return `${c.nome} — Nacional`;
    }
    return c.nome;
  }

  /**
   * Usa o valor emitido pelo ngModel (não o evento `change`), para o modelo já estar
   * atualizado ao buscar disciplinas — evita lista só atualizar no blur.
   */
  onCargoModelChange(cargoId: number | null): void {
    if (cargoId == null) {
      this.disciplinas = [];
      this.cdr.detectChanges();
      return;
    }
    this.carregarDisciplinas(cargoId);
  }

  onConcursoModelChange(concursoId: number | null): void {
    this.cargos = [];
    this.cargoId = null;
    this.disciplinas = [];
    this.cdr.detectChanges();

    if (concursoId == null) {
      return;
    }
    this.carregarCargo(concursoId);
  }

  /** Ao mudar Nacional / Estadual ou UF: zera concurso/cargo/disciplinas e recarrega lista de concursos. */
  onRegiaoChange(): void {
    this.concursoId = null;
    this.cargoId = null;
    this.cargos = [];
    this.disciplinas = [];

    if (this.escopoRegiao === 'NACIONAL') {
      this.ufRegiao = null;
      this.carregarConcursosFiltrados();
      return;
    }

    if (this.escopoRegiao === 'ESTADUAL') {
      if (this.ufRegiao) {
        this.carregarConcursosFiltrados();
      } else {
        this.concursos = [];
      }
      this.cdr.detectChanges();
      return;
    }

    this.ufRegiao = null;
    this.concursos = [];
    this.cdr.detectChanges();
  }

  private carregarConcursosFiltrados(): void {
    if (!this.escopoRegiao) {
      return;
    }
    if (this.escopoRegiao === 'ESTADUAL' && !this.ufRegiao) {
      return;
    }

    this.loadingConcursos = true;

    const uf = this.escopoRegiao === 'ESTADUAL' ? this.ufRegiao ?? undefined : undefined;

    this.api.listConcursos(this.escopoRegiao, uf).subscribe({
      next: (data) => {
        this.concursos = data ?? [];
        this.concursoId = null;
        this.cargos = [];
        this.cargoId = null;
        this.disciplinas = [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao listar concursos', err);
      },
      complete: () => {
        this.loadingConcursos = false;
        this.cdr.detectChanges();
      },
    });
  }

  carregarCargo(concursoId: number): void {
    this.loadingCargo = true;

    this.api.listCargosByConcurso(concursoId).subscribe({
      next: (data) => {
        this.cargos = data ?? [];
        this.cargoId = null;
        this.disciplinas = [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao listar cargos', err);
      },
      complete: () => {
        this.loadingCargo = false;
        this.cdr.detectChanges();
      },
    });
  }

  carregarDisciplinas(cargoId: number): void {
    this.loadingDisciplinas = true;

    this.api.listDisciplinasByConcurso(cargoId).subscribe({
      next: (data) => {
        this.disciplinas = data ?? [];
        console.log('Disciplina: ',this.disciplinas);
        this.aplicarHorasPorMateria();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao listar disciplinas', err);
      },
      complete: () => {
        this.loadingDisciplinas = false;
        this.cdr.detectChanges();
      },
    });
  }

  salvar(): void {
    const nome = (this.nomeCiclo ?? '').trim();
    if (!nome) {
      console.error('Nome do ciclo é obrigatório.');
      return;
    }

    if (!this.cargaHorariaSemanal || this.cargaHorariaSemanal <= 0) {
      console.error('Carga horária semanal é obrigatória.');
      return;
    }

    if (!this.escopoRegiao) {
      console.error('Selecione a região (Nacional ou Estadual).');
      return;
    }

    if (this.escopoRegiao === 'ESTADUAL' && !this.ufRegiao) {
      console.error('Selecione o estado (UF).');
      return;
    }

    if (!this.concursoId) {
      console.error('Selecione um concurso.');
      return;
    }

    if (!this.cargoId) {
      console.error('Selecione um cargo.');
      return;
    }

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
        peso: d.peso ?? null,
        nivel: d.nivel ?? 0
      })),

      // Pomodoro (backend: CicloCreateDto precisa ter pomodoroAtivo)
      pomodoroAtivo: this.usarPomodoro,

      // Se for persistir configs no ciclo, descomente e garanta no backend DTO:
      // pomodoroFocoMin: this.pomodoroFocoMin,
      // pomodoroPausaCurtaMin: this.pomodoroPausaCurtaMin,
      // pomodoroPausaLongaMin: this.pomodoroPausaLongaMin,
      // pomodoroLongaACada: this.pomodoroLongaACada,
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

   onItemsChange(items: DisciplinaCicloItem[]): void {
    this.disciplinas = items;
    this.aplicarHorasPorMateria();
  }

  aplicarHorasPorMateria(): void {
    if (!this.disciplinas) return;

    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: this.cargaHorariaSemanal,
      materias: this.disciplinas.map(m => ({
        id: m.id,
        checked: m.checked,
        peso: m.peso ?? null,
      })),
      minHorasPorMateria: 2,
    });
    console.log('Disciplina result: ',this.disciplinas);
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
}