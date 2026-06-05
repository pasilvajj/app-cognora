/** API Cognora no EC2 (backend Spring Boot, porta 8080). */
export const COGNORA_API_HOST = 'http://3.141.199.149:8080';

export const cognoraApiUrls = () => ({
  apiBaseUrl: `${COGNORA_API_HOST}/api`,
  authBaseUrl: `${COGNORA_API_HOST}/api/auth`,
  billingApiPath: `${COGNORA_API_HOST}/api/billing`,
});
