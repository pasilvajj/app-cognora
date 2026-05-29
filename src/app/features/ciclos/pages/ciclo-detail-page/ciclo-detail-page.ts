import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { CiclosApiService } from '../../data/ciclos-api.service';
import { CicloUpdateRequest } from '../../data/ciclos.models';
import { calcularHorasPorMateria } from '../../utils/carga-horaria.utils';
import { ESTUDO_LIVRE_HORAS, isDisciplinaEstudoLivre } from '../../constants/estudo-livre.constants';
import { extrairMensagemErroHttp } from '../../../../shared/utils/http-error-message.util';
import { CicloHeaderComponent } from '../../../../shared/components/ciclo-header/ciclo-header.component';

import {
  MateriasCicloList,
  DisciplinaCicloItem,
  DisciplinaEditDto,
  CicloEditResponseDto,
} from '../materias-ciclo-list/materias-ciclo-list';

@Component({
  selector: 'app-ciclo-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MateriasCicloList, CicloHeaderComponent],
  templateUrl: './ciclo-detail-page.html',
  styleUrl: './ciclo-detail-page.css',
})
export class CicloDetailPage implements OnInit {
  loading = false;
  ciclo?: CicloEditResponseDto;
  disciplinas: DisciplinaCicloItem[] = [];

  nomeEdit = '';
  cargaEdit = 30;
  pomodoroAtivo = true;

  readonly pomodoroDefaults = {
    focoMin: 25,
    pausaCurtaMin: 5,
    pausaLongaMin: 15,
    longaACada: 4,
  };
  pomodoroFocoMin = this.pomodoroDefaults.focoMin;
  pomodoroPausaCurtaMin = this.pomodoroDefaults.pausaCurtaMin;
  pomodoroPausaLongaMin = this.pomodoroDefaults.pausaLongaMin;
  pomodoroLongaACada = this.pomodoroDefaults.longaACada;

  salvando = false;
  minimoHorasViolado = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: CiclosApiService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
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

