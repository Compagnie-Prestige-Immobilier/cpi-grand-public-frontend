import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import AuthPage from './components/AuthPage';
import OnboardingPage from './components/OnboardingPage';
import { PermissionProvider } from './auth/PermissionContext';
import type { Permission, UserRole as ApiUserRole } from './auth/permissions';
import { auth, type AuthPayload, type UserData, type StatutCompte } from './api/endpoints';
import CompteEnAttentePage from './components/CompteEnAttentePage';
import { apiErrorMessage, getToken, setToken, clearToken, UNAUTHENTICATED_EVENT } from './api/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { homePath, type NavArea } from './routes';

// L'app authentifiée (dashboards, modules, graphiques Recharts) est chargée à la
// demande : la landing / connexion reste ultra-légère au premier chargement.
const AppShell = lazy(() => import('./components/AppShell'));

// Rôles « legacy » attendus par AppShell et les dashboards (pont Phase 2 —
// les phases 3+ brancheront les dashboards directement sur l'API).
export type UserRole = 'client-fonctionnaire' | 'client-public' | 'agent-cpi' | 'admin';

export interface AuthUser {
  role: UserRole;
  /**
   * Profil choisi à l'inscription (`fonctionnaire`, `prive`, `autre`,
   * `diaspora`), `null` pour le personnel. Plus fin que `role`, qui ne
   * distingue que fonctionnaire/public : c'est CE champ qui doit trancher un
   * accès propre à un profil précis (voir `peutVoirSimulateur`) — `role` ne
   * le pourrait pas sans perdre l'information dès qu'un profil autre que
   * fonctionnaire a lui aussi besoin d'une règle qui lui est propre.
   */
  profileType: string | null;
  name: string;
  /** Identifiant de connexion (renvoyé par /auth/me). */
  email?: string;
  memberNumber?: string;
  clientId?: string;
  /** URL affichable de la photo de profil (lien signé R2 ou URL Google). */
  avatarUrl?: string | null;
  /**
   * État de validation du compte. `null` pour le personnel (non soumis à la
   * règle — voir `User::estPersonnel()` côté serveur) : ne jamais l'utiliser
   * pour bloquer un accès sans vérifier `estClient` d'abord.
   */
  statutCompte: StatutCompte | null;
  motifRejet: string | null;
}

/**
 * Un compte client non validé n'entre PAS dans `AppShell` : y entrer
 * déclencherait des appels vers des routes que `compte.valide` referme (403 en
 * boucle) pour un espace qui n'a de toute façon rien à montrer. Le personnel
 * n'est jamais concerné — ces comptes sont validés par construction.
 */
function compteBloque(user: AuthUser): boolean {
  return user.role !== 'agent-cpi' && user.role !== 'admin'
    && user.statutCompte !== null && user.statutCompte !== 'valide';
}

/**
 * Écrans publics. Ce type est l'interface historique d'`AuthPage`, conservée
 * telle quelle ; `App` traduit chaque valeur en URL réelle.
 */
export type AppPage = 'welcome' | 'login' | 'register' | 'terms' | 'dashboard';

/** Chemin public correspondant à un écran d'`AuthPage`. */
const PUBLIC_PATHS: Record<Exclude<AppPage, 'dashboard'>, string> = {
  welcome: '/',
  login: '/connexion',
  register: '/inscription',
  terms: '/conditions',
};

/** Chemin de retour du fournisseur d'identité Google. */
export const GOOGLE_CALLBACK_PATH = '/auth/google/callback';

/** Rôle Spatie (API) → rôle legacy attendu par les dashboards. */
function mapApiRole(role: ApiUserRole, profileType: string | null): UserRole {
  if (role === 'super-admin') return 'admin';
  if (role === 'agent-cpi') return 'agent-cpi';
  return profileType === 'fonctionnaire' ? 'client-fonctionnaire' : 'client-public';
}

/** Espace de navigation d'un rôle : les URL ne sont pas les mêmes. */
export function areaForRole(role: UserRole): NavArea {
  return role === 'agent-cpi' || role === 'admin' ? 'staff' : 'client';
}

/**
 * Profils autorisés à voir le simulateur de financement — pour l'instant
 * réservé aux fonctionnaires, à la demande de CPI. Tranché sur `profileType`
 * et non sur `role` : `role` ne distingue que fonctionnaire/public, une seule
 * porte binaire — ajouter `'prive'` ou `'diaspora'` ici suffirait à leur
 * ouvrir l'accès sans y perdre les autres profils regroupés sous
 * `client-public`. Seul point à modifier pour changer qui voit le
 * simulateur : la navigation (`AppShell::getNavItems`), la route elle-même
 * (fermée via `allowedNavs`, qui dérive de la même liste), la page
 * d'atterrissage après connexion (`routes.ts::homePath`) et le raccourci du
 * tableau de bord (`ClientDashboardHome`) s'ajustent automatiquement.
 */
