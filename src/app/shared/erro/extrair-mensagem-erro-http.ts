import { HttpErrorResponse } from '@angular/common/http';

/** Rótulos genéricos do Spring/Tomcat — não são úteis sozinhos na UI. */
const ROTULOS_GENERICOS = new Set([
  'Unauthorized',
  'Forbidden',
  'Bad Request',
  'Internal Server Error',
  'Service Unavailable',
  'Not Found',
]);

function textoUtil(valor: unknown): string | null {
  if (typeof valor !== 'string') {
    return null;
  }
  const t = valor.trim();
  if (!t || t.startsWith('<')) {
    return null;
  }
  return t;
}

/** Lê `message` (API Cognora), `detail` (Problem Details) ou `error` do Spring. */
export function extrairMensagemErroHttp(error: HttpErrorResponse): string | null {
  const body = error.error;

  const direto = textoUtil(body);
  if (direto) {
    return direto;
  }

  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;

  const message = textoUtil(record['message']);
  if (message) {
    return message;
  }

  const detail = textoUtil(record['detail']);
  if (detail) {
    return detail;
  }

  const errorField = textoUtil(record['error']);
  if (errorField && !ROTULOS_GENERICOS.has(errorField)) {
    return errorField;
  }

  return null;
}
