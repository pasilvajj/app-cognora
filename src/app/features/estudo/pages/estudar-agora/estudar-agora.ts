import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { delay, finalize, map } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { CicloMateriaDto, CiclosApiService } from '../../../ciclos/data/ciclos-api.service';
import { CicloDto } from '../../../ciclos/data/ciclos.models'; // ajuste para seu tipo real
import { CicloItemView, EscolherMateriaModalCircular } from '../../components/escolher-materia-modal-circular/escolher-materia-modal-circular';
import { RecentSession, UltimasSessoesCard } from '../../components/ultimas-sessoes-card/ultimas-sessoes-card';
import { EstudoApiService, } from '../../data/estudo-api.service';
import { ProgressoDisciplinaDto, ProximaSessaoDto, SessaoCardDto } from '../../data/estudo.models';


type ProgressItem = {
  disciplina: string;
  percent: number; // 0..100proxima
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
      .pipe(
        map(sessoes => sessoes.map(s => this.mapSessaoParaCard(s)))
      )
      .subscribe({
        next: (list) => {
          this.recentSessions = list;
        },
        error: (e) => this.toastr.error('Erro ao carregar sessões recentes')
      });
  }

  private mapSessaoParaCard(s: SessaoCardDto) {
    const estudadoSeg = Number(s.estudadoTotalSeg ?? s.segundosEstudados ?? 0);
    const restanteSeg = Math.max(0, Number(s.segundosRestantes ?? 0));
    const baseDate = s.fim ?? s.inicio;
    const statusNormalizado = this.normalizarStatusSessao(s.status, estudadoSeg, restanteSeg);

    return {
      sessaoId: s.id,
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
      percent: this.normalizarPercentualProgresso(p),
    }));
    this.cdr.detectChanges();
  }

  private normalizarPercentualProgresso(p: ProgressoDisciplinaDto): number {
    const obj = p as unknown as Record<string, unknown>;
    const feitos =
      this.lerNumeroFlexivel(obj['minutosFeitos']) ??
      this.lerNumeroFlexivel(obj['minutosEstudados']) ??
      this.lerNumeroFlexivel(obj['minFeitos']) ??
      this.lerNumeroFlexivel(obj['feitoMin']) ??
      0;
    const metaDto =
      this.lerNumeroFlexivel(obj['minutosMeta']) ??
      this.lerNumeroFlexivel(obj['metaMinutos']) ??
      this.lerNumeroFlexivel(obj['minMeta']) ??
      this.lerNumeroFlexivel(obj['metaMin']) ??
      0;
    const meta = metaDto > 0 ? metaDto : this.obterMetaDaDisciplina(p.disciplinaNome);
    const percentualRaw =
      this.lerNumeroFlexivel(obj['percentual']) ??
      this.lerNumeroFlexivel(obj['percent']) ??
      this.lerNumeroFlexivel(obj['porcentagem']) ??
      this.lerNumeroFlexivel(obj['percentualConcluido']) ??
      this.lerNumeroFlexivel(obj['progressoPercentual']) ??
      0;

    const percentualCalculado = meta > 0 ? (Math.max(0, feitos) / Math.max(0, meta)) * 100 : 0;
    let percentual = percentualCalculado;

    // Fallback: se não conseguir calcular por feitos/meta, tenta valor percentual bruto.
    if ((!Number.isFinite(percentual) || percentual <= 0) && Number.isFinite(percentualRaw) && percentualRaw > 0) {
      percentual = percentualRaw > 0 && percentualRaw <= 1 ? percentualRaw * 100 : percentualRaw;
    }

    const clamped = Math.max(0, Math.min(100, percentual));
    return clamped < 10 ? Math.round(clamped * 10) / 10 : Math.round(clamped);
  }

  private obterMetaDaDisciplina(disciplinaNome: string): number {
    const key = this.normalizarNome(disciplinaNome);
    if (!key) return 0;
    const item = this.itens.find((i) => this.normalizarNome(i.disciplinaNome) === key);
    const meta = Number(item?.tempoMinutos ?? 0);
    return Number.isFinite(meta) && meta > 0 ? meta : 0;
  }

  private normalizarNome(nome: string): string {
    return String(nome ?? '').trim().toLowerCase();
  }

  formatPercent(value: number): string {
    if (!Number.isFinite(value)) return '0%';
    return value < 10 && value > 0 ? `${value.toFixed(1)}%` : `${Math.round(value)}%`;
  }

  private lerNumeroFlexivel(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;

    const raw = value.trim();
    if (!raw) return null;

    // Formato tempo HH:MM[:SS] -> converte para minutos decimais.
    if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(raw)) {
      const parts = raw.split(':').map(Number);
      if (parts.length === 2) {
        const [h, m] = parts;
        return h * 60 + m;
      }
      const [h, m, s] = parts;
      return h * 60 + m + (s / 60);
    }

    // Suporta "12,5", "12.5", "12%", etc.
    const normalized = raw.replace('%', '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }


  iniciarEstudo(): void {
    if (!this.proximaSessaoDto) {
      return;
    }
    this.executarInicioDeSessao(this.proximaSessaoDto.cicloItemId);
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
            concluida: m.concluida,
          }));
          // opcional: seleciona recomendado se você tiver
          if (!this.selecionado && this.proximaSessaoDto) {
            const found = this.itens.find(i => i.cicloItemId === this.proximaSessaoDto!.cicloItemId);
            if (found) this.selecionado = found;
          }
          this.recalcularProgresso();
          this.cdr.detectChanges();
        },
        error: (e) => console.error('Erro ao carregar matérias do ciclo', e),
      });
  }

  onStartSession(item: CicloItemView): void {
    this.modalOpen = false;
    this.executarInicioDeSessao(item.cicloItemId);
  }

  private executarInicioDeSessao(cicloItemId: number): void {
    if (this.isProcessando()) return;

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

}