export const PROFILS_AVEC_SIMULATEUR: readonly string[] = ['fonctionnaire'];

/** Ce profil voit-il le simulateur ? */
export function peutVoirSimulateur(profileType: string | null): boolean {
  return profileType !== null && PROFILS_AVEC_SIMULATEUR.includes(profileType);
}

/** Vrai lorsque le navigateur est sur l'URL de retour du fournisseur Google. */
function surRetourGoogle(): boolean {
  return window.location.pathname === GOOGLE_CALLBACK_PATH;
}

/** Code OAuth présent quand Google redirige vers /auth/google/callback?code=… */
function googleCallbackCode(): string | null {
  if (!surRetourGoogle()) return null;
  return new URLSearchParams(window.location.search).get('code');
}

/**
 * Message destiné à l'utilisateur lorsque Google revient SANS code.
 *
 * C'est le cas nominal d'un refus : l'utilisateur ferme la fenêtre de
 * consentement ou clique « Annuler », et Google redirige vers
 * `/auth/google/callback?error=access_denied`. Jusqu'ici, l'application ne
 * lisait que le paramètre `code` : sans lui, l'effet de montage rendait la
 * main immédiatement, la route de retour affichait son écran de chargement…
 * et n'en sortait jamais. L'utilisateur restait devant un squelette animé,
 * sans message, sans bouton, sans moyen de revenir à la connexion autrement
 * qu'en modifiant l'URL lui-même.
 */
function messageRetourGoogle(erreur: string | null): string {
  if (erreur === 'access_denied')
    return "Vous n'avez pas autorisé CPI à utiliser votre compte Google. Vous pouvez réessayer, ou vous connecter avec votre adresse e-mail et votre mot de passe.";
  return "La connexion avec Google n'a pas abouti. Réessayez, ou connectez-vous avec votre adresse e-mail et votre mot de passe.";
}

