/**
 * Table de correspondance entre les identifiants de navigation internes
 * (`activeNav`) et les URL réelles.
 *
 * Jusqu'ici, la navigation était un `useState` dans `App.tsx` doublé d'une pile
 * en mémoire dans `NavigationContext` : aucune URL ne bougeait. Conséquences
 * concrètes — aucun lien profond partageable, le bouton « précédent » du
 * navigateur quittait l'application, un rechargement ramenait à l'accueil, et
 * aucune page n'existait assez pour être découpée en morceaux de bundle.
 *
 * Les identifiants restent ceux qu'emploient déjà `AppShell`, `AgentDashboard`
 * et `AdminDashboard` : c'est ce qui permet d'introduire de vraies URL sans
 * réécrire les 33 composants qui appellent `navigate('mon-dossier')`.
 */

export type NavArea = 'client' | 'staff';

/** Espace client — les URL sont visibles par le public, donc en français. */
export const CLIENT_PATHS: Record<string, string> = {
  dashboard: '/',
  simulateur: '/simulateur',
  'ma-demande': '/ma-demande',
  'mon-dossier': '/dossier',
  'mon-chantier': '/chantier',
  notifications: '/notifications',
  'mon-profil': '/profil',
  support: '/support',
};

/** Espace personnel (agent CPI et administrateur), sous `/admin`. */
export const STAFF_PATHS: Record<string, string> = {
  dashboard: '/admin',
  dossiers: '/admin/dossiers',
  traites: '/admin/dossiers-traites',
  clients: '/admin/clients',
  demandes: '/admin/demandes',
  'comptes-a-valider': '/admin/comptes-a-valider',
  'dossiers-non-attribues': '/admin/dossiers-non-attribues',
  utilisateurs: '/admin/utilisateurs',
  partenaires: '/admin/partenaires',
  'documents-clients': '/admin/documents-clients',
  'documents-admin': '/admin/documents-admin',
  convention: '/admin/produits-financiers',
  decaissements: '/admin/decaissements',
  chantier: '/admin/chantier',
  'notifications-agent': '/admin/notifications',
  historique: '/admin/historique',
  statistiques: '/admin/statistiques',
  systeme: '/admin/systeme',
  // Communes aux deux espaces : le personnel a aussi un profil.
  'mon-profil': '/admin/profil',
};

export function pathsFor(area: NavArea): Record<string, string> {
  return area === 'staff' ? STAFF_PATHS : CLIENT_PATHS;
}

/**
 * Page d'atterrissage après connexion.
 *
 * `simulateurAutorise` vient de `App.tsx::peutVoirSimulateur(role)` — ce
 * module reste volontairement sans notion de rôle ou de profil, l'appelant
 * tranche. Un client qui y a droit arrive sur le simulateur (porte d'entrée
 * du parcours, seul écran utile avant qu'un dossier existe) ; les autres sur
 * le tableau de bord.
 */
export function homePath(area: NavArea, simulateurAutorise = false): string {
  if (area === 'staff') return STAFF_PATHS.dashboard;
  return simulateurAutorise ? CLIENT_PATHS.simulateur : CLIENT_PATHS.dashboard;
}

/** Chemin d'un identifiant de navigation, ou `null` s'il est inconnu. */
export function pathForNav(area: NavArea, nav: string): string | null {
  return pathsFor(area)[nav] ?? null;
}

/**
 * Identifiant de navigation désigné par une URL, ou `null` — auquel cas
 * l'application affiche une vraie page 404 plutôt qu'un écran par défaut
 * silencieux.
 */
export function navForPath(area: NavArea, pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const table = pathsFor(area);
  for (const [nav, path] of Object.entries(table)) {
    if (path === clean) return nav;
  }
  return null;
}
