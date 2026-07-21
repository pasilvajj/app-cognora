import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ObservacoesEditor } from '../../observacoes-editor/observacoes-editor';
import { TimerDisplay } from '../../timer-display/timer-display';
import { SessionTimerService } from '../../../services/session-timer-service';
import { SESSAO_CATEGORIAS_ESTUDO, type SessaoTopicoOpcaoDto } from '../../../data/estudo.models';
import { ESTUDO_LIVRE_MENSAGEM } from '../../../../ciclos/constants/estudo-livre.constants';
import { TempoRelogioPipe } from '../../../../../shared/pipes/tempo-relogio-pipe';
import { PomodoroEngineService } from '../../../services/pomodoro-engine-service';

interface PomodoroStageVm {
  key: string;
  label: string;
  icon: string;
  intervalo: string;
  concluida: boolean;
  ativa: boolean;
  progresso: number;
}

interface TimelineMarkVm {
  label: string;
  percentual: number;
}

@Component({
  selector: 'app-sessao-estudo-session-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TimerDisplay, ObservacoesEditor],
  templateUrl: './sessao-estudo-session-card.html',
  styleUrl: './sessao-estudo-session-card.css',
})
export class SessaoEstudoSessionCard {
  readonly timer = inject(SessionTimerService);
  readonly pomodoro = inject(PomodoroEngineService);
  private readonly tempoPipe = new TempoRelogioPipe();

  disciplinaNome = input.required<string>();
  estudoLivre = input(false);
  tempoPlanejado = input.required<string>();
  statusLabel = input.required<string>();
  pomodoroEnabled = input(false);
  pomodoroFocoMin = input(25);
  pomodoroPausaCurtaMin = input(5);
  pomodoroPausaLongaMin = input(15);
  pomodoroLongaACada = input(4);
  observacoes = input.required<string>();
  acaoLoading = input(false);
  retomarBloqueadoNaPausaCurta = input(false);

  /** Tópicos do edital da disciplina (lista achatada). */
  topicosOpcoes = input<SessaoTopicoOpcaoDto[]>([]);
  topicoId = input<number | null>(null);
  topicoSelectDisabled = input(false);
  /** Bloqueia tópico e categoria enquanto grava qualquer um dos dois. */
  metaSaving = input(false);

  /** Código da categoria (ex.: TEORIA), alinhado ao backend. */
  categoriaEstudo = input<string | null>(null);
  categoriaSelectDisabled = input(false);

  mainActionClick = output<void>();
  modoFocoOpen = output<void>();
  observacoesChange = output<string>();
  observacoesSaveRequest = output<string>();
  topicoChange = output<number | null>();
  categoriaChange = output<string | null>();

  /** Opções fixas (Teoria, Revisão, …). */
  readonly categoriasEstudo = SESSAO_CATEGORIAS_ESTUDO;

  readonly estudoLivreMensagem = ESTUDO_LIVRE_MENSAGEM;

  /** Valor ligado ao select (string) — evita desincronização com [value] e opções assíncronas. */
  readonly topicoSelectModel = computed(() => {
    const id = this.topicoId();
    return id != null && Number.isFinite(Number(id)) ? String(id) : '';
  });

  readonly categoriaSelectModel = computed(() => this.categoriaEstudo() ?? '');

  readonly progressoPercentual = computed(() => {
    const meta = this.timer.metaMs();
    if (meta <= 0) return 0;
    return Math.min(100, Math.max(0, (this.timer.decorridoMs() / meta) * 100));
  });

  readonly metaFormatada = computed(() => this.tempoPipe.transform(this.timer.metaMs()));
  readonly restanteSessaoFormatado = computed(() => {
    const metaSeg = Math.floor(this.timer.metaMs() / 1000);
    const decorridoSeg = Math.floor(this.timer.decorridoMs() / 1000);
    const restanteSeg = Math.max(0, metaSeg - decorridoSeg);
    return this.tempoPipe.transform(restanteSeg * 1000, 'floor');
  });

  readonly timelineMarks = computed<TimelineMarkVm[]>(() => {
    const metaMs = Math.max(0, this.timer.metaMs());
    const metaMinutos = metaMs / 60_000;
    if (metaMinutos <= 0) {
      return [{ label: '00:00', percentual: 0 }];
    }

    const passosMinutos = [1, 2, 5, 10, 15, 30, 45, 60, 90, 120];
    const passoAlvo = metaMinutos / 5;
    const passo = passosMinutos.find((valor) => valor >= passoAlvo) ?? Math.ceil(passoAlvo / 60) * 60;
    const marcas: TimelineMarkVm[] = [];

    for (let minuto = 0; minuto <= metaMinutos; minuto += passo) {
      marcas.push({
        label: this.formatarTempoEscala(minuto * 60_000),
        percentual: (minuto / metaMinutos) * 100,
      });
    }

    const ultima = marcas.at(-1);
    if (!ultima || ultima.percentual < 100) {
      marcas.push({ label: this.formatarTempoEscala(metaMs), percentual: 100 });
    }
    return marcas;
  });