// Écran de transition pendant le chargement du chunk de l'espace connecté.
export function AppLoader() {
  const bar = (w: string, h = 12, r = 'var(--r-sm)') =>
    <div className="cpi-skeleton" style={{ width: w, height: h, borderRadius: r }} />;
  const card = (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cpi-skeleton" style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)' }} />
      {bar('60%', 22)}
      {bar('40%')}
    </div>
  );
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '20px', boxSizing: 'border-box' }}>
      {/* Topbar factice */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="cpi-skeleton" style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)' }} />
          {bar('120px', 16)}
        </div>
        <div className="cpi-skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--r-full)' }} />
      </div>
      {/* Titre */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, maxWidth: 480 }}>
        {bar('220px', 26)}
        {bar('320px', 14)}
      </div>
      {/* Grille de cartes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {[0, 1, 2, 3].map(i => <div key={i}>{card}</div>)}
      </div>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} role="status" aria-live="polite">Chargement de votre espace…</span>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const routerNavigate = useNavigate();
  const location = useLocation();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [apiRole, setApiRole] = useState<ApiUserRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // Restauration de session (token présent) ou retour du callback Google.
  const [booting, setBooting] = useState(() => Boolean(getToken()) || googleCallbackCode() !== null);
  /**
   * « Je viens de m'inscrire » vs « je me reconnecte » — seule l'accroche du
   * message affiché à un compte bloqué en dépend. Par défaut « connexion » :
   * c'est le cas d'une restauration de session silencieuse ou d'un retour
   * Google, ni l'un ni l'autre n'étant une inscription fraîche.
   */
  const [authContexte, setAuthContexte] = useState<'inscription' | 'connexion'>('connexion');

  /**
   * Applique une session et emmène l'utilisateur au bon endroit.
   *
   * `to` permet de revenir à l'URL demandée avant la redirection vers l'écran
   * de connexion : sans cela, un lien profond reçu par courriel ramenait
   * systématiquement à l'accueil après authentification.
   */
  const applyAuth = (payload: AuthPayload, to?: string, contexte?: 'inscription' | 'connexion') => {
    const u = payload.user;
    const role = mapApiRole(payload.role, u.profileType);
    setApiRole(payload.role);
    setPermissions(payload.permissions as Permission[]);
    setNeedsOnboarding(u.needsOnboarding);
    if (contexte) setAuthContexte(contexte);
    const nextUser: AuthUser = {
      role,
      profileType: u.profileType,
      name: u.name,
      email: u.email,
      clientId: payload.role === 'client' ? (u.clientId ?? u.id) : undefined,
      avatarUrl: u.avatarUrl ?? null,
      statutCompte: u.statutCompte,
      motifRejet: u.motifRejet,
    };
    setAuthUser(nextUser);
    // Un compte bloqué (onboarding en attente ou validation administrative
    // non faite) reste où il est : le faire naviguer vers le tableau de bord
    // d'un espace qu'il ne peut pas encore voir n'aurait aucun sens, et
    // l'écran affiché ne dépend de toute façon pas de l'URL (voir plus bas).
    if (!u.needsOnboarding && !compteBloque(nextUser)) {
      routerNavigate(to ?? homePath(areaForRole(role), peutVoirSimulateur(u.profileType)), { replace: true });
    }
  };

  // Au montage : échange du code Google, ou restauration de session via /auth/me.
  useEffect(() => {
    const code = googleCallbackCode();

    // Retour de Google sans code : refus de l'utilisateur, ou échec côté
    // fournisseur. Il faut le dire et ramener à la connexion — sinon l'écran
    // de chargement de cette route tourne indéfiniment.
    if (!code && surRetourGoogle()) {
      toast.error(messageRetourGoogle(new URLSearchParams(window.location.search).get('error')));
      routerNavigate(PUBLIC_PATHS.login, { replace: true });
      return;
    }

    if (!code && !getToken()) return;
    (async () => {
      try {
        if (code) {
          const payload = await auth.googleCallback(code);
          if (payload.token) setToken(payload.token);
          applyAuth(payload);
        } else {
          // Restauration silencieuse : l'utilisateur reste sur l'URL qu'il a
          // ouverte. Le rediriger vers l'accueil casserait tout lien profond.
          const payload = await auth.me();
          const role = mapApiRole(payload.role, payload.user.profileType);
          setApiRole(payload.role);
          setPermissions(payload.permissions as Permission[]);
          setNeedsOnboarding(payload.user.needsOnboarding);
          setAuthUser({
            role,
            profileType: payload.user.profileType,
            name: payload.user.name,
            email: payload.user.email,
            clientId: payload.role === 'client' ? (payload.user.clientId ?? payload.user.id) : undefined,
            avatarUrl: payload.user.avatarUrl ?? null,
            statutCompte: payload.user.statutCompte,
            motifRejet: payload.user.motifRejet,
          });
        }
      } catch (err) {
        clearToken();
        if (code) {
          // Échec de l'ÉCHANGE du code (jeton expiré, compte refusé côté API…).
          // Muet à l'origine : l'utilisateur revenait sur l'écran de connexion
          // sans savoir pourquoi, et recommençait la même manipulation.
          toast.error(apiErrorMessage(err, messageRetourGoogle(null)));
          routerNavigate(PUBLIC_PATHS.login, { replace: true });
        }
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (payload: AuthPayload) => {
    if (payload.token) setToken(payload.token);
    const from = (location.state as { from?: string } | null)?.from;
    // `onLogin` est le même callback pour LoginScreen et RegisterScreen : seule
    // l'URL sur laquelle on se trouve encore (avant toute navigation) distingue
    // les deux. Sert uniquement à choisir l'accroche du message affiché à un
    // compte bloqué — « merci pour votre inscription » n'a pas de sens pour
    // quelqu'un qui se reconnecte.
    const contexte = location.pathname === PUBLIC_PATHS.register ? 'inscription' : 'connexion';
    applyAuth(payload, from, contexte);
  };

  const handleOnboardingComplete = (user: UserData) => {
    setNeedsOnboarding(false);
    setAuthUser(prev => prev ? {
      ...prev,
      // Le profil vient d'être renseigné : on recalcule le rôle du dashboard
      // (fonctionnaire vs public) à partir du profileType choisi.
      role: apiRole ? mapApiRole(apiRole, user.profileType) : prev.role,
      profileType: user.profileType,
      name: user.name,
      email: user.email,
      clientId: apiRole === 'client' ? (user.clientId ?? user.id) : undefined,
    } : prev);
  };

  /**
   * Remet l'application dans son état déconnecté.
   *
   * `queryClient.clear()` est indispensable : sans lui, le cache React Query
   * garde en mémoire le dossier, les documents et les montants de l'utilisateur
   * sortant, que le suivant récupère tels quels le temps d'un rafraîchissement.
   * Sur un poste partagé, c'est une fuite de données entre clients.
   */
  const resetAuthState = () => {
    clearToken();
    queryClient.clear();
    setAuthUser(null);
    setApiRole(null);
    setPermissions([]);
    setNeedsOnboarding(false);
    routerNavigate(PUBLIC_PATHS.welcome, { replace: true });
  };

  const handleLogout = () => {
    auth.logout().catch(() => { /* le token local est effacé quoi qu'il arrive */ });
    resetAuthState();
  };

  // Session invalidée côté serveur : l'intercepteur a effacé le jeton, il reste
  // à sortir l'utilisateur de l'interface et à le lui dire.
  useEffect(() => {
    const onUnauthenticated = () => {
      resetAuthState();
      toast.error('Votre session a expiré. Merci de vous reconnecter.');
    };
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Traduit l'API historique d'`AuthPage` en navigation d'URL. */
  const navigatePublic = (p: AppPage) => {
    if (p === 'dashboard') {
      routerNavigate(authUser ? homePath(areaForRole(authUser.role), peutVoirSimulateur(authUser.profileType)) : PUBLIC_PATHS.welcome);
      return;
    }
    routerNavigate(PUBLIC_PATHS[p]);
  };

  if (booting) return <AppLoader />;

  // Les utilisateurs Google au profil incomplet doivent d'abord le compléter :
  // l'onboarding prime sur tout, y compris un lien profond. Vérifié AVANT le
  // blocage de compte : un compte Google fraîchement créé est déjà en attente
  // de validation dès sa création, et le renvoyer directement sur l'écran
  // d'attente le priverait de la seule occasion de compléter employeur,
  // profil et revenus — des informations dont l'administrateur a besoin pour
  // juger le compte.
  if (authUser && needsOnboarding) {
    return (
      <OnboardingPage
        userName={authUser.name}
        onComplete={handleOnboardingComplete}
        onLogout={handleLogout}
      />
    );
  }

  /*
   * Compte client non validé : reste ICI, avant `<Routes>`, quelle que soit
   * l'URL affichée. C'est délibéré — l'énoncé demande que la personne « reste
   * sur la page de connexion » : elle ne doit jamais voir passer l'espace
   * applicatif, même une fraction de seconde, et un lien profond ouvert
   * directement (favori, historique) ne doit pas non plus y donner accès.
   */
  if (authUser && compteBloque(authUser)) {
    return (
      <CompteEnAttentePage
        email={authUser.email ?? ''}
        statutCompte={authUser.statutCompte ?? 'en-attente-validation'}
        motifRejet={authUser.motifRejet}
        contexte={authContexte}
        onLogout={handleLogout}
        onEtatMisAJour={payload => applyAuth(payload)}
      />
    );
  }

  const publicScreen = (page: Exclude<AppPage, 'dashboard'>) => (
    <AuthPage page={page} onLogin={handleLogin} onNavigate={navigatePublic} />
  );

  const authenticatedArea = () => (
    <PermissionProvider role={apiRole} permissions={permissions}>
      <Suspense fallback={<AppLoader />}>
        <AppShell user={authUser!} onLogout={handleLogout} />
      </Suspense>
    </PermissionProvider>
  );

  return (
    <Routes>
      {/*
        Retour OAuth Google. La route doit exister pour que react-router ne
        renvoie pas une 404 pendant l'échange du code : l'effet de montage
        ci-dessus fait la redirection une fois le jeton obtenu.
      */}
      <Route path={GOOGLE_CALLBACK_PATH} element={<AppLoader />} />

      <Route path={PUBLIC_PATHS.terms} element={publicScreen('terms')} />
      <Route
        path={PUBLIC_PATHS.login}
        element={authUser ? <Navigate to={homePath(areaForRole(authUser.role), peutVoirSimulateur(authUser.profileType))} replace /> : publicScreen('login')}
      />
      <Route
        path={PUBLIC_PATHS.register}
        element={authUser ? <Navigate to={homePath(areaForRole(authUser.role), peutVoirSimulateur(authUser.profileType))} replace /> : publicScreen('register')}
      />

      {/*
        Tout le reste. Authentifié : l'espace connecté, qui résout lui-même
        l'URL en écran et rend une 404 si elle ne désigne rien. Non
        authentifié : l'accueil public à la racine, et une redirection vers la
        connexion ailleurs — en mémorisant la destination pour y revenir.
      */}
      <Route
        path="/*"
        element={
          authUser
            ? authenticatedArea()
            : location.pathname === '/'
              ? publicScreen('welcome')
              : <Navigate to={PUBLIC_PATHS.login} state={{ from: location.pathname + location.search }} replace />
        }
      />
    </Routes>
  );
}
