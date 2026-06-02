import { HttpErrorResponse } from '@angular/common/http';
import { extrairMensagemErroHttp } from './extrair-mensagem-erro-http';

export function mensagemErroCadastro(err: HttpErrorResponse): string {
  const api = extrairMensagemErroHttp(err);

  if (err.status === 0) {
    return api ?? 'Não foi possível conectar ao servidor.';
  }
  if (err.status === 409) {
    return api ?? 'Este e-mail já está cadastrado.';
  }
  if (err.status >= 500) {
    return api ?? `Erro no servidor (HTTP ${err.status}). Tente novamente.`;
  }
  if (err.status === 503) {
    return api ?? 'Serviço indisponível. Verifique o banco de dados.';
  }
  return api ?? 'Erro ao criar conta. Tente novamente.';
}
