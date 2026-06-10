/**
 * Cor fixa por disciplina, usada para manter a mesma disciplina com a mesma cor em todas as telas
 * (edital verticalizado, planejamento, etc.). A cor é derivada de um hash do nome, então não depende
 * de ordem nem de dados do backend.
 */

/** Paleta pastel (inspirada no donut do ciclo). */
export const CORES_DISCIPLINA: readonly string[] = [
  '#6ca6e8', // azul
  '#f4c25b', // amarelo
  '#5ec9b4', // turquesa
  '#ef9a8a', // pêssego
  '#8fa3bf', // azul-acinzentado
  '#a98fd6', // lavanda
  '#e58ab0', // rosa
  '#7bc47f', // verde
  '#f0a868', // laranja
  '#7fcce0', // ciano
];

/** Cor estável para uma disciplina, a partir do seu nome. */
export function corDisciplina(nome: string | null | undefined): string {
  const chave = (nome ?? '').trim().toLowerCase();
  if (chave.length === 0) {
    return CORES_DISCIPLINA[0];
  }
  let hash = 0;
  for (let i = 0; i < chave.length; i++) {
    hash = (hash * 31 + chave.charCodeAt(i)) | 0;
  }
  return CORES_DISCIPLINA[Math.abs(hash) % CORES_DISCIPLINA.length];
}