  readonly timelineMinorTicks = computed<number[]>(() => {
    const marcas = this.timelineMarks();
    const tracos: number[] = [];
    const subdivisoesPorIntervalo = 10;

    for (let indice = 0; indice < marcas.length - 1; indice++) {
      const inicio = marcas[indice].percentual;
      const fim = marcas[indice + 1].percentual;
      for (let subdivisao = 1; subdivisao < subdivisoesPorIntervalo; subdivisao++) {
        tracos.push(inicio + ((fim - inicio) * subdivisao) / subdivisoesPorIntervalo);
      }
    }
    return tracos;
  });

  readonly pomodoroStages = computed<PomodoroStageVm[]>(() => {
    const totalCiclos = Math.max(1, this.pomodoro.totalCiclos());
    const cicloAtual = Math.min(totalCiclos, Math.max(1, this.pomodoro.cicloAtual()));
    const modoFoco = this.pomodoro.isFocusMode();
    const restanteAtualSeg = Math.max(0, Math.floor(this.pomodoro.remainingMs() / 1000));
    const stages: PomodoroStageVm[] = [];
    let inicioMin = 0;

    for (let ciclo = 1; ciclo <= totalCiclos; ciclo++) {
      const focoMin = Math.max(1, this.pomodoroFocoMin());
      const focoAtivo = ciclo === cicloAtual && modoFoco;
      const focoProgresso = focoAtivo
        ? this.percentualEtapa(focoMin * 60, restanteAtualSeg)
        : ciclo < cicloAtual || (ciclo === cicloAtual && !modoFoco) ? 100 : 0;
      stages.push({
        key: `foco-${ciclo}`,
        label: `FOCO ${ciclo}`,
        icon: String(ciclo),
        intervalo: this.intervaloPomodoro(inicioMin, focoMin),
        concluida: ciclo < cicloAtual || (ciclo === cicloAtual && !modoFoco),
        ativa: focoAtivo,
        progresso: focoProgresso,
      });
      inicioMin += focoMin;

      // A meta acadêmica contabiliza somente foco. Não há pausa visual após o último foco.
      if (ciclo >= totalCiclos) {
        continue;
      }

      const longaACada = Math.max(1, this.pomodoroLongaACada());
      const pausaLonga = ciclo % longaACada === 0;
      const pausaMin = Math.max(1, pausaLonga ? this.pomodoroPausaLongaMin() : this.pomodoroPausaCurtaMin());
      const pausaAtiva = ciclo === cicloAtual && !modoFoco;
      const pausaProgresso = pausaAtiva
        ? this.percentualEtapa(pausaMin * 60, restanteAtualSeg)
        : ciclo < cicloAtual ? 100 : 0;
      stages.push({
        key: `pausa-${ciclo}`,
        label: 'PAUSA',
        icon: '☕',
        intervalo: this.formatarTempoEscala(pausaMin * 60_000),
        concluida: ciclo < cicloAtual,
        ativa: pausaAtiva,
        progresso: pausaProgresso,
      });
    }

    return stages;
  });

  readonly pomodoroProgressoPercentual = computed(() => {
    const stages = this.pomodoroStages();
    if (stages.length === 0) return 0;
    if (this.pomodoro.finished()) return 100;
    const indiceAtivo = stages.findIndex((stage) => stage.ativa);
    if (indiceAtivo < 0) return 0;
    const segmentos = Math.max(1, stages.length - 1);
    return Math.min(100, ((indiceAtivo + (stages[indiceAtivo].progresso / 100)) / segmentos) * 100);
  });

  private percentualEtapa(duracaoSeg: number, restanteSeg: number): number {
    if (duracaoSeg <= 0) return 0;
    return Math.min(100, Math.max(0, ((duracaoSeg - restanteSeg) / duracaoSeg) * 100));
  }

  private intervaloPomodoro(inicioMin: number, duracaoMin: number): string {
    return `${this.formatarTempoEscala(inicioMin * 60_000)} – ${this.formatarTempoEscala((inicioMin + duracaoMin) * 60_000)}`;
  }

  private formatarTempoEscala(tempoMs: number): string {
    const totalSegundos = Math.max(0, Math.round(tempoMs / 1000));
    const totalMinutos = Math.floor(totalSegundos / 60);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
  }

  onTopicoNgModel(v: string | null): void {
    const raw = v ?? '';
    const parsed = raw === '' ? null : Number(raw);
    if (raw !== '' && !Number.isFinite(parsed)) {
      return;
    }
    const cur = this.topicoId();
    if (cur === parsed || (cur == null && parsed == null)) {
      return;
    }
    // Com o relógio a correr, PATCH com topicoId nulo no servidor fechava o segmento com "agora"
    // e o reenvio do tópico criava linha de segundos no histórico. Limpar tópico: pause a sessão.
    if (parsed == null && !this.timer.pausada()) {
      return;
    }
    this.topicoChange.emit(parsed);
  }

  onCategoriaNgModel(v: string | null): void {
    const code = v == null || v === '' ? null : v;
    const cur = this.categoriaEstudo() ?? null;
    if (cur === code || (cur == null && code == null)) {
      return;
    }
    this.categoriaChange.emit(code);
  }
}
