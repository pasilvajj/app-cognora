/** API local (desenvolvimento). */
export const COGNORA_API_HOST = 'http://localhost:8080';

/** URLs absolutas — acesso direto ao backend (ex.: testes fora do `ng serve`). */
export const cognoraApiUrls = () => ({
  apiBaseUrl: `${COGNORA_API_HOST}/api`,
  authBaseUrl: `${COGNORA_API_HOST}/api/v1/auth`,
  billingApiPath: `${COGNORA_API_HOST}/api/billing`,
});

/**
 * URLs relativas — `ng serve` usa proxy.conf.json (`/api` → localhost:8080).
 * Na Vercel (HTTPS) usa vercel.json (`/api` → backend remoto).
 */
export const cognoraApiUrlsRelative = () => ({
  apiBaseUrl: '/api',
  authBaseUrl: '/api/v1/auth',
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
