import type { Page, Route } from '@playwright/test';

/**
 * Réponses d'API servies aux tests, à la place du backend Laravel.
 *
 * La forme des objets suit `src/app/api/types/generated.d.ts` — le fichier
 * produit par `php artisan typescript:transform`. S'en écarter ferait passer
 * des tests sur une application qui ne fonctionnerait pas en vrai ; c'est la
 * seule discipline qui rende ces doublures utiles.
 */

/** L'API Laravel enveloppe toujours sa charge utile dans `{ data: … }`. */
const enveloppe = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });

export const CLIENT_ID = 'cli-0001';
export const UTILISATEUR = {
  id: 'usr-0001',
  name: 'Awa Ndiaye',
  email: 'awa.ndiaye@example.sn',
  phone: '+221 77 000 00 00',
  employer: 'Ministère de l’Éducation',
  profileType: 'fonctionnaire',
  revenus: '500000',
  avatar: null,
  avatarUrl: null,
  needsOnboarding: false,
  role: 'client',
  permissions: [],
  clientId: CLIENT_ID,
};

/** Pièce requise « non déposée » : l'état de départ du parcours de dépôt. */
export const PIECE_IDENTITE = {
  fileUrl: null,
  id: 'req-0001',
  clientId: CLIENT_ID,
  docId: 'identite',
  label: "Pièce d'identité valide",
  status: 'en-attente',
  commentaire: null,
  dateValidation: null,
  agentName: null,
  version: 1,
  submittedLabel: null,
  date: null,
  taille: null,
};

/**
 * Document CPI à signer, AVEC son fichier réel.
 *
 * `fileUrl` est le cœur du correctif de signature : sans lui, l'interface doit
 * refuser la signature. Le test de signature s'appuie sur les deux cas.
 */
export const DOC_A_SIGNER = {
  fileUrl: 'https://exemple.invalid/contrat-signe.pdf',
  id: 'doc-0001',
  clientId: CLIENT_ID,
  categorie: 'contrats',
  nom: 'Contrat de réservation',
  reference: 'CT-2026-0001',
  dateCreation: '2026-08-01T09:00:00Z',
  datePublication: '2026-08-02T09:00:00Z',
  version: 'v1',
  status: 'a-signer',
  auteur: 'Agent CPI',
  fichier: 'contrat.pdf',
  commentaire: null,
  visibleClient: true,
  signatureRequise: true,
  taille: '241 Ko',
  format: 'pdf',
};

/** Le même document, sans fichier joint. */
export const DOC_SANS_FICHIER = { ...DOC_A_SIGNER, fileUrl: null, fichier: null, format: null };

const PROFIL_CLIENT = {
  id: CLIENT_ID,
  name: UTILISATEUR.name,
  userId: UTILISATEUR.id,
  ref: 'CPI-2026-0001',
  statut: 'Dossier en cours',
  progression: 40,
  projectNom: 'Villa F4 — Thiès',
  adresse: 'Cité CPI, Thiès',
  email: UTILISATEUR.email,
  phone: UTILISATEUR.phone,
  employer: UTILISATEUR.employer,
  fonction: 'Enseignante',
  conseiller: 'Agent CPI',
  banque: null,
  dossierEtape: 1,
  dateInscription: '2024-03-15T00:00:00Z',
  demande: null,
  requisDocs: [PIECE_IDENTITE],
};

/** Réponses par défaut, par chemin d'API. `null` = corps `{ data: null }`. */
function reponseParDefaut(chemin: string): unknown | undefined {
  const table: Record<string, unknown> = {
    '/api/auth/me': { user: UTILISATEUR, role: 'client', permissions: [] },
    '/api/client/profile': PROFIL_CLIENT,
    '/api/client/mes-documents': [PIECE_IDENTITE],
    '/api/client/mes-documents-cpi': [DOC_A_SIGNER],
    '/api/client/ma-demande': null,
    '/api/client/mes-banques': [],
    '/api/client/notifications': [],
    '/api/client/mon-chantier': null,
    '/api/client/mon-dossier-journey': { etape: 1, submitted: false, docsValides: false },
  };
  return chemin in table ? table[chemin] : undefined;
}

export interface OptionsApi {
  /** Remplace ou ajoute des réponses, par chemin exact (`/api/...`). */
  reponses?: Record<string, unknown>;
  /** Appelé pour chaque requête interceptée — sert aux assertions d'envoi. */
  espion?: (requete: { method: string; url: string; postData: string | null; headers: Record<string, string> }) => void;
}

/**
 * Intercepte tous les appels d'API et sert les doublures ci-dessus.
 *
 * Tout chemin non déclaré reçoit `{ data: null }` avec un statut 200 : un test
 * ne doit pas échouer parce qu'un écran voisin interroge une route qui ne le
 * concerne pas.
 */
export async function stubApi(page: Page, options: OptionsApi = {}): Promise<void> {
  // Le filtre porte sur le CHEMIN, pas sur un motif d'URL. En développement,
  // Vite sert les modules à leur chemin source : `**\/api/**` interceptait aussi
  // `/src/app/api/client.ts`, qui revenait alors en JSON — le navigateur
  // refusait le module et la page restait blanche.
  await page.route(
    url => url.pathname === '/api' || url.pathname.startsWith('/api/'),
    async (route: Route) => {
      const requete = route.request();
      const chemin = new URL(requete.url()).pathname;

      options.espion?.({
        method: requete.method(),
        url: requete.url(),
        postData: requete.postData(),
        headers: requete.headers(),
      });

      if (options.reponses && chemin in options.reponses) {
        const valeur = options.reponses[chemin];
        // Une fonction permet de décrire un refus (409, 422…) plutôt qu'un corps.
        if (typeof valeur === 'function') return (valeur as (r: Route) => Promise<void>)(route);
        return route.fulfill(enveloppe(valeur));
      }

      const defaut = reponseParDefaut(chemin);
      return route.fulfill(enveloppe(defaut === undefined ? null : defaut));
    },
  );
}

/**
 * Ouvre l'application avec une session cliente déjà établie.
 *
 * Le jeton est écrit AVANT le premier script de la page : `App` ne lit
 * `getToken()` qu'à l'initialisation de son état, un `localStorage.setItem`
 * après chargement arriverait trop tard.
 */
export async function ouvrirSessionClient(page: Page, url: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('cpi_api_token', 'jeton-de-test');
  });
  // Deux navigations : la première pose le jeton pour l'origine, la seconde
  // ouvre l'écran visé avec une session déjà restaurable. En une seule passe,
  // `App` évaluait `getToken()` avant que le script d'initialisation n'ait
  // écrit dans le stockage de cette origine, se croyait déconnecté, et
  // renvoyait sur l'accueil public.
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.goto(url);
}
