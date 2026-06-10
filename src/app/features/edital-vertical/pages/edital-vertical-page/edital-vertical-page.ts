import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { CicloOption, CicloSelector } from '../../../../shared/components/ciclo-selector/ciclo-selector';
import { resolverCicloPadrao } from '../../../../shared/service/resolverCicloPadrao';
import { CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import { CicloDto } from '../../../ciclos/data/ciclos.models';
import { corDisciplina } from '../../../../shared/utils/cor-disciplina.util';
import { EditalVerticalApiService } from '../../edital-vertical-api.service';
import { EditalTopicoEstadoApiService } from '../../edital-topico-estado-api.service';
import {
  EditalVerticalCargoDto,
  EditalVerticalConcursoDto,
  TopicoNodeDto,
} from '../../edital-vertical.models';

export type LinhaTopico = { id: number; profundidade: number; titulo: string };

/** Linha na tabela com filhos colapsáveis. */
export type LinhaTopicoVisivel = {
  id: number;
  profundidade: number;
  titulo: string;
  hasChildren: boolean;
};

@Component({
  selector: 'app-edital-vertical-page',
  standalone: true,
  imports: [CommonModule, CicloSelector],
  templateUrl: './edital-vertical-page.html',
  styleUrl: './edital-vertical-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditalVerticalPage implements OnInit, OnDestroy {
  private static readonly LS_CICLO_PREF = 'cognora:lastCicloId';

  readonly ciclosLista = signal<CicloDto[]>([]);
  readonly ciclosOpcoes = computed<CicloOption[]>(() =>
    (this.ciclosLista() ?? []).map((c) => ({
      id: Number(c.id),
      nome: String(c.nome ?? `Ciclo ${c.id}`),
    })),
  );

  cicloSelecionadoId = signal<number | null>(null);
  loadingCiclos = signal(true);
  loadingArvore = signal(false);

  arvore = signal<EditalVerticalConcursoDto | null>(null);
  /** `concursoId` do último GET `edital-vertical` bem-sucedido. */
  private readonly arvoreConcursoId = signal<number | null>(null);

  /** Disciplinas abertas no acordeão (ids). */
  expandedDisciplinaIds = signal<Set<number>>(new Set());

  /** Tópicos-pai com subitens visíveis (ids). Por defeito vazio = só raízes. */
  expandedTopicoIds = signal<Set<number>>(new Set());

  /** Tópicos marcados como concluídos (ids), sincronizados com a API por ciclo. */
  checkedTopicIds = signal<Set<number>>(new Set());

  /** Último registo de estudo por tópico (ISO do servidor). */
  ultimoEstudoPorTopicoId = signal<Map<number, string | null>>(new Map());
  private readonly allTopicIds = signal<number[]>([]);

  private arvoreLoadSub?: Subscription;
  private estadoLoadSub?: Subscription;
  private toggleLoadSub?: Subscription;

  readonly progressoGlobal = computed(() => {
    const total = this.allTopicIds().length;
    const done = this.allTopicIds().filter((id) => this.checkedTopicIds().has(id)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, pct };
  });

  constructor(
    private readonly ciclosApi: CiclosApiService,
    private readonly editalVerticalApi: EditalVerticalApiService,
    private readonly editalTopicoEstadoApi: EditalTopicoEstadoApiService,
    private readonly toast: ToastrService,
  ) {}

  ngOnDestroy(): void {
    this.arvoreLoadSub?.unsubscribe();
    this.estadoLoadSub?.unsubscribe();
    this.toggleLoadSub?.unsubscribe();
  }

  async ngOnInit(): Promise<void> {
    this.loadingCiclos.set(true);
    try {
      const list = await this.ciclosApi.listCiclos();
      this.ciclosLista.set(list ?? []);
      const opcoes = this.ciclosOpcoes();
      const preferido = this.lerCicloPreferidoLocal();
      const cid = resolverCicloPadrao(opcoes, preferido);
      this.cicloSelecionadoId.set(cid);
      if (cid != null) {
        this.onCicloChange(cid);
      }
    } catch {
      this.toast.error('Não foi possível carregar os ciclos.');
    } finally {
      this.loadingCiclos.set(false);
    }
  }

  onCicloChange(cicloId: number): void {
    if (!Number.isFinite(cicloId) || cicloId <= 0) {
      return;
    }
    this.cicloSelecionadoId.set(cicloId);
    const ciclo = this.ciclosLista().find((c) => Number(c.id) === cicloId);
    if (!ciclo) {
      return;
    }
    const concursoId = ciclo.concursoId;
    if (concursoId == null || !Number.isFinite(Number(concursoId)) || Number(concursoId) <= 0) {
      this.toast.error('Este ciclo não tem concurso associado. Atualize o backend ou recrie o ciclo.');
      return;
    }
    const n = Number(concursoId);
    if (this.arvoreConcursoId() === n && this.arvore()) {
      this.reaplicarEstadoParaCiclo(cicloId, Number(ciclo.cargoId));
      return;
    }
    this.carregarArvore(n, cicloId, Number(ciclo.cargoId));
  }

  cargoDoCiclo(arvore: EditalVerticalConcursoDto): EditalVerticalCargoDto | null {
    const cid = this.cicloSelecionadoId();
    if (cid == null) {
      return null;
    }
    const ciclo = this.ciclosLista().find((c) => Number(c.id) === cid);
    if (!ciclo) {
      return null;
    }
    return arvore.cargos.find((g) => Number(g.id) === Number(ciclo.cargoId)) ?? null;
  }

  linhasTopicos(nodes: TopicoNodeDto[] | undefined): LinhaTopico[] {
    return achatarTopicos(nodes ?? [], 0);
  }

  /** Tópicos a mostrar na tabela (subtópicos ocultos até expandir o pai). */
  linhasTopicosVisiveis(nodes: TopicoNodeDto[] | undefined): LinhaTopicoVisivel[] {
    return achatarVisiveis(nodes ?? [], 0, this.expandedTopicoIds());
  }

  isTopicoExpandido(topicoId: number): boolean {
    return this.expandedTopicoIds().has(topicoId);
  }

  alternarExpansaoTopico(topicoId: number, ev: Event): void {
    ev.stopPropagation();
    this.expandedTopicoIds.update((s) => {
      const n = new Set(s);
      if (n.has(topicoId)) {
        n.delete(topicoId);
      } else {
        n.add(topicoId);
      }
      return n;
    });
  }

  isDisciplinaAberta(disciplinaId: number): boolean {
    return this.expandedDisciplinaIds().has(disciplinaId);
  }

  alternarDisciplina(disciplinaId: number): void {
    this.expandedDisciplinaIds.update((s) => {
      const n = new Set(s);
      if (n.has(disciplinaId)) {
        n.delete(disciplinaId);
      } else {
        n.add(disciplinaId);
      }
      return n;
    });
  }

  isTopicoMarcado(topicoId: number): boolean {
    return this.checkedTopicIds().has(topicoId);
  }

  alternarTopico(cicloId: number, raizTopicos: TopicoNodeDto[], topicoId: number): void {
    if (!Number.isFinite(cicloId) || cicloId <= 0) {
      return;
    }
    const permitidos = new Set(this.allTopicIds());
    const idsAfetados = idsDoNoEDescendentes(raizTopicos, topicoId).filter((id) => permitidos.has(id));
    if (idsAfetados.length === 0) {
      return;
    }
    const checkedAntes = this.checkedTopicIds();
    const novoConcluido = !checkedAntes.has(topicoId);
    const ultimosAntes = new Map(this.ultimoEstudoPorTopicoId());

    this.checkedTopicIds.update((s) => {
      const n = new Set(s);
      for (const id of idsAfetados) {
        if (novoConcluido) {
          n.add(id);
        } else {
          n.delete(id);
        }
      }
      return n;
    });
    if (novoConcluido) {
      const agora = new Date().toISOString();
      this.ultimoEstudoPorTopicoId.update((m) => {
        const c = new Map(m);
        for (const id of idsAfetados) {
          c.set(id, agora);
        }
        return c;
      });
    }

    this.toggleLoadSub?.unsubscribe();
    this.toggleLoadSub = forkJoin(
      idsAfetados.map((tid) =>
        this.editalTopicoEstadoApi.definirConcluido(cicloId, tid, { concluido: novoConcluido }),
      ),
    ).subscribe({
      next: (items) => {
        this.checkedTopicIds.update((s) => {
          const n = new Set(s);
          for (const item of items) {
            const tid = Number(item.topicoId);
            if (item.concluido) {
              n.add(tid);
            } else {
              n.delete(tid);
            }
          }
          return n;
        });
        this.ultimoEstudoPorTopicoId.update((m) => {
          const c = new Map(m);
          for (const item of items) {
            c.set(Number(item.topicoId), item.ultimoEstudoEm ?? null);
          }
          return c;
        });
      },
      error: () => {
        this.checkedTopicIds.set(checkedAntes);
        this.ultimoEstudoPorTopicoId.set(ultimosAntes);
        this.toast.error('Não foi possível guardar o estado dos tópicos.');
      },
    });
  }

  ultimoEstudoTexto(topicoId: number): string {
    const iso = this.ultimoEstudoPorTopicoId().get(topicoId);
    if (iso == null || iso === '') {
      return '—';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
  }

  progressoDisciplina(linhas: LinhaTopico[]): { done: number; total: number; pct: number } {
    const total = linhas.length;
    const checked = this.checkedTopicIds();
    const done = linhas.filter((l) => checked.has(l.id)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, pct };
  }

  adicionarEstudo(): void {
    this.toast.info('Funcionalidade de estudo por tópico em desenvolvimento.');
  }

  /** Cor fixa por disciplina (mesma lógica em todas as telas). */
  corDisciplina(nome: string | null | undefined): string {
    return corDisciplina(nome);
  }

  private carregarArvore(concursoId: number, cicloId: number, cargoId: number): void {
    this.arvoreLoadSub?.unsubscribe();
    this.estadoLoadSub?.unsubscribe();
    this.loadingArvore.set(true);
    this.arvore.set(null);
    this.arvoreLoadSub = this.editalVerticalApi
      .getArvorePorConcurso(concursoId, cicloId)
      .pipe(finalize(() => this.loadingArvore.set(false)))
      .subscribe({
        next: (a: EditalVerticalConcursoDto) => {
          this.arvore.set(a);
          this.arvoreConcursoId.set(concursoId);
          const cargo = a.cargos.find((g) => Number(g.id) === cargoId);
          if (!cargo) {
            this.toast.warning('O cargo deste ciclo não foi encontrado no edital deste concurso.');
            this.allTopicIds.set([]);
            this.checkedTopicIds.set(new Set());
            this.ultimoEstudoPorTopicoId.set(new Map());
            this.expandedDisciplinaIds.set(new Set());
            this.expandedTopicoIds.set(new Set());
            return;
          }
          this.inicializarTopicIdsPorCargo(a, cargoId);
          if (a.estadoTopico) {
            this.aplicarEstadoTopicoResposta(a.estadoTopico, new Set(this.allTopicIds()));
          } else {
            this.carregarEstadoTopicoServidor(cicloId, new Set(this.allTopicIds()));
          }
        },
        error: () => this.toast.error('Não foi possível carregar o edital verticalizado.'),
      });
  }

  private reaplicarEstadoParaCiclo(cicloId: number, cargoId: number): void {
    const a = this.arvore();
    if (!a) {
      return;
    }
    this.inicializarTopicIdsPorCargo(a, cargoId);
    this.carregarEstadoTopicoServidor(cicloId, new Set(this.allTopicIds()));
  }

  private inicializarTopicIdsPorCargo(a: EditalVerticalConcursoDto, cargoId: number): void {
    const idsColetados = coletarIdsPorCargo(a, cargoId);
    this.allTopicIds.set(idsColetados);
    this.checkedTopicIds.set(new Set());
    this.ultimoEstudoPorTopicoId.set(new Map());
    this.expandedDisciplinaIds.set(new Set());
    this.expandedTopicoIds.set(new Set());
  }

  private aplicarEstadoTopicoResposta(
    resp: { itens?: { topicoId: number; concluido?: boolean; ultimoEstudoEm?: string | null }[] },
    permitidos: Set<number>,
  ): void {
    const checks = new Set<number>();
    const ultimos = new Map<number, string | null>();
    for (const it of resp.itens ?? []) {
      const tid = Number(it.topicoId);
      if (!permitidos.has(tid)) {
        continue;
      }
      if (it.concluido) {
        checks.add(tid);
      }
      ultimos.set(tid, it.ultimoEstudoEm ?? null);
    }
    this.checkedTopicIds.set(checks);
    this.ultimoEstudoPorTopicoId.set(ultimos);
  }

  private carregarEstadoTopicoServidor(cicloId: number, permitidos: Set<number>): void {
    this.estadoLoadSub?.unsubscribe();
    this.estadoLoadSub = this.editalTopicoEstadoApi.listarPorCiclo(cicloId).subscribe({
      next: (resp) => this.aplicarEstadoTopicoResposta(resp, permitidos),
      error: () => {
        this.checkedTopicIds.set(new Set());
        this.ultimoEstudoPorTopicoId.set(new Map());
        this.toast.warning('Não foi possível carregar o progresso dos tópicos a partir do servidor.');
      },
    });
  }

  private lerCicloPreferidoLocal(): number | null {
    const id = Number(localStorage.getItem(EditalVerticalPage.LS_CICLO_PREF));
    return Number.isFinite(id) && id > 0 ? id : null;
  }
}

function achatarTopicos(nodes: TopicoNodeDto[], profundidade: number): LinhaTopico[] {
  const out: LinhaTopico[] = [];
  const ordenados = [...nodes].sort((a, b) => a.ordem - b.ordem);
  for (const n of ordenados) {
    out.push({ id: n.id, profundidade, titulo: n.titulo });
    if (n.children?.length) {
      out.push(...achatarTopicos(n.children, profundidade + 1));
    }
  }
  return out;
}

function achatarVisiveis(
  nodes: TopicoNodeDto[],
  profundidade: number,
  expandidos: Set<number>,
): LinhaTopicoVisivel[] {
  const out: LinhaTopicoVisivel[] = [];
  const ordenados = [...nodes].sort((a, b) => a.ordem - b.ordem);
  for (const n of ordenados) {
    const filhos = n.children?.length ? n.children : [];
    const hasChildren = filhos.length > 0;
    out.push({ id: n.id, profundidade, titulo: n.titulo, hasChildren });
    if (hasChildren && expandidos.has(n.id)) {
      out.push(...achatarVisiveis(filhos, profundidade + 1, expandidos));
    }
  }
  return out;
}

/** O tópico clicado e todos os ids na subárvore (filhos, netos, …). */
function idsDoNoEDescendentes(raiz: TopicoNodeDto[], topicoId: number): number[] {
  const no = encontrarNoTopico(raiz, topicoId);
  if (!no) {
    return [];
  }
  return [no.id, ...achatarIdsTopicos(no.children ?? [])];
}

function achatarIdsTopicos(nodes: TopicoNodeDto[]): number[] {
  const out: number[] = [];
  for (const n of nodes) {
    out.push(n.id, ...achatarIdsTopicos(n.children ?? []));
  }
  return out;
}

function encontrarNoTopico(nodes: TopicoNodeDto[], id: number): TopicoNodeDto | null {
  for (const n of nodes) {
    if (n.id === id) {
      return n;
    }
    const dentro = encontrarNoTopico(n.children ?? [], id);
    if (dentro) {
      return dentro;
    }
  }
  return null;
}

function coletarIdsPorCargo(a: EditalVerticalConcursoDto, cargoId: number): number[] {
  const cargo = a.cargos.find((g) => Number(g.id) === cargoId);
  if (!cargo) {
    return [];
  }
  const ids: number[] = [];
  for (const d of cargo.disciplinas) {
    for (const linha of achatarTopicos(d.topicos ?? [], 0)) {
      ids.push(linha.id);
    }
  }
  return ids;
}
