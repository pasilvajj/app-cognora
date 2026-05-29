/** Reserva fixa de Estudo Livre em todo ciclo (4 blocos × 1h dentro da carga semanal). */
export const ESTUDO_LIVRE_HORAS = 4;
export const ESTUDO_LIVRE_NOME = 'Estudo Livre';

/** Mínimo de horas por matéria na semana (1 sessão = 1:30h; sessões podem ser maiores, ex. 2h). */
export const MIN_HORAS_POR_MATERIA = 1.5;
/** Duração mínima de cada sessão de matéria (alinhado ao backend). */
export const BLOCO_SESSAO_MINUTOS = 90;

export const ESTUDO_LIVRE_MENSAGEM =
  'Utilize este horário para estudar da forma que desejar! Revise conteúdos que você sente necessidade. ' +
  'Faça uma redação, progrida em alguma matéria, corrija questões, passe seu caderno a limpo. ' +
  'Faça como você quiser e desejar! Esta é uma sessão livre.';

export function isDisciplinaEstudoLivre(nome: string | null | undefined): boolean {
  return (nome ?? '').trim().toLowerCase() === ESTUDO_LIVRE_NOME.toLowerCase();
}
