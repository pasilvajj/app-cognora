const STORAGE_KEY = 'cognora:estudo-contexto-ciclo-id';

/** Último ciclo associado ao fluxo de estudo neste separador (para redirect amigável em 404). */
export function persistirCicloContextoEstudo(cicloId: number | null | undefined): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  if (cicloId == null || !Number.isFinite(Number(cicloId)) || Number(cicloId) <= 0) {
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Math.floor(Number(cicloId))));
  } catch {
    /* quota / modo privado */
  }
}

export function obterCicloContextoEstudoGuardado(): number | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) {
      return null;
    }
    return Math.floor(n);
  } catch {
    return null;
  }
}
