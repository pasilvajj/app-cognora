/**
 * Extrai mensagem legível de {@link HttpErrorResponse} ou corpo ProblemDetails do Spring.
 */
export function extrairMensagemErroHttp(err: unknown): string | null {
  if (!err || typeof err !== 'object') {
    return null;
  }
  const e = err as { error?: unknown; message?: string };
  const body = e.error;

  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }

  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const m = o['message'] ?? o['detail'] ?? o['title'];
    if (typeof m === 'string' && m.trim()) {
      return m.trim();
    }
  }

  return null;
}
