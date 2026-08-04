import axios from 'axios';

/** Seule clé localStorage ajoutée pour l'API : le token Sanctum. */
export const TOKEN_KEY = 'cpi_api_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Base des appels API.
 *
 * En développement : `/api` en relatif, réécrit par le proxy Vite vers le
 * backend (voir `VITE_API_PROXY_TARGET` dans vite.config.ts). Une seule origine
 * côté navigateur, donc aucun CORS.
 *
 * En production : relatif également, si le `dist/` est servi par le même hôte
 * que l'API. Sinon, définir `VITE_API_URL` au build — mais l'appel devient
 * inter-origine, et le backend doit alors autoriser cette origine
 * (`FRONTEND_URL` dans son .env, lu par config/cors.php).
 */
const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true,
});

// Attache le token Sanctum à chaque requête
api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → session expirée ou token révoqué : on efface le token.
// (L'app repasse à l'écran de connexion au prochain rendu.)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && getToken()) {
      clearToken();
    }
    return Promise.reject(error);
  },
);

/** Vrai si l'erreur est une 422 de validation portant sur le champ donné. */
export function apiFieldError(error: unknown, field: string): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) return false;
  const data = error.response.data as { errors?: Record<string, string[]> } | undefined;
  return Boolean(data?.errors?.[field]?.length);
}

/** Message d'erreur lisible pour l'UI à partir d'une erreur axios. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined;
    const firstValidation = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    if (firstValidation) return firstValidation;
    if (data?.message) return data.message;
  }
  return fallback;
}

export default api;
