/**
 * NavigationContext — adaptateur mince au-dessus de react-router.
 *
 * L'API publique (`activeNav`, `activeSub`, `navigate`, `goBack`) est
 * volontairement inchangée : 33 composants appellent déjà
 * `navigate('mon-dossier')` ou `navigate('mon-chantier', 'tranche-2')`. Seule
 * l'implémentation change — la pile en mémoire est remplacée par l'URL.
 *
 * Ce que cela apporte, et qui n'existait pas :
 *   - un lien profond partageable vers chaque écran ;
 *   - le bouton « précédent » du navigateur qui fonctionne enfin ;
 *   - un rechargement qui reste sur la page consultée ;
 *   - une URL inconnue qui donne une vraie 404 (`activeNav === null`).
 *
 * Usage inchangé :
 *   const { navigate, activeNav, activeSub } = useNavigate();
 *   navigate('mon-dossier');
 *   navigate('mon-dossier', 'bancaires');   // → /dossier?section=bancaires
 */

import { createContext, useContext, useMemo } from 'react';
import { useLocation, useNavigate as useRouterNavigate } from 'react-router';
import { navForPath, pathForNav, type NavArea } from '../routes';

export interface NavTarget {
  page: string;
  sub?: string;
}

interface NavigationContextValue {
  /** Identifiant de la page courante, ou `null` si l'URL n'en désigne aucune. */
  activeNav: string | null;
  activeSub?: string;
  navigate: (page: string, sub?: string) => void;
  /** Retour à l'écran précédent — l'historique du navigateur, pas une pile locale. */
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

/**
 * Le sous-écran voyage en paramètre de requête plutôt qu'en segment d'URL :
 * il n'y a pas de liste exhaustive des sous-écrans possibles, et en inventer
 * une aurait obligé à déclarer une route par onglet de chaque page.
 */
const SUB_PARAM = 'section';

export function NavigationProvider({
  children,
  area,
}: {
  children: React.ReactNode;
  /** Espace de l'utilisateur : les mêmes identifiants n'ont pas la même URL. */
  area: NavArea;
}) {
  const routerNavigate = useRouterNavigate();
  const location = useLocation();

  const value = useMemo<NavigationContextValue>(() => {
    const activeNav = navForPath(area, location.pathname);
    const activeSub = new URLSearchParams(location.search).get(SUB_PARAM) ?? undefined;

    return {
      activeNav,
      activeSub,
      navigate(page: string, sub?: string) {
        const path = pathForNav(area, page);
        // Un identifiant inconnu n'est pas silencieusement ignoré : on suit
        // quand même vers une URL, qui affichera la 404. Le contraire — ne
        // rien faire — laissait l'utilisateur sur un bouton qui semblait mort.
        const target = path ?? `/${page}`;
        routerNavigate(sub ? `${target}?${SUB_PARAM}=${encodeURIComponent(sub)}` : target);
      },
      goBack() {
        routerNavigate(-1);
      },
    };
  }, [area, location.pathname, location.search, routerNavigate]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigate() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigate must be used within NavigationProvider');
  return ctx;
}
