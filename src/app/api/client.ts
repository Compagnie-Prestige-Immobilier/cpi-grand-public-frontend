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
 * Jeton du membre du personnel mis de côté pendant une prise en main.
 *
 * Le serveur émet un second jeton, celui du client consulté ; l'original est
 * conservé ici pour être restitué à la sortie. En mémoire seulement, il serait
 * perdu au moindre rafraîchissement de page — le personnel se retrouverait
 * enfermé dans le compte du client, sans moyen d'en sortir.
 *
 * Comme TOKEN_KEY, cette clé ne sort pas de ce module : c'est ce que vérifie la
 * garde d'intégration continue sur les écritures localStorage.
 */
const IMPERSONATOR_KEY = 'cpi_impersonator_token';

export function startImpersonation(tokenCible: string): void {
  // L'original d'abord : si l'écriture suivante échouait, on saurait encore
  // revenir. L'inverse enfermerait dans le compte consulté.
  localStorage.setItem(IMPERSONATOR_KEY, getToken() ?? '');
  setToken(tokenCible);
}

/** Restitue le jeton du personnel. Retourne faux si aucune prise en main. */
export function stopImpersonation(): boolean {
  const original = localStorage.getItem(IMPERSONATOR_KEY);
  if (!original) return false;
  setToken(original);
  localStorage.removeItem(IMPERSONATOR_KEY);
  return true;
}

export function isImpersonating(): boolean {
  return localStorage.getItem(IMPERSONATOR_KEY) !== null;
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

/**
 * Émis quand le serveur répond 401 alors qu'un jeton était présent : session
 * expirée, jeton révoqué, ou compte supprimé.
 *
 * Effacer le jeton ne suffisait pas. `App` ne lit `getToken()` qu'à
 * l'initialisation de son état : une fois l'application montée, plus rien ne
 * réagissait. L'utilisateur restait devant une interface qui paraissait
 * connectée et dont toutes les requêtes échouaient en silence — aucun message,
 * aucun retour à la connexion, jusqu'au rechargement manuel de la page.
 */
export const UNAUTHENTICATED_EVENT = 'cpi:unauthenticated';

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && getToken()) {
      clearToken();
      // Une prise en main laisse le jeton du personnel en réserve : il est
      // devenu inutilisable lui aussi, ne pas le garder derrière.
      localStorage.removeItem(IMPERSONATOR_KEY);
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
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

/**
 * Message d'erreur lisible pour l'UI à partir d'une erreur axios.
 *
 * L'ordre compte : d'abord la première erreur de validation (422), puis le
 * `message` du serveur, et seulement à défaut le repli fourni par l'appelant.
 *
 * C'est ce qui rend présentables les **409 de transition illégale** que renvoie
 * désormais l'API (passer un chantier de « non démarré » à « livré », mettre en
 * vérification une pièce jamais déposée…). Leur `message` énumère les
 * transitions possibles : il est écrit pour l'utilisateur et doit être affiché
 * tel quel. Ne jamais le remplacer par un texte générique.
 */
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
