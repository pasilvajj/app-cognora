import { HttpContextToken } from '@angular/common/http';

/**
 * Quando true, {@link erroInterceptor} omite o toast genérico em **404** e **403** para o pedido
 * (o chamador mostra mensagem própria). Outros códigos continuam com toast de erro.
 */
export const HTTP_SUPRIMIR_TOAST_ERRO = new HttpContextToken<boolean>(() => false);
