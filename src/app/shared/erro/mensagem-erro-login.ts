import { HttpErrorResponse } from '@angular/common/http';
import { extrairMensagemErroHttp } from './extrair-mensagem-erro-http';

const MENSAGEM_CREDENCIAIS = 'E-mail ou senha inválidos.';

/**
 * Mensagem amigável para a tela de login conforme o status HTTP real.
 * Não usa "credenciais inválidas" para erros de servidor (5xx) ou rede.
 */
export function mensagemErroLogin(err: HttpErrorResponse): string {
  const api = extrairMensagemErroHttp(err);

  if (err.status === 0) {
    return (
      api ??
      'Não foi possível conectar ao servidor. Verifique se a API está rodando (porta 8080) e o proxy do Angular.'
    );
  }

  if (err.status === 503) {
    return api ?? 'Serviço indisponível. Verifique a conexão com o banco de dados (PostgreSQL).';
  }

  if (err.status >= 500) {
    return (
      api ??
      `Erro interno no servidor (HTTP ${err.status}). Tente novamente ou veja os logs da API.`
    );
  }

  if (err.status === 401 || err.status === 400) {
    return api ?? MENSAGEM_CREDENCIAIS;
  }

  if (api) {
    return api;
  }

  return `Não foi possível entrar (HTTP ${err.status}). Tente novamente.`;
}
