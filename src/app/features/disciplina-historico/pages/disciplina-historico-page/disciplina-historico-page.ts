import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import { CicloDto } from '../../../ciclos/data/ciclos.models';
import { EditalVerticalApiService } from '../../../edital-vertical/edital-vertical-api.service';
import { EditalTopicoEstadoApiService } from '../../../edital-vertical/edital-topico-estado-api.service';
import { EditalVerticalConcursoDto, TopicoNodeDto } from '../../../edital-vertical/edital-vertical.models';
import { EstudoApiService } from '../../../estudo/data/estudo-api.service';
import {
  DisciplinaHistoricoResumoDto,
  DisciplinaHistoricoSessaoDto,
  ProgressoDisciplinaDto,
} from '../../../estudo/data/estudo.models';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { RegistroEstudoModalComponent } from '../../../estudo/components/registro-estudo-modal/registro-estudo-modal';

export type LinhaTopico = { id: number; profundidade: number; titulo: string };

export type LinhaTopicoVisivel = {
  id: number;
  profundidade: number;
  titulo: string;
  hasChildren: boolean;
};

@Component({
  selector: 'app-disciplina-historico-page',
  standalone: true,
  imports: [CommonModule, RegistroEstudoModalComponent],
  templateUrl: './disciplina-historico-page.html',
  styleUrl: './disciplina-historico-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisciplinaHistoricoPage implements OnInit {
  readonly loading = signal(true);
  readonly cicloId = signal<number | null>(null);
  readonly disciplinaId = signal<number | null>(null);
  readonly disciplinaNome = signal('');
  readonly cicloNome = signal('');
  readonly topicosRaiz = signal<TopicoNodeDto[]>([]);
  readonly cargoNome = signal('');

  readonly expandedTopicoIds = signal<Set<number>>(new Set());
  readonly checkedTopicIds = signal<Set<number>>(new Set());
  readonly ultimoEstudoPorTopicoId = signal<Map<number, string | null>>(new Map());
  private readonly allTopicIds = signal<number[]>([]);

  readonly linhas = computed(() => achatarTopicos(this.topicosRaiz(), 0));

  readonly progressoEdital = computed(() => {
    const ids = this.allTopicIds();
    const checked = this.checkedTopicIds();
    const total = ids.length;
    const done = ids.filter((id) => checked.has(id)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, pct };
  });

  readonly historicoSessoes = signal<DisciplinaHistoricoSessaoDto[]>([]);
  readonly historicoTotalElements = signal(0);
  readonly historicoCarregandoMais = signal(false);
  readonly registroModalAberto = signal(false);
  readonly registroSessaoEstudoId = signal<number | null>(null);
  /** Id do evento (segmento); igual ao `id` da linha do histórico. */
  readonly registroSegmentoId = signal<number | null>(null);

  tempoEstudoLabel = '—';
  desempenhoLabel = '—';
  paginasLabel = '—';

  private historicoPagina = 0;
  private readonly historicoPageSize = 25;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly location: Location,
    private readonly ciclosApi: CiclosApiService,
    private readonly editalVerticalApi: EditalVerticalApiService,
    private readonly editalTopicoEstadoApi: EditalTopicoEstadoApiService,
    private readonly estudoApi: EstudoApiService,
    private readonly toast: ToastrService,
  ) {}

  ngOnInit(): void {
    const cicloIdRaw = Number(this.route.snapshot.paramMap.get('cicloId'));
    const disciplinaIdRaw = Number(this.route.snapshot.paramMap.get('disciplinaId'));
    if (!Number.isFinite(cicloIdRaw) || cicloIdRaw <= 0 || !Number.isFinite(disciplinaIdRaw) || disciplinaIdRaw <= 0) {
      this.toast.error('Ciclo ou disciplina inválidos.');
      void this.router.navigate(['/dashboard']);
      return;
    }
    this.cicloId.set(cicloIdRaw);
    this.disciplinaId.set(disciplinaIdRaw);
    this.carregar(cicloIdRaw, disciplinaIdRaw);
  }

  voltar(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }

  linhasTopicosVisiveis(): LinhaTopicoVisivel[] {
    return achatarVisiveis(this.topicosRaiz(), 0, this.expandedTopicoIds());
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

  isTopicoMarcado(topicoId: number): boolean {
    return this.checkedTopicIds().has(topicoId);
  }

  alternarTopico(topicoId: number): void {
    const cicloId = this.cicloId();
    if (cicloId == null) {
      return;
    }
    const raiz = this.topicosRaiz();
    const permitidos = new Set(this.allTopicIds());
    const idsAfetados = idsDoNoEDescendentes(raiz, topicoId).filter((id) => permitidos.has(id));
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

    forkJoin(
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

  progressoDisciplinaLinhas(): { done: number; total: number; pct: number } {
    const linhas = this.linhas();
    const checked = this.checkedTopicIds();
    const total = linhas.length;
    const done = linhas.filter((l) => checked.has(l.id)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, pct };
  }

  adicionarEstudo(): void {
    this.toast.info('Registo de estudo por tópico em desenvolvimento.');
  }

  abrirRegistroHistorico(linha: DisciplinaHistoricoSessaoDto): void {
    const sid = linha.sessaoEstudoId;
    if (sid == null || !Number.isFinite(Number(sid)) || Number(sid) <= 0) {
      this.toast.warning('Este registo não tem sessão associada para edição.');
      return;
    }
    this.registroSessaoEstudoId.set(Number(sid));
    this.registroSegmentoId.set(linha.id);
    this.registroModalAberto.set(true);
  }

  onRegistroModalOpenChange(aberto: boolean): void {
    this.registroModalAberto.set(aberto);
    if (!aberto) {
      this.registroSessaoEstudoId.set(null);
      this.registroSegmentoId.set(null);
    }
  }

  onRegistroHistoricoGravado(): void {
    const cicloId = this.cicloId();
    const disciplinaId = this.disciplinaId();
    if (cicloId == null || disciplinaId == null) {
      return;
    }
    this.historicoPagina = 0;
    this.estudoApi.getDisciplinaHistoricoSessoes(disciplinaId, cicloId, 0, this.historicoPageSize).subscribe({
      next: (page) => {
        this.historicoSessoes.set(page?.content ?? []);
        this.historicoTotalElements.set(Number(page?.totalElements ?? 0));
      },
      error: () => this.toast.error('Não foi possível actualizar o histórico.'),
    });
  }

  historicoTemMais(): boolean {
    return this.historicoSessoes().length < this.historicoTotalElements();
  }

  carregarMaisHistorico(): void {
    const cicloId = this.cicloId();
    const disciplinaId = this.disciplinaId();
    if (cicloId == null || disciplinaId == null || !this.historicoTemMais() || this.historicoCarregandoMais()) {
      return;
    }
    this.historicoCarregandoMais.set(true);
    this.historicoPagina += 1;
    this.estudoApi
      .getDisciplinaHistoricoSessoes(disciplinaId, cicloId, this.historicoPagina, this.historicoPageSize)
      .subscribe({
        next: (page) => {
          const novos = page?.content ?? [];
          this.historicoSessoes.update((atual) => [...atual, ...novos]);
          this.historicoTotalElements.set(Number(page?.totalElements ?? this.historicoTotalElements()));
          this.historicoCarregandoMais.set(false);
        },
        error: () => {
          this.historicoPagina -= 1;
          this.historicoCarregandoMais.set(false);
          this.toast.error('Não foi possível carregar mais registos.');
        },
      });
  }

  formatarDataSessao(s: DisciplinaHistoricoSessaoDto): string {
    const raw = s.inicio ?? s.fim;
    if (raw == null || raw === '') {
      return '—';
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  formatarDuracaoSessao(segundos: number): string {
    const s = Math.max(0, Math.floor(Number(segundos) || 0));
    return TempoFormatUtil.msParaRelogio(s * 1000, 'floor');
  }

  estadoSessaoLabel(status: string): string {
    switch (status) {
      case 'CONCLUIDA':
        return 'Concluída';
      case 'ENCERRADA':
        return 'Encerrada';
      case 'PAUSADA':
        return 'Pausada';
      case 'EM_ANDAMENTO':
        return 'Em curso';
      case 'PRONTA':
        return 'Reservada';
      default:
        return status || '—';
    }
  }

  estadoSessaoClass(status: string): string {
    switch (status) {
      case 'CONCLUIDA':
        return 'dh-pill dh-pill--ok';
      case 'ENCERRADA':
        return 'dh-pill dh-pill--muted';
      case 'PAUSADA':
        return 'dh-pill dh-pill--warn';
      case 'EM_ANDAMENTO':
        return 'dh-pill dh-pill--primary';
      default:
        return 'dh-pill dh-pill--muted';
    }
  }

  private carregar(cicloId: number, disciplinaId: number): void {
    this.loading.set(true);
    this.historicoPagina = 0;
    this.historicoSessoes.set([]);
    this.historicoTotalElements.set(0);
    forkJoin({
      ciclo: this.ciclosApi.getCiclo(cicloId),
      progresso: this.estudoApi.getProgressoCiclo(cicloId),
      resumoGlobal: this.estudoApi.getDisciplinaHistoricoResumo(disciplinaId, cicloId),
      sessoes: this.estudoApi.getDisciplinaHistoricoSessoes(disciplinaId, cicloId, 0, this.historicoPageSize),
    }).subscribe({
      next: ({ ciclo, progresso, resumoGlobal, sessoes }) => {
        this.aplicarResumo(progresso ?? [], disciplinaId);
        this.aplicarResumoGlobal(resumoGlobal);
        this.historicoSessoes.set(sessoes?.content ?? []);
        this.historicoTotalElements.set(Number(sessoes?.totalElements ?? 0));
        this.cicloNome.set(String(ciclo?.nome ?? 'Ciclo'));
        const concursoId = ciclo?.concursoId;
        if (concursoId == null || !Number.isFinite(Number(concursoId)) || Number(concursoId) <= 0) {
          this.toast.error('Este ciclo não tem concurso associado ao edital.');
          this.loading.set(false);
          return;
        }
        this.carregarArvore(Number(concursoId), ciclo as CicloDto, cicloId, disciplinaId);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Não foi possível carregar os dados da disciplina.');
      },
    });
  }

  private aplicarResumoGlobal(resumo: DisciplinaHistoricoResumoDto): void {
    const seg = Math.max(0, Math.floor(Number(resumo?.totalEstudadoSeg ?? 0)));
    const min = Math.round(seg / 60);
    this.tempoEstudoLabel = min > 0 ? TempoFormatUtil.minutosParaHorasMin(min) : '—';
    const nome = String(resumo?.disciplinaNome ?? '').trim();
    if (nome) {
      this.disciplinaNome.set(nome);
    }
  }

  private aplicarResumo(progresso: ProgressoDisciplinaDto[], disciplinaId: number): void {
    const p = progresso.find((x) => Number(x.disciplinaId) === disciplinaId);
    if (!p) {
      this.desempenhoLabel = '—';
      this.paginasLabel = '—';
      return;
    }
    const nome = String(p.disciplinaNome ?? '').trim();
    if (nome) {
      this.disciplinaNome.set(nome);
    }
    const perc = Number(p.percentual ?? 0);
    this.desempenhoLabel = Number.isFinite(perc) ? `${Math.round(perc)}%` : '—';
    this.paginasLabel = '—';
  }

  private carregarArvore(concursoId: number, ciclo: CicloDto, cicloId: number, disciplinaId: number): void {
    this.editalVerticalApi.getArvorePorConcurso(concursoId).subscribe({
      next: (arv: EditalVerticalConcursoDto) => {
        const cargo = arv.cargos.find((g) => Number(g.id) === Number(ciclo.cargoId));
        if (!cargo) {
          this.toast.warning('Cargo do ciclo não encontrado no edital deste concurso.');
          this.loading.set(false);
          return;
        }
        this.cargoNome.set(String(cargo.nome ?? ''));
        const disc = cargo.disciplinas.find((d) => Number(d.id) === disciplinaId);
        if (!disc) {
          this.toast.warning('Disciplina não encontrada no edital deste cargo.');
          this.loading.set(false);
          return;
        }
        this.disciplinaNome.set(String(disc.nome ?? this.disciplinaNome()));
        this.topicosRaiz.set(disc.topicos ?? []);
        const ids = coletarIdsTopicos(disc.topicos ?? []);
        this.allTopicIds.set(ids);
        this.checkedTopicIds.set(new Set());
        this.ultimoEstudoPorTopicoId.set(new Map());
        this.expandedTopicoIds.set(new Set());
        this.carregarEstadoTopicoServidor(cicloId, new Set(ids));
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Não foi possível carregar o edital verticalizado.');
        this.loading.set(false);
      },
    });
  }

  private carregarEstadoTopicoServidor(cicloId: number, permitidos: Set<number>): void {
    this.editalTopicoEstadoApi.listarPorCiclo(cicloId).subscribe({
      next: (resp) => {
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
      },
      error: () => {
        this.toast.warning('Não foi possível carregar o progresso dos tópicos.');
      },
    });
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

function coletarIdsTopicos(nodes: TopicoNodeDto[]): number[] {
  return achatarTopicos(nodes, 0).map((l) => l.id);
}

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
