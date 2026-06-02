/**
 * DTOs de Configuração e Ciclo
 */
export interface ProximaSessaoDto {
  cicloId: number;
  cicloNome: string;
  cicloItemId: number;
  ordem: number;
  disciplinaId: number;
  disciplinaNome: string;
  tempoMinutos: number;
  estudoLivre?: boolean;
}

export interface ProgressoDisciplinaDto {
  disciplinaId: number;
  disciplinaNome: string;
  minutosFeitos: number;
  minutosMeta: number;
  percentual: number;
}

/** Resposta agregada: mesmo critério que progresso + recentes, uma carga no servidor. */
export interface ProgressoRecentesRodadaDto {
  progresso: ProgressoDisciplinaDto[];
  recentes: SessaoCardDto[];
}

/**
 * Objetos de Requisição (Payloads)
 */
export interface IniciarSessaoRequest {
  /** Opcional; se omitido, o servidor escolhe a próxima matéria do ciclo. */
  cicloItemId?: number;
}

export interface FinalizarSessaoRequest {
  id: number;
  concluido: boolean;
  observacoes?: string;
}

export interface AtualizarObservacoesRequest {
  observacoes: string;
}

/**
 * Detalhes e Cards de Sessão
 */
export interface SessaoDetalheDto {
  id: number;
  cicloId: number;
  cicloNome: string;
  cicloItemId: number;
  ordem: number;
  disciplinaId: number;
  disciplinaNome: string;
  tempoMinutos: number;

  inicio: string;
  fim: string | null;
  pausadoEm: string | null;
  pausadoTotalSeg: number;
  estudadoTotalSeg: number;

  concluido: boolean | null;
  observacoes: string | null;

  // Configurações de Pomodoro
  pomodoroAtivo: boolean;
  pomodoroFocoMin: number;
  pomodoroPausaCurtaMin: number;
  pomodoroPausaLongaMin: number;
  pomodoroLongaACada: number;

  /** Vindo da API; antes da sincronização pode estar ausente em respostas antigas. */
  pomodoroModo: 'FOCO' | 'PAUSA_CURTA' | 'PAUSA_LONGA' | null;
  pomodoroCicloIndex: number;
  pomodoroEtapaInicio: string | null;
  pomodoroRestanteSeg: number;

  /** Tópico do edital em estudo (quando definido). */
  topicoId?: number | null;
  topicoTitulo?: string | null;

  /** Código da categoria (ex.: TEORIA); opcional. */
  categoriaEstudo?: string | null;
  /** Rótulo amigável (ex.: Teoria). */
  categoriaEstudoLabel?: string | null;

  /** Sessão de Estudo Livre (bloco reservado no ciclo). */
  estudoLivre?: boolean;
}

/** Tópico/categoria enviados ao iniciar ou retomar (não na seleção do select). */
export interface SessaoMetaEstudoRequest {
  topicoId?: number | null;
  categoriaEstudo?: string | null;
}

/** Opções fixas de categoria de estudo na sessão (alinhadas ao enum Java). */
export const SESSAO_CATEGORIAS_ESTUDO: ReadonlyArray<{ codigo: string; label: string }> = [
  { codigo: 'TEORIA', label: 'Teoria' },
  { codigo: 'REVISAO', label: 'Revisão' },
  { codigo: 'QUESTOES', label: 'Questões' },
  { codigo: 'LEITURA_LEI', label: 'Leitura de Lei' },
  { codigo: 'JURISPRUDENCIA', label: 'Jurisprudência' },
];

/** Opção de tópico do edital na disciplina da sessão (título pode incluir indentação). */
export interface SessaoTopicoOpcaoDto {
  id: number;
  titulo: string;
}

export interface SessaoCardDto {
  id: number;
  disciplinaId?: number;
  disciplinaNome: string;
  metaMinutos: number;
  /** null se a sessão foi só reservada (iniciar) e o cronómetro nunca foi iniciado (comecar). */
  inicio: string | null;
  fim: string | null;
  pausadoEm: string | null;
  pausadoTotalSeg: number;
  segundosEstudados: number;
  segundosRestantes: number;
  status: 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA';
  estudadoTotalSeg: number;
  /** Ordem da matéria no ciclo (CicloItem.ordem). */
  ordemNoCiclo?: number | null;
}

export interface SessaoResumoDto {
  id: number;
  disciplinaNome: string;
  inicio: string;
  fim: string;
  concluido: boolean;
  minutosEfetivos: number;
}

/** Resumo global da disciplina no cargo do ciclo. `totalSessoes` = número de segmentos (linhas com tópico no histórico). */
export interface DisciplinaHistoricoResumoDto {
  disciplinaId: number;
  disciplinaNome: string;
  totalSessoes: number;
  totalEstudadoSeg: number;
}

/** Linha de segmento no histórico (intervalo tópico+categoria). `id` = evento SESSAO, não a sessão. */
export interface DisciplinaHistoricoSessaoDto {
  id: number;
  /** Id da sessão de estudo (para API de tópico/categoria/observações). */
  sessaoEstudoId?: number | null;
  topicoId?: number | null;
  categoriaEstudoCodigo?: string | null;
  cicloId: number | null;
  cicloNome: string;
  /** Posição da matéria no ciclo (CicloItem.ordem), como em Últimas Sessões. */
  ordemNoCiclo?: number | null;
  inicio: string | null;
  fim: string | null;
  /** Duração deste segmento (segundos), não o total da sessão inteira. */
  estudadoTotalSeg: number;
  status: string;
  temObservacoes: boolean;
  metaMinutosPlanejados: number | null;
  /** Título do tópico do edital registado na sessão, quando existir. */
  topicoTitulo?: string | null;
  /** Tipo de estudo (Teoria, Revisão, …), quando definido. */
  categoriaEstudoLabel?: string | null;
}

/** Dados de um segmento (evento) para o modal de registo — alinhado ao histórico por disciplina. */
export interface SegmentoEstudoRegistroDto {
  id: number;
  sessaoEstudoId: number;
  topicoId: number | null;
  categoriaEstudoCodigo: string | null;
  duracaoSegundos: number;
  observacoes: string | null;
}

/** Página Spring Data (serialização JSON padrão). */
export interface SpringDataPageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
