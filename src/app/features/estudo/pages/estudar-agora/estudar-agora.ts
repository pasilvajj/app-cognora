import { Component,OnInit,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { CicloDto } from '../../../ciclos/data/ciclos.models'; // ajuste para seu tipo real
import { CiclosApiService,CicloMateriaDto } from '../../../ciclos/data/ciclos-api.service';
import { UltimasSessoesCard, RecentSession } from '../../components/ultimas-sessoes-card/ultimas-sessoes-card';
import { EstudoApiService, ProximaSessaoDto,ProgressoDisciplinaDto} from '../../data/estudo-api.service';
import { EscolherMateriaModalCircular, CicloItemView } from '../../components/escolher-materia-modal-circular/escolher-materia-modal-circular';
import { TempoFormatUtil } from '../../../../shared/utils/tempo-format.util';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';

type ProgressItem = {
  disciplina: string;
  percent: number; // 0..100proxima
};
@Component({
  selector: 'app-estudar-agora',
  imports: [CommonModule, UltimasSessoesCard, EscolherMateriaModalCircular,AppButtonComponent],
  templateUrl: './estudar-agora.html',
  styleUrl: './estudar-agora.css',
})
export class EstudarAgora implements OnInit{

  cicloId = 1;
  private usuarioId!: number;

  loading = true;

  // recomendado pelo backend (ordem do ciclo)
  proximaSessaoDto?: ProximaSessaoDto;
  tempoPlanejadoLabel = '';

  // ciclo completo (itens do ciclo) para o modal listar
  ciclo?: CicloDto;
  selecionadoCicloItemId?:number;

  // itens para o modal (shape simples)
  itens: CicloItemView[] = [];

  // item selecionado (override). Por padrão = recomendado
  selecionado?: CicloItemView;

  // controla abertura do modal
  modalOpen = false;



  progress: ProgressItem[] = [];
  recentSessions: RecentSession[] = [];

 constructor(
    private ciclosApi: CiclosApiService,
    private estudoApi: EstudoApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

   // Dinâmicos


    ngOnInit(): void {
     
    const user = this.auth.getUser();

    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.usuarioId = user.id;

    this.loading = true;
    const idRaw = this.route.snapshot.paramMap.get('cicloId');
    const id = idRaw ? Number(idRaw) : NaN;

    if (!id || Number.isNaN(id)) {
        console.error('cicloId inválido na rota:', idRaw);
            // opção: voltar para /ciclos
          this.router.navigate(['/ciclos']);
          return;
     }

    this.cicloId = id;

    // 1) recomendado
    this.estudoApi.getProximaSessao(this.cicloId).subscribe({
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
  
    //Preenche Lista de escolher materia
    // 2) ciclo completo (para listar itens e permitir escolha)
   this.ciclosApi.getCiclo(this.cicloId).pipe(finalize(() => (this.loading = false)))
      .subscribe({
    next: (c: any) => {
      this.ciclo = c;
      const lista = c?.itens ?? c?.items ?? [];
      this.itens = lista.map((i: any) => ({
        cicloItemId: i.id,                 
        ordem: i.ordem,
        disciplinaNome: i.disciplinaNome,
        tempoMinutos: i.tempoMinutos,
      }));

      // opcional: se ainda não tem selecionado, mantém o recomendado
      if (!this.selecionado && this.proximaSessaoDto) {
        this.selecionado = {
          cicloItemId: this.proximaSessaoDto.cicloItemId,
          ordem: this.proximaSessaoDto.ordem,
          disciplinaNome: this.proximaSessaoDto.disciplinaNome,
          tempoMinutos: this.proximaSessaoDto.tempoMinutos,
        };
      }
    },
    error: (e) => console.error('Erro ciclo', e),

 
  });
  this.estudoApi.getProgressoCiclo(this.cicloId, this.usuarioId).subscribe({
      next: (list: ProgressoDisciplinaDto[]) => {
        this.progress = list.map((p) => ({
          disciplina: p.disciplinaNome,
          percent: p.percentual ?? 0,
        }));
        this.cdr.detectChanges();
      },
      error: (e) => console.error('Erro progresso ciclo', e),
    });

     // 4) Últimas sessões (dinâmico)
this.estudoApi.getSessoesRecentes(this.usuarioId, this.cicloId, 10).subscribe({
  next: (list) => {
    console.log('recentSessions: ', list);
    this.recentSessions = list.map((s) => {
      // Fonte da verdade agora: estudadoTotalSeg (persistido no backend)
      const estudadoSeg =
        (s.estudadoTotalSeg ?? null) !== null
          ? Number(s.estudadoTotalSeg)
          : Number(s.segundosEstudados ?? 0);

      const restanteSeg = Math.max(0, Number(s.segundosRestantes ?? 0));

      // Label de data: usa "fim" se existir; senão "inicio"; se nem isso existir, fallback
      const baseDate = s.fim ?? s.inicio ?? null;
      return {
        sessaoId: s.id,
        label: baseDate ? this.formatLabelFromFimOrInicio(baseDate) : '—',
        disciplina: s.disciplinaNome,
        studiedLabel: this.formatSeconds(estudadoSeg),
        remainingLabel: s.fim ? undefined : this.formatSeconds(restanteSeg),
        status: s.status, // pode vir PRONTA agora
        estudadoTotalSeg: s.estudadoTotalSeg,
      };
    });

    this.cdr.detectChanges();
  },
  error: (e) => console.error('Erro sessões recentes', e),
});
this.cdr.detectChanges();
  }
  
  iniciarEstudo(): void {
   if (!this.proximaSessaoDto) return;

    this.estudoApi.iniciarSessao({
      usuarioId: this.usuarioId,
      cicloId: this.proximaSessaoDto.cicloId,
      cicloItemId: this.proximaSessaoDto.cicloItemId
    }).subscribe({
     next: (sessao) => {
   
    const id = (sessao as any)?.id;
    if (!id || typeof id !== 'number') {
      console.error('iniciarSessao retornou sem id. Não é possível navegar.', sessao);
      return;
    }
    this.router.navigate(['/estudo/sessao', id]);
  },
      error: (e) => console.error('Erro ao iniciar sessão', e),
    });
    
  }

  private carregarMateriasDoCiclo(): void {
  this.ciclosApi.getMateriasCiclo(this.cicloId, this.usuarioId).subscribe({
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
    console.log('items 2: ',this.itens)

      // opcional: seleciona recomendado se você tiver
      if (!this.selecionado && this.proximaSessaoDto) {
        const found = this.itens.find(i => i.cicloItemId === this.proximaSessaoDto!.cicloItemId);
        if (found) this.selecionado = found;
      }

      this.cdr.detectChanges();
    },
    error: (e) => console.error('Erro ao carregar matérias do ciclo', e),
  });
}

onStartSession(item: CicloItemView): void {
  this.modalOpen = false;

  this.estudoApi.iniciarSessao({
    usuarioId: this.usuarioId,
    cicloId: this.cicloId,
    cicloItemId: item.cicloItemId,
  }).subscribe({
    next: (sessao) => {
      const id = (sessao as any)?.id;
      if (!id || typeof id !== 'number') {
        console.error('iniciarSessao retornou sem id. Não é possível navegar.', sessao);
        return;
      }
      this.router.navigate(['/estudo/sessao', id]);
    },
    error: (e) => console.error('Erro ao iniciar/retomar sessão', e),
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
