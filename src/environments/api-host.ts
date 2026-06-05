/** API Cognora no EC2 (backend Spring Boot, porta 8080). */
export const COGNORA_API_HOST = 'http://3.141.199.149:8080';

/** URLs absolutas — `ng serve` em http://localhost chama o EC2 direto. */
export const cognoraApiUrls = () => ({
  apiBaseUrl: `${COGNORA_API_HOST}/api`,
  authBaseUrl: `${COGNORA_API_HOST}/api/auth`,
  billingApiPath: `${COGNORA_API_HOST}/api/billing`,
});

/**
 * URLs relativas — Vercel (HTTPS) usa proxy em vercel.json (`/api` → EC2).
 * Evita mixed content (HTTPS → HTTP) e CORS no browser.
 */
export const cognoraApiUrlsRelative = () => ({
  apiBaseUrl: '/api',
  authBaseUrl: '/api/auth',
  billingApiPath: '/api/billing',
});

/** Em HTTPS (ex.: Vercel) o browser bloqueia chamadas HTTP ao EC2. */
export function mustUseRelativeApiUrls(): boolean {
  return typeof globalThis !== 'undefined' && globalThis.location?.protocol === 'https:';
}

export function resolveCognoraApiUrls() {
  return mustUseRelativeApiUrls() ? cognoraApiUrlsRelative() : cognoraApiUrls();
}
