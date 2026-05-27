import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { EstudoApiService } from '../../data/estudo-api.service';
import { SESSAO_CATEGORIAS_ESTUDO, type SessaoTopicoOpcaoDto } from '../../data/estudo.models';

@Component({
  selector: 'app-registro-estudo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro-estudo-modal.html',
  styleUrl: './registro-estudo-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroEstudoModalComponent implements OnChanges {
  private readonly api = inject(EstudoApiService);
  private readonly toast = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  /** Sessão (lista de tópicos +, fora do histórico, dados da sessão). */
  @Input() sessaoId: number | null = null;
  /**
   * Quando definido, edita o segmento existente (evento) — mesmo tempo que a linha do histórico;
   * não chama definirTopicoSessao (evita duplicar linhas).
   */
  @Input() segmentoId: number | null = null;
  @Input() titulo = 'Registro de estudo';

  @Output() openChange = new EventEmitter<boolean>();
  @Output() gravado = new EventEmitter<void>();

  readonly categorias = SESSAO_CATEGORIAS_ESTUDO;

  topicosOpcoes: SessaoTopicoOpcaoDto[] = [];
  carregando = false;
  gravando = false;

  categoriaCodigo = '';
  topicoId: number | null = null;
  tempoTexto = '00:00:00';
  comentarios = '';

  get edicaoSegmentoHistorico(): boolean {
    const sid = this.segmentoId;
    return sid != null && sid > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.open || this.sessaoId == null || this.sessaoId <= 0) {
      return;
    }
    if (changes['open'] || changes['sessaoId'] || changes['segmentoId']) {
      void this.carregarFormulario();
    }
  }

  fechar(): void {
    this.openChange.emit(false);
  }

  salvar(): void {
    const sid = this.sessaoId;
    if (sid == null || sid <= 0) {
      this.toast.warning('Sessão inválida.');
      return;
    }
    if (this.topicoId == null || this.topicoId <= 0) {
      this.toast.warning('Selecione um tópico.');
      return;
    }
    const segundos = RegistroEstudoModalComponent.parseHhMmSs(this.tempoTexto);
    if (segundos == null) {
      this.toast.warning('Tempo inválido. Use HH:MM:SS (ex.: 00:45:00).');
      return;
    }

    const segId = this.segmentoId;
    if (segId != null && segId > 0) {
      this.gravarSegmento(segId, segundos);
      return;
    }

    this.gravarSessao(sid, segundos);
  }

  private gravarSegmento(eventoId: number, duracaoSegundos: number): void {
    const cat = this.categoriaCodigo?.trim() ? this.categoriaCodigo.trim().toUpperCase() : null;
    this.gravando = true;
    this.cdr.markForCheck();
    this.api
      .atualizarSegmentoEstudo1(eventoId, {
        topicoId: this.topicoId as number,
        categoriaEstudo: cat,
        duracaoSegundos,
        observacoes: this.comentarios ?? '',
      })
      .then(() => this.finalizarSucesso())
      .catch(() => {
        this.gravando = false;
        this.cdr.markForCheck();
        this.toast.error('Não foi possível guardar o registo do segmento.');
      });
  }

  private gravarSessao(sid: number, segundos: number): void {
    void this.executarGravarSessao(sid, segundos);
  }

  private async executarGravarSessao(sid: number, segundos: number): Promise<void> {
    this.gravando = true;
    this.cdr.markForCheck();
    const cat = this.categoriaCodigo?.trim() ? this.categoriaCodigo.trim().toUpperCase() : null;
    try {
      // Sequencial: evita deadlock em MySQL (vários POSTs em paralelo na mesma sessão/eventos).
      await firstValueFrom(this.api.definirTopicoSessao(sid, this.topicoId));
      await firstValueFrom(this.api.definirCategoriaSessao(sid, cat));
      await firstValueFrom(this.api.atualizarObservacoes(sid, this.comentarios ?? ''));
      const s = await this.api.getSessao1(sid);
      const precisaTempo =
        segundos !== (s.estudadoTotalSeg ?? 0) && s.pausadoEm != null && s.fim == null;
      if (precisaTempo) {
        try {
          await firstValueFrom(this.api.pausarSessao(sid, segundos));
        } catch {
          this.gravando = false;
          this.cdr.markForCheck();
          this.toast.error('Não foi possível sincronizar o tempo (sessão deve estar pausada).');
          return;
        }
      } else if (segundos !== (s.estudadoTotalSeg ?? 0) && s.pausadoEm == null) {
        this.toast.info(
          'Tópico, categoria e comentários guardados. Para ajustar o tempo na API, pause a sessão e guarde de novo.',
        );
      }
      this.finalizarSucesso();
    } catch {
      this.gravando = false;
      this.cdr.markForCheck();
      this.toast.error('Não foi possível guardar o registo.');
    }
  }

  private finalizarSucesso(): void {
    this.gravando = false;
    this.cdr.markForCheck();
    this.toast.success('Registo guardado.');
    this.openChange.emit(false);
    this.gravado.emit();
  }

  private async carregarFormulario(): Promise<void> {
    const sid = this.sessaoId;
    if (sid == null || sid <= 0) {
      return;
    }
    this.carregando = true;
    this.cdr.markForCheck();
    try {
      const topicos = await this.api.getTopicosSessao1(sid);
      this.topicosOpcoes = topicos ?? [];

      const evId = this.segmentoId;
      if (evId != null && evId > 0) {
        const seg = await this.api.getSegmentoEstudo1(evId);
        this.topicoId = seg.topicoId ?? null;
        this.categoriaCodigo = seg.categoriaEstudoCodigo ?? '';
        this.comentarios = seg.observacoes ?? '';
        const dur = Math.max(0, Math.floor(Number(seg.duracaoSegundos ?? 0)));
        this.tempoTexto = RegistroEstudoModalComponent.segundosParaHhMmSs(dur);
      } else {
        const sessao = await this.api.getSessao1(sid);
        this.topicoId = sessao.topicoId ?? null;
        this.categoriaCodigo = sessao.categoriaEstudo ?? '';
        this.comentarios = sessao.observacoes ?? '';
        const seg = Math.max(0, Math.floor(Number(sessao.estudadoTotalSeg ?? 0)));
        this.tempoTexto = RegistroEstudoModalComponent.segundosParaHhMmSs(seg);
      }
    } catch {
      this.toast.error('Não foi possível carregar os dados para o registo.');
      this.fechar();
    } finally {
      this.carregando = false;
      this.cdr.markForCheck();
    }
  }

  static segundosParaHhMmSs(seg: number): string {
    const s = Math.max(0, Math.floor(seg));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  static parseHhMmSs(raw: string): number | null {
    const t = String(raw ?? '').trim();
    const parts = t.split(':').map((p) => Number(String(p).trim()));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
      return null;
    }
    const [hh, mm, ss] = parts;
    if (mm >= 60 || ss >= 60) {
      return null;
    }
    return Math.floor(hh) * 3600 + Math.floor(mm) * 60 + Math.floor(ss);
  }
}
