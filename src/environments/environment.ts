/**
 * URLs relativas ao host da página: funcionam com `ng serve` + `proxy.conf.json`
 * e evitam CORS (pedidos vão ao mesmo origin e o proxy encaminha ao Spring).
 * Para API noutro domínio, use build com replacement ou variável de ambiente.
 */
export const environment = {
  production: false,
  /** REST e auth sob o mesmo prefixo — um único proxy `/api` no `ng serve`. */
  apiBaseUrl: '/api',
  authBaseUrl: '/api/auth',
};
