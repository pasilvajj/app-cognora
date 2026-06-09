/** API na EC2 AWS (Spring Boot, porta 8080). */
export const COGNORA_API_HOST = 'http://3.141.199.149:8080';

/** URLs absolutas — acesso direto ao backend (ex.: testes fora do `ng serve`). */
export const cognoraApiUrls = () => ({
  apiBaseUrl: `${COGNORA_API_HOST}/api`,
  authBaseUrl: `${COGNORA_API_HOST}/api/auth`,
  billingApiPath: `${COGNORA_API_HOST}/api/billing`,
});

/**
 * URLs relativas — `ng serve` usa proxy.conf.json (`/api` → EC2 AWS).
 * Na Vercel (HTTPS) usa vercel.json (`/api` → EC2).
 */
export const cognoraApiUrlsRelative = () => ({
  apiBaseUrl: '/api',
  authBaseUrl: '/api/auth',
  billingApiPath: '/api/billing',
});

/** Em localhost ou HTTPS usa `/api` (proxy); caso contrário, URL absoluta. */
export function mustUseRelativeApiUrls(): boolean {
  if (typeof globalThis === 'undefined' || !globalThis.location) {
    return false;
  }
  const { protocol, hostname } = globalThis.location;
  return (
    protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

export function resolveCognoraApiUrls() {
  return mustUseRelativeApiUrls() ? cognoraApiUrlsRelative() : cognoraApiUrls();
}
