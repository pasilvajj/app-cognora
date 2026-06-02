import { HttpContextToken } from '@angular/common/http';

/**
 * Quando true, {@link erroInterceptor} não exibe toast — o componente trata o erro
 * (ex.: login/cadastro com mensagem no formulário).
 */
export const HTTP_SUPRIMIR_TOAST_ERRO = new HttpContextToken<boolean>(() => false);