  private carregarCiclo(cicloId: number): void {
    this.loading = true;

    this.api.detalharCicloParaEdicao(cicloId).subscribe({
      next: (data) => {
        const raw = data as CicloEditResponseDto & { id?: number };
        const cidApi = Number(raw.cicloId ?? raw.id);
        const cicloIdNorm = Number.isFinite(cidApi) && cidApi > 0 ? cidApi : cicloId;
        this.ciclo = { ...data, cicloId: cicloIdNorm };

        this.nomeEdit = data.nome;
        this.cargaEdit = data.cargaHorariaSemanal;
        this.pomodoroAtivo = data.pomodoroAtivo ?? true;
        this.pomodoroFocoMin = data.pomodoroFocoMin ?? this.pomodoroDefaults.focoMin;
        this.pomodoroPausaCurtaMin = data.pomodoroPausaCurtaMin ?? this.pomodoroDefaults.pausaCurtaMin;
        this.pomodoroPausaLongaMin = data.pomodoroPausaLongaMin ?? this.pomodoroDefaults.pausaLongaMin;
        this.pomodoroLongaACada = data.pomodoroLongaACada ?? this.pomodoroDefaults.longaACada;

        this.disciplinas = this.mapEditDtoToCicloItems(data.disciplinas);
        this.aplicarHorasPorMateria();
      },
      error: err => console.error(err),
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onCargaChange(value: number): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(168, Math.max(1, Math.round(n)));
    this.cargaEdit = clamped;
    this.aplicarHorasPorMateria();
  }

  onDisciplinasChange(items: DisciplinaCicloItem[]): void {
    if (this.modo !== 'edit') return;
    this.disciplinas = items;
    this.aplicarHorasPorMateria();
  }

  iniciarCiclo(): void {
    if (!this.ciclo) return;
    this.router.navigate(['/estudaAgora', this.ciclo.cicloId]);
  }

  salvar(): void {
    if (!this.ciclo || this.modo !== 'edit') return;

    const cicloIdParaSalvar = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(cicloIdParaSalvar) || cicloIdParaSalvar <= 0) {
      this.toastr.error('Identificador do ciclo inválido.');
      return;
    }

    const nome = (this.nomeEdit ?? '').trim();
    if (!nome) {
      this.toastr.warning('Informe um nome para o ciclo.');
      return;
    }

    if (this.minimoHorasViolado) {
      this.toastr.warning(
        'A carga semanal deve ser maior que 4h (Estudo Livre) e haver pelo menos uma matéria ativa.',
      );
      return;
    }

    const payload: CicloUpdateRequest = {
      nome,
      cargaHorariaSemanal: this.cargaEdit,
      ativo: this.ciclo.ativo,
      pomodoroAtivo: this.pomodoroAtivo,
      ...(this.pomodoroAtivo
        ? {
            pomodoroFocoMin: this.normPomodoroInt(this.pomodoroFocoMin, this.pomodoroDefaults.focoMin),
            pomodoroPausaCurtaMin: this.normPomodoroInt(
              this.pomodoroPausaCurtaMin,
              this.pomodoroDefaults.pausaCurtaMin,
            ),
            pomodoroPausaLongaMin: this.normPomodoroInt(
              this.pomodoroPausaLongaMin,
              this.pomodoroDefaults.pausaLongaMin,
            ),
            pomodoroLongaACada: this.normPomodoroInt(
              this.pomodoroLongaACada,
              this.pomodoroDefaults.longaACada,
            ),
          }
        : {}),
      itens: this.disciplinas.map(d => ({
        idDisciplina: d.id,
        checked: d.checked,
        completouEdital: d.completouEdital,
        nivel: d.nivel ?? 0,
        peso: d.peso ?? null,
      })),
    };

    this.salvando = true;
    this.api
      .atualizarCiclo(cicloIdParaSalvar, payload)
      .pipe(
        finalize(() => {
          this.salvando = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toastr.success('Alterações salvas.');
          this.router.navigate(['/ciclos']);
        },
        error: (err) => {
          console.error(err);
          const msg = extrairMensagemErroHttp(err);
          this.toastr.error(msg ?? 'Não foi possível salvar o ciclo. Verifique a consola (rede) para detalhes.');
        },
      });
  }

  private aplicarHorasPorMateria(): void {
    if (!this.ciclo) return;

    const cargaHorariaSemanal = this.cargaEdit ?? this.ciclo.cargaHorariaSemanal;
    const cargaParaMaterias = Math.max(0, (Number(cargaHorariaSemanal) || 0) - ESTUDO_LIVRE_HORAS);

    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: cargaParaMaterias,
      materias: this.disciplinas.map(m => ({
        id: m.id,
        checked: m.checked,
        peso: m.peso ?? null,
      })),
      minHorasPorMateria: 2,
    });

    const byId = new Map(result.perMateria.map(x => [x.id, x]));

    this.disciplinas = this.disciplinas.map(m => {
      const calc = byId.get(m.id);
      return {
        ...m,
        horasLabel: calc?.horasLabel ?? '0:00h',
      };
    });

    const nAtivas = this.disciplinas.filter(m => m.checked).length;
    const cargaTotal = Number(cargaHorariaSemanal) || 0;
    this.minimoHorasViolado =
      cargaTotal <= ESTUDO_LIVRE_HORAS || cargaParaMaterias <= 0 || nAtivas === 0;
  }

  private mapEditDtoToCicloItems(disciplinas: DisciplinaEditDto[]): DisciplinaCicloItem[] {
    return disciplinas
      .filter(d => !isDisciplinaEstudoLivre(d.nome))
      .map(d => ({
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

  private normPomodoroInt(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n < 1) {
      return fallback;
    }
    return Math.floor(n);
  }
}
