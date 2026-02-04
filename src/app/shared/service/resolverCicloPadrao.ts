export type CicloOption = { id: number; nome: string };

/**
 * Resolve o ciclo padrão a partir de:
 * 1) um id preferido (ex: último ciclo usado) se ele existir na lista
 * 2) senão, o primeiro ciclo válido da lista
 *
 * Regras:
 * - ignora ids inválidos (<= 0, NaN)
 * - não quebra se a lista vier vazia/undefined
 */
export function resolverCicloPadrao(
  ciclos: CicloOption[] | null | undefined,
  preferido: number | null | undefined
): number | null {
  if (!ciclos?.length) return null;

  const preferidoId = Number(preferido);
  const preferidoValido = Number.isFinite(preferidoId) && preferidoId > 0;

  if (preferidoValido && ciclos.some((c) => Number(c?.id) === preferidoId)) {
    return preferidoId;
  }

  const primeiroValido = ciclos.find((c) => Number.isFinite(Number(c?.id)) && Number(c.id) > 0);
  return primeiroValido ? Number(primeiroValido.id) : null;
}