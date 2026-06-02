/** Reserva fixa de Estudo Livre em todo ciclo (4 blocos × 1h dentro da carga semanal). */
export const ESTUDO_LIVRE_HORAS = 4;
export const ESTUDO_LIVRE_NOME = 'Estudo Livre';

/** Piso semanal quando há até 5 matérias activas. */
export const MIN_HORAS_POR_MATERIA = 2.5;
/** Piso semanal com 6 matérias activas. */
export const MIN_HORAS_6_MATERIAS = 2;
/** Piso semanal com 7 ou mais matérias activas (1 sessão). */
export const MIN_HORAS_7_OU_MAIS = 1.5;

/** Granularidade da distribuição semanal (blocos de 30 min). */
export const STEP_DISTRIBUICAO_MINUTOS = 30;
/** Duração mínima de uma sessão de matéria (1:30h) — mantida quando a carga semanal da matéria é &lt; 2h. */
export const SESSAO_MINIMA_MINUTOS = 90;
/** Duração padrão de cada sessão de matéria no ciclo (2h; alinhado ao backend). */
export const BLOCO_SESSAO_MINUTOS = 120;

/** Piso mínimo semanal (minutos) conforme o número de matérias activas. */
export function pisoMinutosPorContagemMaterias(nAtivas: number): number {
  if (nAtivas <= 5) return MIN_HORAS_POR_MATERIA * 60;
  if (nAtivas === 6) return MIN_HORAS_6_MATERIAS * 60;
  return MIN_HORAS_7_OU_MAIS * 60;
}

export function pisoHorasPorContagemMaterias(nAtivas: number): number {
  return pisoMinutosPorContagemMaterias(nAtivas) / 60;
}

export const ESTUDO_LIVRE_MENSAGEM =
  'Utilize este horário para estudar da forma que desejar! Revise conteúdos que você sente necessidade. ' +
  'Faça uma redação, progrida em alguma matéria, corrija questões, passe seu caderno a limpo. ' +
  'Faça como você quiser e desejar! Esta é uma sessão livre.';

export function isDisciplinaEstudoLivre(nome: string | null | undefined): boolean {
  return (nome ?? '').trim().toLowerCase() === ESTUDO_LIVRE_NOME.toLowerCase();
}
