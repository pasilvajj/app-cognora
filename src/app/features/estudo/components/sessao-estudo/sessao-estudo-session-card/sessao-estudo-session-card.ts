import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ObservacoesEditor } from '../../observacoes-editor/observacoes-editor';
import { PomodoroTimer } from '../../pomodoro-timer/pomodoro-timer';
import { TimerDisplay } from '../../timer-display/timer-display';
import { SessionTimerService } from '../../../services/session-timer-service';
import { SESSAO_CATEGORIAS_ESTUDO, type SessaoTopicoOpcaoDto } from '../../../data/estudo.models';

@Component({
  selector: 'app-sessao-estudo-session-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PomodoroTimer, TimerDisplay, ObservacoesEditor],
  templateUrl: './sessao-estudo-session-card.html',
  styleUrl: './sessao-estudo-session-card.css',
})
export class SessaoEstudoSessionCard {
  readonly timer = inject(SessionTimerService);

  disciplinaNome = input.required<string>();
  tempoPlanejado = input.required<string>();
  statusLabel = input.required<string>();
  pomodoroEnabled = input(false);
  pomodoroTemporariamenteDesativado = input(false);
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
  pomodoroSkipStage = output<void>();
  pomodoroToggleEnabled = output<void>();
  observacoesChange = output<string>();
  observacoesSaveRequest = output<string>();
  topicoChange = output<number | null>();
  categoriaChange = output<string | null>();

  /** Opções fixas (Teoria, Revisão, …). */
  readonly categoriasEstudo = SESSAO_CATEGORIAS_ESTUDO;

  /** Valor ligado ao select (string) — evita desincronização com [value] e opções assíncronas. */
  readonly topicoSelectModel = computed(() => {
    const id = this.topicoId();
    return id != null && Number.isFinite(Number(id)) ? String(id) : '';
  });

  readonly categoriaSelectModel = computed(() => this.categoriaEstudo() ?? '');

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
