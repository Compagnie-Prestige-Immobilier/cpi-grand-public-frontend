import { useState, useEffect, lazy, Suspense } from 'react';
import AuthPage from './components/AuthPage';
import OnboardingPage from './components/OnboardingPage';
import { PermissionProvider } from './auth/PermissionContext';
import type { Permission, UserRole as ApiUserRole } from './auth/permissions';
import { auth, type AuthPayload, type UserData } from './api/endpoints';
import { getToken, setToken, clearToken, UNAUTHENTICATED_EVENT } from './api/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// L'app authentifiée (dashboards, modules, graphiques Recharts) est chargée à la
// demande : la landing / connexion reste ultra-légère au premier chargement.
const AppShell = lazy(() => import('./components/AppShell'));

// Rôles « legacy » attendus par AppShell et les dashboards (pont Phase 2 —
// les phases 3+ brancheront les dashboards directement sur l'API).
export type UserRole = 'client-fonctionnaire' | 'client-public' | 'agent-cpi' | 'admin';

export interface AuthUser {
  role: UserRole;
  name: string;
  /** Identifiant de connexion (renvoyé par /auth/me). */
  email?: string;
  memberNumber?: string;
  clientId?: string;
  /** URL affichable de la photo de profil (lien signé R2 ou URL Google). */
  avatarUrl?: string | null;
}

export type AppPage = 'welcome' | 'login' | 'register' | 'terms' | 'dashboard';

/** Rôle Spatie (API) → rôle legacy attendu par les dashboards. */
function mapApiRole(role: ApiUserRole, profileType: string | null): UserRole {
  if (role === 'super-admin') return 'admin';
  if (role === 'agent-cpi') return 'agent-cpi';
  return profileType === 'fonctionnaire' ? 'client-fonctionnaire' : 'client-public';
}

/** Code OAuth présent quand Google redirige vers /auth/google/callback?code=… */
function googleCallbackCode(): string | null {
  if (window.location.pathname !== '/auth/google/callback') return null;
  return new URLSearchParams(window.location.search).get('code');
}

// Écran de transition pendant le chargement du chunk de l'espace connecté.
function AppLoader() {
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
  const [page, setPage] = useState<AppPage>('welcome');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [apiRole, setApiRole] = useState<ApiUserRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // Restauration de session (token présent) ou retour du callback Google.
  const [booting, setBooting] = useState(() => Boolean(getToken()) || googleCallbackCode() !== null);

  const applyAuth = (payload: AuthPayload) => {
    const u = payload.user;
    setApiRole(payload.role);
    setPermissions(payload.permissions as Permission[]);
    setNeedsOnboarding(u.needsOnboarding);
    setAuthUser({
      role: mapApiRole(payload.role, u.profileType),
      name: u.name,
      email: u.email,
      clientId: payload.role === 'client' ? (u.clientId ?? u.id) : undefined,
      avatarUrl: u.avatarUrl ?? null,
    });
    setPage('dashboard');
  };

  // Au montage : échange du code Google, ou restauration de session via /auth/me.
  useEffect(() => {
    const code = googleCallbackCode();
    if (!code && !getToken()) return;
    (async () => {
      try {
        if (code) {
          const payload = await auth.googleCallback(code);
          if (payload.token) setToken(payload.token);
          window.history.replaceState({}, '', '/');
          applyAuth(payload);
        } else {
          applyAuth(await auth.me());
        }
      } catch {
        clearToken();
        if (code) {
          window.history.replaceState({}, '', '/');
          setPage('login');
        }
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (payload: AuthPayload) => {
    if (payload.token) setToken(payload.token);
    applyAuth(payload);
  };

  const handleOnboardingComplete = (user: UserData) => {
    setNeedsOnboarding(false);
    setAuthUser(prev => prev ? {
      ...prev,
      // Le profil vient d'être renseigné : on recalcule le rôle du dashboard
      // (fonctionnaire vs public) à partir du profileType choisi.
      role: apiRole ? mapApiRole(apiRole, user.profileType) : prev.role,
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
    setPage('welcome');
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

  if (booting) return <AppLoader />;

  if (page === 'dashboard' && authUser) {
    // Les utilisateurs Google au profil incomplet doivent d'abord le compléter.
    if (needsOnboarding) {
      return (
        <OnboardingPage
          userName={authUser.name}
          onComplete={handleOnboardingComplete}
          onLogout={handleLogout}
        />
      );
    }
    return (
      <PermissionProvider role={apiRole} permissions={permissions}>
        <Suspense fallback={<AppLoader />}>
          <AppShell user={authUser} onLogout={handleLogout} />
        </Suspense>
      </PermissionProvider>
    );
  }

  return (
    <AuthPage
      page={page === 'dashboard' ? 'welcome' : page}
      onLogin={handleLogin}
      onNavigate={setPage}
    />
  );
}
