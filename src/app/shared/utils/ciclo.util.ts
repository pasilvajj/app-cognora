export type CicloOption = { id: number; nome: string };

export function resolverCicloPadrao(
  ciclos: CicloOption[],
  preferido: number | null
): number | null {
  if (!ciclos?.length) return null;
  if (preferido && ciclos.some(c => c.id === preferido)) return preferido;
  return ciclos[0].id ?? null;
}