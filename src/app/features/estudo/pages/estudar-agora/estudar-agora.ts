import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError, delay, finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { CicloMateriaDto, CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import {
  formatPercent as formatPercentUtil,
  normalizarNomeDisciplina,
  normalizarPercentualProgresso as normalizarPercentualProgressoUtil,
} from '../../../../shared/utils/progresso-disciplina.util';
import { CicloDto } from '../../../ciclos/data/ciclos.models'; // ajuste para seu tipo real
import { CicloItemView, EscolherMateriaModalCircular } from '../../components/escolher-materia-modal-circular/escolher-materia-modal-circular';
import { RecentSession, UltimasSessoesCard } from '../../components/ultimas-sessoes-card/ultimas-sessoes-card';
import { EstudoApiService, } from '../../data/estudo-api.service';
import { ProgressoDisciplinaDto, ProximaSessaoDto, SessaoCardDto } from '../../data/estudo.models';


type ProgressItem = {
  disciplina: string;
  percent: number; // 0..100proxima
};

type ObservacaoMateriaItem = {
  sessaoId: number;
  disciplina: string;
  observacao: string;
  dataIso: string;
  dataLabel: string;
};
@Component({
  selector: 'app-estudar-agora',
  imports: [CommonModule, UltimasSessoesCard, EscolherMateriaModalCircular, AppButtonComponent],
  templateUrl: './estudar-agora.html',
  styleUrl: './estudar-agora.css',
})
export class EstudarAgora implements OnInit {

  cicloId = 1;
  private usuarioId!: number;
  loading = signal(true);
  isProcessando = signal(false);
  // recomendado pelo backend (ordem do ciclo)
  proximaSessaoDto?: ProximaSessaoDto;
  tempoPlanejadoLabel = '';
  // ciclo completo (itens do ciclo) para o modal listar
  ciclo?: CicloDto;
  selecionadoCicloItemId?: number;
  // itens para o modal (shape simples)
  itens: CicloItemView[] = [];
  // item selecionado (override). Por padrão = recomendado
  selecionado?: CicloItemView;
  // controla abertura do modal
  modalOpen = false;
  progress: ProgressItem[] = [];
  recentSessions: RecentSession[] = [];
  observacoesMateria: ObservacaoMateriaItem[] = [];
  observacoesLoading = signal(false);
  private progressoBruto: ProgressoDisciplinaDto[] = [];

  constructor(
    private readonly ciclosApi: CiclosApiService,
    private readonly estudoApi: EstudoApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly toastr: ToastrService,
  ) { }

  ngOnInit(): void {

    this.loading.set(true);

    const user = this.auth.getUser()!;
    this.usuarioId = user.id;

    const idRaw = this.route.snapshot.paramMap.get('cicloId');
    this.cicloId = Number(idRaw);

    this.getProximaSessao();
    this.carregarMateriasDoCiclo();
    this.getProgressoCiclo();
    this.getSessoesRecentes();

  }

  voltarParaMeusCiclos(): void {
    this.router.navigate(['/ciclos']);
  }

  getProximaSessao(): void {
    this.estudoApi.getProximaSessao(this.cicloId).pipe(
      delay(0)
    ).subscribe({
      next: (r) => {
        this.proximaSessaoDto = r;
        this.selecionadoCicloItemId = r.cicloItemId; // default = recomendado
        this.tempoPlanejadoLabel = TempoFormatUtil.minutosParaHorasMin(r.tempoMinutos);
        // força atualização da UI imediatamente
        this.cdr.detectChanges();
        this.carregarMateriasDoCiclo();
      },
      error: (e) => console.error('Erro proxima sessão', e),
    });
  }

  getSessoesRecentes(): void {
    this.estudoApi.getSessoesRecentes(this.usuarioId, this.cicloId, 10)
      .subscribe({
        next: (sessoes) => {
          const lista = sessoes ?? [];
          const inicializadas = lista.filter((s) => this.sessaoCronometroJaIniciou(s));
          this.recentSessions = inicializadas.map((s) => this.mapSessaoParaCard(s));
          this.carregarObservacoesDasSessoes(inicializadas);
        },
        error: () => this.toastr.error('Erro ao carregar sessões recentes')
      });
  }

  /** Só entra em “Últimas sessões” após o primeiro comecar (campo inicio preenchido). */
  private sessaoCronometroJaIniciou(s: SessaoCardDto): boolean {
    const ini = s.inicio;
    if (ini == null || String(ini).trim() === '') {
      return false;
    }
    const t = Date.parse(String(ini));
    return !Number.isNaN(t);
  }

  private mapSessaoParaCard(s: SessaoCardDto) {
    const estudadoSeg = Number(s.estudadoTotalSeg ?? s.segundosEstudados ?? 0);
    const restanteSeg = Math.max(0, Number(s.segundosRestantes ?? 0));
    const baseDate = s.fim ?? s.inicio;
    const statusNormalizado = this.normalizarStatusSessao(s.status, estudadoSeg, restanteSeg);

    const ordem = s.ordemNoCiclo;
    const numero =
      ordem != null && Number.isFinite(Number(ordem)) && Number(ordem) > 0 ? Number(ordem) : undefined;

    return {
      sessaoId: s.id,
      numero,
      label: baseDate ? this.formatLabelFromFimOrInicio(baseDate) : '—',
      disciplina: s.disciplinaNome,
      studiedLabel: this.formatSeconds(estudadoSeg),
      remainingLabel: s.fim ? undefined : this.formatSeconds(restanteSeg),
      status: statusNormalizado,
      estudadoTotalSeg: s.estudadoTotalSeg,
    };
  }

  private normalizarStatusSessao(
    status: SessaoCardDto['status'],
    estudadoSeg: number,
    restanteSeg: number,
  ): SessaoCardDto['status'] {
    // Sessão sem progresso real não pode aparecer como concluída
    // quando ainda existe tempo restante.
    if (estudadoSeg <= 0 && restanteSeg > 0) {
      return 'PAUSADA';
    }
    return status;
  }

  getProgressoCiclo(): void {
    this.estudoApi.getProgressoCiclo(this.cicloId, this.usuarioId).subscribe({
      next: (list: ProgressoDisciplinaDto[]) => {
        this.progressoBruto = list ?? [];
        this.recalcularProgresso();
      },
      error: (e) => console.error('Erro progresso ciclo', e),
    });
  }

  private recalcularProgresso(): void {
    this.progress = this.progressoBruto.map((p) => ({
      disciplina: p.disciplinaNome,
      percent: normalizarPercentualProgressoUtil(p, (nome) => this.obterMetaDaDisciplina(nome)),
    }));
    this.cdr.detectChanges();
  }

  private obterMetaDaDisciplina(disciplinaNome: string): number {
    const key = normalizarNomeDisciplina(disciplinaNome);
    if (!key) return 0;
    const item = this.itens.find((i) => normalizarNomeDisciplina(i.disciplinaNome) === key);
    const meta = Number(item?.tempoMinutos ?? 0);
    return Number.isFinite(meta) && meta > 0 ? meta : 0;
  }

  formatPercent(value: number): string {
    return formatPercentUtil(value);
  }


  iniciarEstudo(): void {
    if (!this.proximaSessaoDto) {
      return;
    }
    this.executarInicioDeSessao(this.proximaSessaoDto.cicloItemId);
  }

  /** Prioridade: sessão em aberto; senão primeira matéria do ciclo ainda não concluída. */
  private escolherProximaMateriaElegivel(itens: CicloItemView[]): CicloItemView | undefined {
    const list = [...itens].sort((a, b) => a.ordem - b.ordem);
    const emAndamento = list.find((i) => !!i.cronometroIniciado && !i.concluida);
    if (emAndamento) return emAndamento;
    return list.find((i) => !i.concluida);
  }

  /**
   * Se a API indicar como próxima uma matéria já concluída, alinha ao primeiro item elegível do ciclo
   * (não exibir / não recomendar estudo em matéria concluída).
   */
  private alinharProximaSessaoAoCiclo(): void {
    const dto = this.proximaSessaoDto;
    if (!dto || !this.itens.length) {
      return;
    }

    const alvo = this.itens.find((i) => i.cicloItemId === dto.cicloItemId);
    if (alvo && !alvo.concluida) {
      this.selecionadoCicloItemId = dto.cicloItemId;
      this.selecionado = alvo;
      this.tempoPlanejadoLabel = TempoFormatUtil.minutosParaHorasMin(alvo.tempoMinutos);
      return;
    }

    const elegivel = this.escolherProximaMateriaElegivel(this.itens);
    if (elegivel) {
      this.proximaSessaoDto = {
        ...dto,
        cicloItemId: elegivel.cicloItemId,
        ordem: elegivel.ordem,
        disciplinaNome: elegivel.disciplinaNome,
        tempoMinutos: elegivel.tempoMinutos,
      };
      this.selecionadoCicloItemId = elegivel.cicloItemId;
      this.selecionado = elegivel;
      this.tempoPlanejadoLabel = TempoFormatUtil.minutosParaHorasMin(elegivel.tempoMinutos);
    } else {
      this.proximaSessaoDto = undefined;
      this.selecionadoCicloItemId = undefined;
      this.selecionado = undefined;
      this.tempoPlanejadoLabel = '';
    }
  }

  private carregarMateriasDoCiclo(): void {
    this.ciclosApi.getMateriasCiclo(this.cicloId, this.usuarioId).
      pipe(finalize(() => (this.loading.set(false)))).subscribe({
        next: (list: CicloMateriaDto[]) => {
          this.itens = list.map((m) => ({
            cicloItemId: m.cicloItemId,
            ordem: m.ordem,
            disciplinaNome: m.disciplinaNome,
            tempoMinutos: m.tempoMinutos,
            visto: m.visto,
            sessaoAbertaId: m.sessaoAbertaId,
            cronometroIniciado: m.cronometroIniciado ?? false,
            concluida: m.concluida,
          }));
          this.alinharProximaSessaoAoCiclo();
          this.recalcularProgresso();
          this.cdr.detectChanges();
        },
        error: (e) => console.error('Erro ao carregar matérias do ciclo', e),
      });
  }

  onStartSession(item: CicloItemView): void {
    if (item.concluida) {
      this.toastr.warning('Esta matéria já foi concluída no ciclo.');
      return;
    }
    this.modalOpen = false;
    this.executarInicioDeSessao(item.cicloItemId);
  }

  private executarInicioDeSessao(cicloItemId: number): void {
    if (this.isProcessando()) return;

    const meta = this.itens.find((i) => i.cicloItemId === cicloItemId);
    if (meta?.concluida) {
      this.toastr.warning('Esta matéria já foi concluída no ciclo.');
      return;
    }

    this.estudoApi.iniciarSessao({
      usuarioId: this.usuarioId,
      cicloId: this.cicloId,
      cicloItemId
    }).pipe(
      finalize(() => this.isProcessando.set(false))
    ).subscribe({
      next: (s) => {
        if (s?.id) {
          this.router.navigate(['/estudo/sessao', s.id]);
        } else {
          this.toastr.error('Erro de ID');
        }
      },
      error: () => this.toastr.error('Erro ao iniciar')
    });
  }

  abrirEscolha(): void {
    this.modalOpen = true;
  }

  onSelectItem(i: CicloItemView): void {
    this.selecionado = i;
    this.modalOpen = false;
  }

  trackByDisciplina(_: number, item: ProgressItem): string {
    return item.disciplina;
  }


  getBarClass(percent: number): 'bar-blue' | 'bar-green' | 'bar-orange' {
    if (percent >= 60) return 'bar-green';
    if (percent >= 35) return 'bar-blue';
    return 'bar-orange';
  }

  private formatSeconds(total: number): string {
    const sec = Math.max(0, Math.floor(total));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  private formatLabelFromFimOrInicio(iso: string): string {
    const d = new Date(iso);
    const now = new Date();

    const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86400000);

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  trackByObservacao(_: number, item: ObservacaoMateriaItem): number {
    return item.sessaoId;
  }

  private carregarObservacoesDasSessoes(sessoes: SessaoCardDto[]): void {
    const ids = [...new Set((sessoes ?? []).map(s => Number(s.id)).filter(id => Number.isFinite(id) && id > 0))];
    if (!ids.length) {
      this.observacoesMateria = [];
      return;
    }

    this.observacoesLoading.set(true);

    forkJoin(
      ids.map(id =>
        this.estudoApi.getSessao(id).pipe(
          catchError(() => of(null)),
        ),
      ),
    ).pipe(
      finalize(() => this.observacoesLoading.set(false)),
    ).subscribe((detalhes) => {
      const notas = (detalhes ?? [])
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => {
          const dataSessao = s.inicio ?? s.fim;
          return {
          sessaoId: s.id,
          disciplina: s.disciplinaNome,
          observacao: (s.observacoes ?? '').trim(),
          dataIso: dataSessao,
          dataLabel: this.formatDataHora(dataSessao),
        };
        })
        .filter((n) => !!n.observacao)
        .sort((a, b) => Date.parse(b.dataIso) - Date.parse(a.dataIso));

      this.observacoesMateria = notas;
      this.cdr.detectChanges();
    });
  }

  private formatDataHora(iso?: string | null): string {
    if (!iso) return 'Sem data';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Sem data';

    // Exibição fixa no card: dd/MM
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

}
