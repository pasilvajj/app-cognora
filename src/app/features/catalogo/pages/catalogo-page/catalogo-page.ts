import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { FormInputComponent } from '../../../../shared/components/form-input/form-input';
import { CatalogoApiService } from '../../data/catalogo-api.service';
import {
  CatalogoDeleteTarget,
  CatalogoFormKind,
  CargoCatalogoDto,
  ConcursoCatalogoDto,
  DisciplinaCatalogoDto,
  TopicoNodeDto,
} from '../../data/catalogo.models';

type FlatTopico = { id: number; titulo: string; depth: number };

@Component({
  selector: 'app-catalogo-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppButtonComponent,
    ConfirmDialog,
    FormInputComponent,
  ],
  templateUrl: './catalogo-page.html',
  styleUrl: './catalogo-page.css',
})
export class CatalogoPage {
  private readonly api = inject(CatalogoApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastrService);

  readonly ufs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ] as const;

  loadingConcursos = signal(true);
  loadingCargos = signal(false);
  loadingDisciplinas = signal(false);
  loadingTopicos = signal(false);
  saving = signal(false);
  deleting = signal(false);

  concursos = signal<ConcursoCatalogoDto[]>([]);
  cargos = signal<CargoCatalogoDto[]>([]);
  disciplinas = signal<DisciplinaCatalogoDto[]>([]);
  topicos = signal<TopicoNodeDto[]>([]);

  selectedConcursoId = signal<number | null>(null);
  selectedCargoId = signal<number | null>(null);
  selectedDisciplinaId = signal<number | null>(null);

  selectedConcurso = computed(() =>
    this.concursos().find(c => c.id === this.selectedConcursoId()) ?? null,
  );
  selectedCargo = computed(() =>
    this.cargos().find(c => c.id === this.selectedCargoId()) ?? null,
  );
  selectedDisciplina = computed(() =>
    this.disciplinas().find(d => d.id === this.selectedDisciplinaId()) ?? null,
  );

  novoTopicoDisabled = computed((): boolean => {
    const disc = this.selectedDisciplina();
    return disc == null || disc.estudoLivre;
  });

  flatTopicos = computed(() => flattenTopicos(this.topicos()));

  formOpen = signal(false);
  formKind = signal<CatalogoFormKind>('concurso');
  editingId = signal<number | null>(null);
  deleteTarget = signal<CatalogoDeleteTarget | null>(null);

  concursoForm = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(200)]],
    escopo: ['NACIONAL' as 'NACIONAL' | 'ESTADUAL', Validators.required],
    uf: [''],
  });

  cargoForm = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(200)]],
  });

  disciplinaForm = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(150)]],
    peso: [1, [Validators.required, Validators.min(1)]],
  });

  topicoForm = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(300)]],
    ordem: [0, [Validators.required, Validators.min(0)]],
    parentId: ['' as string | number],
    ativo: [true],
  });

  constructor() {
    void this.reloadConcursos();
  }

  async reloadConcursos(): Promise<void> {
    this.loadingConcursos.set(true);
    try {
      const list = await firstValueFrom(this.api.listConcursos());
      this.concursos.set(list);
      const current = this.selectedConcursoId();
      if (current != null && !list.some(c => c.id === current)) {
        this.clearFromConcurso();
      }
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível carregar concursos.'));
    } finally {
      this.loadingConcursos.set(false);
    }
  }

  async selectConcurso(id: number): Promise<void> {
    if (this.selectedConcursoId() === id) {
      return;
    }
    this.selectedConcursoId.set(id);
    this.selectedCargoId.set(null);
    this.selectedDisciplinaId.set(null);
    this.cargos.set([]);
    this.disciplinas.set([]);
    this.topicos.set([]);
    await this.reloadCargos(id);
  }

  async reloadCargos(concursoId = this.selectedConcursoId()): Promise<void> {
    if (concursoId == null) {
      return;
    }
    this.loadingCargos.set(true);
    try {
      const list = await firstValueFrom(this.api.listCargos(concursoId));
      this.cargos.set(list);
      const current = this.selectedCargoId();
      if (current != null && !list.some(c => c.id === current)) {
        this.selectedCargoId.set(null);
        this.selectedDisciplinaId.set(null);
        this.disciplinas.set([]);
        this.topicos.set([]);
      }
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível carregar cargos.'));
    } finally {
      this.loadingCargos.set(false);
    }
  }

  async selectCargo(id: number): Promise<void> {
    if (this.selectedCargoId() === id) {
      return;
    }
    this.selectedCargoId.set(id);
    this.selectedDisciplinaId.set(null);
    this.disciplinas.set([]);
    this.topicos.set([]);
    await this.reloadDisciplinas(id);
  }

  async reloadDisciplinas(cargoId = this.selectedCargoId()): Promise<void> {
    if (cargoId == null) {
      return;
    }
    this.loadingDisciplinas.set(true);
    try {
      const list = await firstValueFrom(this.api.listDisciplinas(cargoId));
      this.disciplinas.set(list);
      const current = this.selectedDisciplinaId();
      if (current != null && !list.some(d => d.id === current)) {
        this.selectedDisciplinaId.set(null);
        this.topicos.set([]);
      }
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível carregar disciplinas.'));
    } finally {
      this.loadingDisciplinas.set(false);
    }
  }

  async selectDisciplina(id: number): Promise<void> {
    if (this.selectedDisciplinaId() === id) {
      return;
    }
    this.selectedDisciplinaId.set(id);
    await this.reloadTopicos(id);
  }

  async reloadTopicos(disciplinaId = this.selectedDisciplinaId()): Promise<void> {
    if (disciplinaId == null) {
      return;
    }
    this.loadingTopicos.set(true);
    try {
      this.topicos.set(await firstValueFrom(this.api.listTopicos(disciplinaId)));
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível carregar tópicos.'));
    } finally {
      this.loadingTopicos.set(false);
    }
  }

  openCreate(kind: CatalogoFormKind): void {
    this.formKind.set(kind);
    this.editingId.set(null);
    this.resetForm(kind);
    this.formOpen.set(true);
  }

  openEditConcurso(c: ConcursoCatalogoDto): void {
    this.formKind.set('concurso');
    this.editingId.set(c.id);
    this.concursoForm.reset({
      nome: c.nome,
      escopo: c.escopo,
      uf: c.uf ?? '',
    });
    this.formOpen.set(true);
  }

  openEditCargo(c: CargoCatalogoDto): void {
    this.formKind.set('cargo');
    this.editingId.set(c.id);
    this.cargoForm.reset({ nome: c.nome });
    this.formOpen.set(true);
  }

  openEditDisciplina(d: DisciplinaCatalogoDto): void {
    if (d.estudoLivre) {
      this.toast.warning('Estudo Livre é gerenciado automaticamente.');
      return;
    }
    this.formKind.set('disciplina');
    this.editingId.set(d.id);
    this.disciplinaForm.reset({ nome: d.nome, peso: d.peso });
    this.formOpen.set(true);
  }

  openCreateTopico(parentId?: number | null): void {
    if (this.selectedDisciplina()?.estudoLivre) {
      this.toast.warning('Estudo Livre não possui tópicos no edital.');
      return;
    }
    this.formKind.set('topico');
    this.editingId.set(null);
    const nextOrdem = this.suggestNextOrdem(parentId ?? null);
    this.topicoForm.reset({
      titulo: '',
      ordem: nextOrdem,
      parentId: parentId ?? '',
      ativo: true,
    });
    this.formOpen.set(true);
  }

  openEditTopico(node: TopicoNodeDto, parentId?: number | null): void {
    this.formKind.set('topico');
    this.editingId.set(node.id);
    this.topicoForm.reset({
      titulo: node.titulo,
      ordem: node.ordem,
      parentId: parentId ?? '',
      ativo: true,
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  async submitForm(): Promise<void> {
    const kind = this.formKind();
    if (kind === 'concurso') {
      await this.submitConcurso();
    } else if (kind === 'cargo') {
      await this.submitCargo();
    } else if (kind === 'disciplina') {
      await this.submitDisciplina();
    } else {
      await this.submitTopico();
    }
  }

  confirmDelete(target: CatalogoDeleteTarget): void {
    this.deleteTarget.set(target);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.deleting.set(true);
    try {
      if (target.kind === 'concurso') {
        await firstValueFrom(this.api.deleteConcurso(target.id));
        if (this.selectedConcursoId() === target.id) {
          this.clearFromConcurso();
        }
        await this.reloadConcursos();
      } else if (target.kind === 'cargo') {
        await firstValueFrom(this.api.deleteCargo(target.id));
        if (this.selectedCargoId() === target.id) {
          this.selectedCargoId.set(null);
          this.selectedDisciplinaId.set(null);
          this.disciplinas.set([]);
          this.topicos.set([]);
        }
        await this.reloadCargos();
      } else if (target.kind === 'disciplina') {
        await firstValueFrom(this.api.deleteDisciplina(target.id));
        if (this.selectedDisciplinaId() === target.id) {
          this.selectedDisciplinaId.set(null);
          this.topicos.set([]);
        }
        await this.reloadDisciplinas();
      } else {
        await firstValueFrom(this.api.deleteTopico(target.id));
        await this.reloadTopicos();
      }
      this.toast.success('Removido com sucesso.');
      this.deleteTarget.set(null);
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível remover.'));
    } finally {
      this.deleting.set(false);
    }
  }

  formTitle(): string {
    const edit = this.editingId() != null;
    switch (this.formKind()) {
      case 'concurso':
        return edit ? 'Editar concurso' : 'Novo concurso';
      case 'cargo':
        return edit ? 'Editar cargo' : 'Novo cargo';
      case 'disciplina':
        return edit ? 'Editar disciplina' : 'Nova disciplina';
      default:
        return edit ? 'Editar tópico' : 'Novo tópico';
    }
  }

  isEstadual(): boolean {
    return this.concursoForm.controls.escopo.value === 'ESTADUAL';
  }

  deleteMessage(target: CatalogoDeleteTarget): string {
    return `Remover "${target.label}"? Esta ação não pode ser desfeita.`;
  }

  private clearFromConcurso(): void {
    this.selectedConcursoId.set(null);
    this.selectedCargoId.set(null);
    this.selectedDisciplinaId.set(null);
    this.cargos.set([]);
    this.disciplinas.set([]);
    this.topicos.set([]);
  }

  private resetForm(kind: CatalogoFormKind): void {
    if (kind === 'concurso') {
      this.concursoForm.reset({ nome: '', escopo: 'NACIONAL', uf: '' });
    } else if (kind === 'cargo') {
      this.cargoForm.reset({ nome: '' });
    } else if (kind === 'disciplina') {
      this.disciplinaForm.reset({ nome: '', peso: 1 });
    } else {
      this.topicoForm.reset({ titulo: '', ordem: 0, parentId: '', ativo: true });
    }
  }

  private async submitConcurso(): Promise<void> {
    if (this.concursoForm.invalid) {
      this.concursoForm.markAllAsTouched();
      return;
    }
    const v = this.concursoForm.getRawValue();
    if (v.escopo === 'ESTADUAL' && (!v.uf || v.uf.length !== 2)) {
      this.toast.error('Informe a UF (2 letras) para concursos estaduais.');
      return;
    }
    const body = {
      nome: v.nome!.trim(),
      escopo: v.escopo!,
      uf: v.escopo === 'ESTADUAL' ? v.uf!.trim().toUpperCase() : null,
    };
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id != null) {
        await firstValueFrom(this.api.updateConcurso(id, body));
      } else {
        const created = await firstValueFrom(this.api.createConcurso(body));
        this.selectedConcursoId.set(created.id);
      }
      this.toast.success('Concurso salvo.');
      this.formOpen.set(false);
      await this.reloadConcursos();
      if (this.selectedConcursoId() != null) {
        await this.reloadCargos(this.selectedConcursoId()!);
      }
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível salvar o concurso.'));
    } finally {
      this.saving.set(false);
    }
  }

  private async submitCargo(): Promise<void> {
    const concursoId = this.selectedConcursoId();
    if (concursoId == null) {
      return;
    }
    if (this.cargoForm.invalid) {
      this.cargoForm.markAllAsTouched();
      return;
    }
    const body = { nome: this.cargoForm.controls.nome.value!.trim() };
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id != null) {
        await firstValueFrom(this.api.updateCargo(id, body));
      } else {
        const created = await firstValueFrom(this.api.createCargo(concursoId, body));
        this.selectedCargoId.set(created.id);
      }
      this.toast.success('Cargo salvo.');
      this.formOpen.set(false);
      await this.reloadCargos(concursoId);
      if (this.selectedCargoId() != null) {
        await this.reloadDisciplinas(this.selectedCargoId()!);
      }
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível salvar o cargo.'));
    } finally {
      this.saving.set(false);
    }
  }

  private async submitDisciplina(): Promise<void> {
    const cargoId = this.selectedCargoId();
    if (cargoId == null) {
      return;
    }
    if (this.disciplinaForm.invalid) {
      this.disciplinaForm.markAllAsTouched();
      return;
    }
    const body = {
      nome: this.disciplinaForm.controls.nome.value!.trim(),
      peso: Number(this.disciplinaForm.controls.peso.value),
    };
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id != null) {
        await firstValueFrom(this.api.updateDisciplina(id, body));
      } else {
        const created = await firstValueFrom(this.api.createDisciplina(cargoId, body));
        this.selectedDisciplinaId.set(created.id);
      }
      this.toast.success('Disciplina salva.');
      this.formOpen.set(false);
      await this.reloadDisciplinas(cargoId);
      if (this.selectedDisciplinaId() != null) {
        await this.reloadTopicos(this.selectedDisciplinaId()!);
      }
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível salvar a disciplina.'));
    } finally {
      this.saving.set(false);
    }
  }

  private async submitTopico(): Promise<void> {
    const disciplinaId = this.selectedDisciplinaId();
    if (disciplinaId == null) {
      return;
    }
    if (this.topicoForm.invalid) {
      this.topicoForm.markAllAsTouched();
      return;
    }
    const rawParent = this.topicoForm.controls.parentId.value;
    const parentId = rawParent === '' || rawParent == null ? null : Number(rawParent);
    const body = {
      titulo: this.topicoForm.controls.titulo.value!.trim(),
      ordem: Number(this.topicoForm.controls.ordem.value),
      parentId,
      ativo: this.topicoForm.controls.ativo.value ?? true,
    };
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id != null) {
        await firstValueFrom(this.api.updateTopico(id, body));
      } else {
        await firstValueFrom(this.api.createTopico(disciplinaId, body));
      }
      this.toast.success('Tópico salvo.');
      this.formOpen.set(false);
      await this.reloadTopicos(disciplinaId);
    } catch (err) {
      this.toast.error(this.msgErro(err, 'Não foi possível salvar o tópico.'));
    } finally {
      this.saving.set(false);
    }
  }

  private suggestNextOrdem(parentId: number | null): number {
    const tree = this.topicos();
    if (parentId == null) {
      const roots = tree.map(n => n.ordem);
      return roots.length ? Math.max(...roots) + 1 : 0;
    }
    const parent = findTopico(tree, parentId);
    const siblings = parent?.children ?? [];
    return siblings.length ? Math.max(...siblings.map((c: TopicoNodeDto) => c.ordem)) + 1 : 0;
  }

  private msgErro(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const msg = err.error?.message ?? err.error;
      if (typeof msg === 'string' && msg.trim()) {
        return msg;
      }
    }
    return fallback;
  }
}

function flattenTopicos(nodes: TopicoNodeDto[], depth = 0, acc: FlatTopico[] = []): FlatTopico[] {
  for (const n of nodes) {
    acc.push({ id: n.id, titulo: n.titulo, depth });
    if (n.children?.length) {
      flattenTopicos(n.children, depth + 1, acc);
    }
  }
  return acc;
}

function findTopico(nodes: TopicoNodeDto[], id: number): TopicoNodeDto | null {
  for (const n of nodes) {
    if (n.id === id) {
      return n;
    }
    if (n.children?.length) {
      const found = findTopico(n.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
