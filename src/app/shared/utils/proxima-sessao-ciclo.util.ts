import { CicloMateriaDto } from '../../features/ciclos/data/ciclos-api.service';

/**
 * Alinha a “próxima sessão” devolvida por {@code buscarProximaSessao} ao estado real do ciclo.
 * O backend usa a última sessão por {@code inicio} e o item seguinte na ordem — isso pode apontar
 * para uma matéria já concluída ou inconsistente; a tela Estudar Agora já corrigia isso localmente.
 */
export function escolherProximaMateriaElegivel(
  itens: CicloMateriaDto[],
): CicloMateriaDto | undefined {
  const list = [...itens].sort((a, b) => a.ordem - b.ordem);
  const emAndamento = list.find((i) => !!i.cronometroIniciado && !i.concluida);
  if (emAndamento) return emAndamento;
  return list.find((i) => !i.concluida);
}

export function alinharProximaSessaoAoItensDoCiclo<T extends {
  cicloItemId: number;
  ordem: number;
  disciplinaNome: string;
  tempoMinutos: number;
}>(
  dto: T | null | undefined,
  itens: CicloMateriaDto[],
): T | null {
  if (!dto || !itens.length) {
    return dto ?? null;
  }

  const alvo = itens.find((i) => i.cicloItemId === dto.cicloItemId);
  if (alvo && !alvo.concluida) {
    return dto;
  }

  const elegivel = escolherProximaMateriaElegivel(itens);
  if (!elegivel) {
    return null;
  }

  return {
    ...dto,
    cicloItemId: elegivel.cicloItemId,
    ordem: elegivel.ordem,
    disciplinaNome: elegivel.disciplinaNome,
    tempoMinutos: elegivel.tempoMinutos,
  };
}
