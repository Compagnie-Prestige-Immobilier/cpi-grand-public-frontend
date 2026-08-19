import api, { getToken, startImpersonation, stopImpersonation } from './client';

// Types générés depuis les DTOs backend (namespace global déclaré
// dans ./types/generated.d.ts — régénéré via `php artisan typescript:transform`).
export type UserData           = App.Dto.UserData;
export type ClientData         = App.Dto.ClientData;
export type DemandeData        = App.Dto.DemandeData;
export type RequisDocData      = App.Dto.RequisDocData;
export type CpiDocData         = App.Dto.CpiDocData;
export type BankData           = App.Dto.BankData;
export type BankAssignmentData = App.Dto.BankAssignmentData;
export type DecaissementData   = App.Dto.DecaissementData;
export type ChantierData             = App.Dto.ChantierData;
export type ChantierTrancheData      = App.Dto.ChantierTrancheData;
export type ChantierPublicationData  = App.Dto.ChantierPublicationData;
export type ChantierMediaData        = App.Dto.ChantierMediaData;
export type ChantierEventData        = App.Dto.ChantierEventData;
export type NotificationData         = App.Dto.NotificationData;
export type ActivityLogData          = App.Dto.ActivityLogData;
/** État du compte : voir backend/docs/statuts.md. */
export type StatutCompte             = App.Enums.StatutCompte;

/** Réponse paginée de GET /staff/clients (50 dossiers par page). */
export type PaginatedClients = Illuminate.LengthAwarePaginator<number, ClientData>;

/** Réponse paginée de GET /staff/historique (50 entrées de journal par page). */
export type PaginatedActivityLog = Illuminate.LengthAwarePaginator<number, ActivityLogData>;

/** Nom du rôle Spatie renvoyé par l'API. */
export type ApiRole = 'client' | 'agent-cpi' | 'super-admin';

/** Corps `data` renvoyé par /auth/login, /auth/register, /auth/me et le callback Google. */
export interface AuthPayload {
  user: UserData;
  role: ApiRole;
  permissions: string[];
  /** Présent sur login/register/callback, absent sur /auth/me. */
  token?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface OnboardingInput {
  phone: string;
  employer: string;
  profile_type: 'fonctionnaire' | 'prive' | 'autre';
  revenus: string;
}

// ─── Auth (endpoints Phase 2) ──────────────────────────────
export const auth = {
  /**
   * Fin de prise en main : révoque le jeton emprunté côté serveur, puis
   * restitue celui du membre du personnel.
   *
   * La révocation passe AVANT la restitution : elle a besoin du jeton emprunté
   * pour s'authentifier. Si elle échoue, on rend quand même la main — rester
   * bloqué dans le compte d'un client serait pire qu'un jeton orphelin, qui de
   * toute façon meurt avec la session suivante.
   */
  leaveImpersonation: async (): Promise<void> => {
    try {
      await api.post('/impersonate/leave');
    } finally {
      stopImpersonation();
    }
  },

  register: async (input: RegisterInput): Promise<AuthPayload> =>
    (await api.post('/auth/register', input)).data.data,

  login: async (input: { email: string; password: string }): Promise<AuthPayload> =>
    (await api.post('/auth/login', input)).data.data,

  /**
   * Déconnexion — révoque le jeton CÔTÉ SERVEUR.
   *
   * Le jeton est lu ici, de façon SYNCHRONE, et joint explicitement à la
   * requête. L'intercepteur d'axios, lui, ne s'exécute qu'à la microtâche
   * suivante : l'appelant avait le temps d'effacer le jeton entre-temps, la
   * requête partait sans en-tête `Authorization`, le serveur répondait 401 et
   * ne révoquait rien. Le jeton restait alors valable indéfiniment — vérifié :
   * après déconnexion, il ouvrait encore /auth/me et /client/profile.
   *
   * Passer l'en-tête ici rend la révocation indépendante de l'ordre des
   * opérations chez l'appelant : le bug ne peut pas revenir par un réagencement
   * de App.tsx.
   */
  logout: async (): Promise<void> => {
    const jeton = getToken();
    await api.post('/auth/logout', null, jeton
      ? { headers: { Authorization: `Bearer ${jeton}` } }
      : undefined);
  },

  me: async (): Promise<AuthPayload> =>
    (await api.get('/auth/me')).data.data,

  // Google OAuth
  googleRedirect: async (): Promise<string> =>
    (await api.get('/auth/google/redirect')).data.url,

  googleCallback: async (code: string): Promise<AuthPayload> =>
    (await api.post('/auth/google/callback', { code })).data.data,

  // Photo de profil (stockée sur R2, servie via `avatarUrl` signée)
  updateAvatar: async (file: File): Promise<UserData> => {
    const fd = new FormData();
    fd.append('file', file);
    return (await api.post('/auth/avatar', fd)).data.data;
  },

  removeAvatar: async (): Promise<UserData> =>
    (await api.delete('/auth/avatar')).data.data,

  // Onboarding (utilisateurs Google au profil incomplet)
  completeOnboarding: async (input: OnboardingInput): Promise<UserData> =>
    (await api.post('/auth/onboarding', input)).data.data.user,

  onboardingStatus: async (): Promise<boolean> =>
    (await api.get('/auth/onboarding-status')).data.data.needsOnboarding,

  /** Renvoie le lien de vérification d'adresse (limité en fréquence côté serveur). */
  resendVerificationEmail: async (): Promise<void> => {
    await api.post('/auth/email/resend');
  },

  /**
   * Corrige les informations d'un compte REFUSÉ et le resoumet à validation.
   * Le serveur refuse (409) si le compte n'est pas au statut « refusé » —
   * ce n'est pas un simple PATCH de profil.
   */
  updateMonCompte: async (input: {
    name?: string; phone?: string | null; employer?: string | null;
    profile_type?: 'fonctionnaire' | 'prive' | 'autre' | null; revenus?: string | null;
  }): Promise<AuthPayload> =>
    (await api.put('/auth/mon-compte', input)).data.data,
};

// ─── Parcours du dossier (calculé côté serveur) ────────────
/**
 * Étape du parcours renvoyée par /client/mon-dossier-journey et
 * /staff/clients/{id}/dossier-journey. Le backend est la source de vérité :
 * plus aucun calcul local (cf. ClientController::computeJourneyStep).
 */
export interface DossierJourney {
  /** Index 0-5 de l'étape en cours dans les 6 étapes du parcours. */
  step: number;
  /** La demande de financement a-t-elle été envoyée ? */
  submitted: boolean;
  /** Signal de progression piloté par l'Agent CPI (0-5). */
  dossierEtape: number;
}

// ─── Entrées (corps de requête, en snake_case comme l'API) ──

export interface ClientProfileInput {
  name?: string;
  phone?: string | null;
  adresse?: string | null;
  employer?: string | null;
  fonction?: string | null;
  project_nom?: string | null;
}

export interface DemandeInput {
  type_projet?: string;
  nature_projet?: string;
  montant?: number | null;
  duree?: string;
  apport?: number;
  region?: string;
  commune?: string | null;
  adresse_projet?: string | null;
  description?: string | null;
}

export interface ClientCreateInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  adresse?: string | null;
  project_nom?: string | null;
  employer?: string | null;
  fonction?: string | null;
  conseiller?: string | null;
  banque?: string | null;
  statut?: string | null;
}

export interface ClientUpdateInput extends Partial<ClientCreateInput> {
  progression?: number;
}

export interface CpiDocCreateInput {
  client_id: string;
  categorie: string;
  nom: string;
  reference?: string | null;
  version?: string;
  commentaire?: string | null;
  fichier?: string | null;
  visible_client?: boolean;
  signature_requise?: boolean;
  taille?: string | null;
  format?: string | null;
}

export type CpiDocUpdateInput = Partial<Omit<CpiDocCreateInput, 'client_id'>>;

export interface StaffCreateInput {
  name: string;
  email: string;
  role: 'agent-cpi' | 'super-admin';
}

/** Réponse d'une banque à l'orientation d'un dossier. */
export type BankAssignmentStatus = 'en-attente' | 'accord' | 'refus';

export interface BankCreateInput {
  name: string;
  convention_date?: string | null;
  validity?: string | null;
  products?: string[];
  rate?: string | null;
  contact?: string | null;
  color?: string;
}

export type BankUpdateInput = Partial<BankCreateInput>;

/** Une tranche de construction telle qu'elle est stockée dans la colonne JSON. */
export interface DecaissementTrancheInput {
  validated: boolean;
  date?: string | null;
  comment?: string | null;
}

export interface DecaissementUpdateInput {
  terrain_montant?: number;
  terrain_decaisse?: boolean;
  terrain_date?: string | null;
  foncier?: boolean[];
  construction_active?: boolean;
  construction_montant?: number;
  tranches?: DecaissementTrancheInput[];
}

// ─── Chantier ──────────────────────────────────────────────
// Les valeurs ci-dessous sont celles que l'API valide (Chantier::STATUTS et les
// constantes TYPES/STATUTS des contrôleurs imbriqués) : les garder alignées est
// la seule façon d'éviter des 422 silencieux.

export type ChantierStatut =
  | 'non-demarre' | 'en-cours' | 'suspendu'
  | 'en-retard' | 'termine' | 'livre';

export type ChantierTrancheEtat = 'en-attente' | 'en-cours' | 'terminee';

export type PublicationType =
  | 'actualite' | 'photo' | 'video' | 'document'
  | 'commentaire' | 'etape-validee' | 'retard' | 'visite';

export type ChantierMediaType = 'photo' | 'video';

export type CalendarEventType =
  | 'visite' | 'inspection' | 'livraison-materiaux'
  | 'debut-etape' | 'fin-etape' | 'rdv-client' | 'reception' | 'remise-cles';

export type CalendarEventStatut = 'prevu' | 'confirme' | 'realise' | 'reporte' | 'annule';

/** Fiche du chantier — PUT /staff/chantiers/{client}. */
export interface ChantierUpdateInput {
  projet?: string | null;
  reference?: string | null;
  localisation?: string | null;
  chef_chantier?: string | null;
  entreprise?: string | null;
  /** Date ISO (AAAA-MM-JJ) — l'API valide `date`. */
  date_debut?: string | null;
  date_livraison?: string | null;
  progression?: number;
  etape_actuelle?: string;
  statut?: ChantierStatut;
}

export interface ChantierPublicationCreateInput {
  phase: number;
  titre: string;
  description?: string | null;
  type: PublicationType;
  visible_client?: boolean;
}

export type ChantierPublicationUpdateInput = Partial<ChantierPublicationCreateInput>;

/** Métadonnées d'un média ; le fichier voyage à part (multipart). */
export interface ChantierMediaCreateInput {
  type: ChantierMediaType;
  titre: string;
  description?: string | null;
  phase: number;
  bg?: string | null;
  visible_client?: boolean;
}

/** Le fichier ne se remplace pas : on redépose un média. */
export type ChantierMediaUpdateInput = Partial<ChantierMediaCreateInput>;

export interface ChantierEventCreateInput {
  titre: string;
  type: CalendarEventType;
  /** Date ISO (AAAA-MM-JJ). */
  date: string;
  heure?: string | null;
  description?: string | null;
  statut?: CalendarEventStatut;
  visible_client?: boolean;
}

export type ChantierEventUpdateInput = Partial<ChantierEventCreateInput>;

/** Compte pro créé : le mot de passe provisoire n'est renvoyé qu'une seule fois. */
export interface StaffCreated {
  user: UserData;
  temporaryPassword: string;
}

// ─── Notifications ─────────────────────────────────────────

/**
 * Corps de POST /staff/notifications/send. `date` et `heure` sont posées par
 * le serveur — l'heure du poste émetteur n'a rien à faire dans la boîte du
 * destinataire.
 */
export interface NotificationSendInput {
  client_id: string;
  titre: string;
  message: string;
  /** Famille d'affichage côté client : info / action / validation / alerte. */
  type: NotificationType;
  /** Page vers laquelle naviguer au clic sur la notification. */
  target_page?: string | null;
  /** Sous-section / identifiant d'élément dans la page cible. */
  target_sub?: string | null;
}

/** Familles de notifications que l'interface sait mettre en forme. */
export type NotificationType = 'info' | 'action' | 'validation' | 'alerte';

// ─── Statistiques (GET /staff/stats/*) ─────────────────────
// Ces routes ne renvoient pas de DTO : leurs formes sont décrites ici, comme
// pour DossierJourney et ClientSummaryData. Elles doivent rester alignées sur
// StatsController::agentStats() / adminStats().

/** Inscriptions récentes — fenêtres du sélecteur de période « Rapports ». */
export interface NouveauxClientsStats {
  mois3: number;
  mois6: number;
  mois12: number;
  total: number;
}

/** Portefeuille de dossiers — GET /staff/stats/agent. */
export interface AgentStats {
  clients: { total: number; avecCompte: number; nouveaux: NouveauxClientsStats };
  dossiers: {
    /** Six cases, index 0-5, alignées sur TIMELINE_STEPS. */
    parEtape: number[];
    finalises: number;
    enCours: number;
    nonSoumis: number;
    tauxFinalisation: number;
    avecPiecesAVerifier: number;
    avecDocsASigner: number;
  };
  documents: {
    total: number; enAttente: number; deposes: number; verification: number;
    aRemplacer: number; acceptes: number; refuses: number; aVerifier: number;
  };
  cpiDocs: {
    total: number; brouillons: number; disponibles: number;
    aSigner: number; signes: number; archives: number;
  };
  chantiers: {
    total: number; nonDemarres: number; enCours: number; enRetard: number;
    suspendus: number; termines: number; progressionMoyenne: number;
    tranchesTerminees: number;
  };
  notifications: { total: number; nonLues: number };
}

/** Totaux de la plateforme — GET /staff/stats/admin (super-admin uniquement). */
export interface AdminStats {
  utilisateurs: { total: number; clients: number; agents: number; admins: number };
  clients: { total: number; sansCompte: number };
  banques: { total: number; orientations: number; enAttente: number; accords: number; refus: number };
  decaissements: {
    terrainsDecaisses: number; montantTerrain: number;
    constructionsActives: number; montantConstruction: number;
  };
  activite: {
    total: number;
    derniers7Jours: number;
    /** Dix événements les plus fréquents du journal, du plus au moins courant. */
    parEvenement: Record<string, number>;
  };
  notifications: { total: number; nonLues: number };
}

/**
 * GET /staff/stats/dashboard — un seul appel alimente l'écran quel que soit le
 * rôle : `admin` vaut null pour un agent CPI (permission `view-stats`).
 */
export interface DashboardStats {
  role: ApiRole | null;
  genereLe: string;
  agent: AgentStats;
  admin: AdminStats | null;
}

// ─── Jeu de démonstration (/staff/demo) ────────────────────
// Réservé à l'administrateur (permission `manage-demo-data`) : un agent CPI
// reçoit 403. Toute ligne créée porte le préfixe « demo- » sur la colonne qui
// l'identifie (référence de dossier, e-mail de compte, nom de banque).

/** Préfixe des références de dossier fictives — cf. DemoDataService::PREFIX. */
export const DEMO_REF_PREFIX = 'demo-';

/** Bilan d'un chargement — POST /staff/demo/seed. */
export interface DemoSeedResult {
  /** Dossiers fictifs créés (30). */
  clients: number;
  /** Comptes de connexion créés, un par dossier. */
  comptes: number;
  /** Banques partenaires fictives créées. */
  banques: number;
  /**
   * Mot de passe commun aux comptes de démonstration, renvoyé par le serveur.
   * Volontairement trivial : ces comptes n'existent que pour visiter la
   * plateforme. Aucun mot de passe de vrai compte n'est jamais exposé.
   */
  motDePasse: string;
}

/** Bilan d'une purge — DELETE /staff/demo/clear. */
export interface DemoClearResult {
  clients: number;
  comptes: number;
  banques: number;
  /** Entrées du journal d'activité rattachées à la démonstration. */
  entreesJournal: number;
}

/** Corps allégé de GET /staff/clients/{id}/summary (barres latérales). */
export interface ClientSummaryData {
  id: string;
  name: string;
  ref: string;
  statut: string;
  progression: number;
  projectNom: string | null;
  adresse: string | null;
  dossierEtape: number;
}

// ─── Client (self-service, préfixe /client) ────────────────
export const clientApi = {
  profile: async (): Promise<ClientData> =>
    (await api.get('/client/profile')).data.data,

  updateProfile: async (input: ClientProfileInput): Promise<ClientData> =>
    (await api.put('/client/profile', input)).data.data,

  /** Demande d'assistance — part par courriel vers la boîte du support CPI. */
  envoyerDemandeSupport: async (input: { sujet: string; message: string }): Promise<void> => {
    await api.post('/client/support', input);
  },

  maDemande: async (): Promise<DemandeData | null> =>
    (await api.get('/client/ma-demande')).data.data,

  saveMaDemande: async (input: DemandeInput): Promise<DemandeData> =>
    (await api.post('/client/ma-demande', input)).data.data,

  submitMaDemande: async (): Promise<DemandeData> =>
    (await api.post('/client/ma-demande/submit')).data.data,

  /**
   * Récapitulatif PDF du dossier.
   *
   * Passe par axios plutôt que par un `<a href>` : la route exige le jeton
   * Sanctum, qu'un lien ordinaire n'enverrait pas (le navigateur ne connaît que
   * les cookies). On récupère donc le binaire puis on déclenche la sauvegarde
   * localement. L'URL objet est révoquée aussitôt, sinon le blob resterait en
   * mémoire jusqu'au rechargement de la page.
   */
  telechargerRecapitulatif: async (): Promise<void> => {
    const reponse = await api.get('/client/ma-demande/recapitulatif', { responseType: 'blob' });

    const nom = /filename="?([^";]+)"?/.exec(reponse.headers['content-disposition'] ?? '')?.[1]
      ?? 'recapitulatif.pdf';

    const url = URL.createObjectURL(reponse.data as Blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
  },

  mesDocuments: async (): Promise<RequisDocData[]> =>
    (await api.get('/client/mes-documents')).data.data,

  /** Dépôt d'une pièce (multipart, champ `file`, 10 Mo max, pdf/jpg/png/webp). */
  depositDoc: async (docId: string, file: File): Promise<RequisDocData> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post(`/client/mes-documents/${docId}/deposit`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  mesDocumentsCpi: async (): Promise<CpiDocData[]> =>
    (await api.get('/client/mes-documents-cpi')).data.data,

  signCpiDoc: async (docId: string): Promise<CpiDocData> =>
    (await api.post(`/client/mes-documents-cpi/${docId}/sign`)).data.data,

  monDossierJourney: async (): Promise<DossierJourney> =>
    (await api.get('/client/mon-dossier-journey')).data.data,

  /** Orientations bancaires du dossier connecté (jamais celles d'un tiers). */
  mesBanques: async (): Promise<BankAssignmentData[]> =>
    (await api.get('/client/mes-banques')).data.data,

  /**
   * Chantier du dossier connecté. Toujours présent (provisionné à l'ouverture
   * du dossier) : « non démarré » à 0 % tant que les travaux n'ont pas commencé.
   * Seuls les contenus marqués « visible client » y figurent, et les médias
   * n'arrivent que sous forme d'URL signée de courte durée (`fileUrl`).
   */
  monChantier: async (): Promise<ChantierData> =>
    (await api.get('/client/mon-chantier')).data.data,

  /**
   * Boîte de notifications du dossier connecté, la plus récente en tête.
   * Ne peut structurellement contenir que les siennes (bornée côté serveur).
   */
  notifications: async (): Promise<NotificationData[]> =>
    (await api.get('/client/notifications')).data.data,

  /** Marque une notification lue — 403 si elle appartient à un autre dossier. */
  markNotificationRead: async (id: string): Promise<NotificationData> =>
    (await api.post(`/client/notifications/${id}/read`)).data.data,
};

// ─── Staff (gestion, préfixe /staff) ───────────────────────

/** Une page de /staff/clients — chaque ClientData embarque demande + requisDocs. */
const listClientsPage = async (page = 1): Promise<PaginatedClients> =>
  (await api.get('/staff/clients', { params: { page } })).data;

/** Une page de /staff/historique (journal global, 50 entrées par page). */
const listHistoriquePage = async (page = 1): Promise<PaginatedActivityLog> =>
  (await api.get('/staff/historique', { params: { page } })).data;

export const staffApi = {
  // L'identité du staff vient de auth.me() — il n'existe pas de /staff/me.

  /** Comptes du personnel CPI (administrateur uniquement). */
  staff: {
    list: async (): Promise<UserData[]> =>
      (await api.get('/staff/staff/list')).data.data,

    create: async (input: StaffCreateInput): Promise<StaffCreated> => {
      const body = (await api.post('/staff/staff/create', input)).data;
      return { user: body.data, temporaryPassword: body.temporary_password };
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`/staff/staff/${id}`);
    },
  },

  /**
   * Prise en main du compte d'un client.
   *
   * Le serveur ne renvoie PAS un changement de session mais un second jeton,
   * celui du client. Le jeton du personnel est mis de côté par
   * `startImpersonation` pour être restitué à la sortie.
   *
   * Le serveur l'autorise aux agents comme aux administrateurs ; c'est
   * l'interface qui, pour l'instant, ne propose le bouton qu'aux
   * administrateurs. Le serveur refuse toute cible qui n'est pas un client.
   */
  impersonate: async (userId: string): Promise<UserData> => {
    const { token, user } = (await api.post(`/staff/impersonate/${userId}`)).data.data;
    startImpersonation(token);
    return user;
  },

  clients: {
    list: listClientsPage,

    /** Registre complet : parcourt toutes les pages (50 dossiers par page). */
    listAll: async (): Promise<ClientData[]> => {
      const first = await listClientsPage(1);
      const all = [...first.data];
      for (let page = 2; page <= first.meta.last_page; page++) {
        all.push(...(await listClientsPage(page)).data);
      }
      return all;
    },

    get: async (id: string): Promise<ClientData> =>
      (await api.get(`/staff/clients/${id}`)).data.data,

    create: async (input: ClientCreateInput): Promise<ClientData> =>
      (await api.post('/staff/clients', input)).data.data,

    update: async (id: string, input: ClientUpdateInput): Promise<ClientData> =>
      (await api.put(`/staff/clients/${id}`, input)).data.data,

    delete: async (id: string): Promise<void> => {
      await api.delete(`/staff/clients/${id}`);
    },

    /**
     * Correction de la demande d'un client par le personnel.
     *
     * Le client perd la main à partir de l'étape « Analyse » ; l'agent la garde
     * pour corriger une coquille repérée après coup. Chaque correction est
     * journalisée (ancien/nouveau) et notifiée au client côté serveur.
     */
    updateDemande: async (id: string, input: DemandeInput): Promise<DemandeData> =>
      (await api.put(`/staff/clients/${id}/demande`, input)).data.data,

    summary: async (id: string): Promise<ClientSummaryData> =>
      (await api.get(`/staff/clients/${id}/summary`)).data.data,

    dossierJourney: async (id: string): Promise<DossierJourney> =>
      (await api.get(`/staff/clients/${id}/dossier-journey`)).data.data,

    setDossierEtape: async (id: string, etape: number): Promise<ClientData> =>
      (await api.post(`/staff/clients/${id}/dossier-etape`, { etape })).data.data,
  },

  /** Pièces requises d'un dossier client. */
  docs: {
    list: async (clientId: string): Promise<RequisDocData[]> =>
      (await api.get(`/staff/clients/${clientId}/docs`)).data.data,

    accept: async (clientId: string, docId: string): Promise<RequisDocData> =>
      (await api.post(`/staff/clients/${clientId}/docs/${docId}/accept`)).data.data,

    refuse: async (clientId: string, docId: string, comment: string): Promise<RequisDocData> =>
      (await api.post(`/staff/clients/${clientId}/docs/${docId}/refuse`, { comment })).data.data,

    requestReplacement: async (clientId: string, docId: string, comment: string): Promise<RequisDocData> =>
      (await api.post(`/staff/clients/${clientId}/docs/${docId}/replace`, { comment })).data.data,

    remettreVerification: async (clientId: string, docId: string): Promise<RequisDocData> =>
      (await api.post(`/staff/clients/${clientId}/docs/${docId}/verify`)).data.data,
  },

  /** Documents produits par le CPI (contrats, conventions, courriers…). */
  cpiDocs: {
    /** Sans `clientId` : tous les documents, à regrouper côté client. */
    list: async (clientId?: string): Promise<CpiDocData[]> =>
      (await api.get('/staff/cpi-docs', { params: clientId ? { client_id: clientId } : undefined })).data.data,

    create: async (input: CpiDocCreateInput): Promise<CpiDocData> =>
      (await api.post('/staff/cpi-docs', input)).data.data,

    update: async (id: string, input: CpiDocUpdateInput): Promise<CpiDocData> =>
      (await api.put(`/staff/cpi-docs/${id}`, input)).data.data,

    /**
     * Dépose le fichier réel du document (R2 privé, servi via `fileUrl` signée).
     *
     * `onProgress` reçoit l'avancement réel du transfert. Les écrans affichaient
     * jusqu'ici une barre animée par `Math.random()`, sans aucun lien avec ce
     * qui partait effectivement sur le réseau.
     */
    upload: async (
      id: string,
      file: File,
      onProgress?: (pourcent: number) => void,
    ): Promise<CpiDocData> => {
      const fd = new FormData();
      fd.append('file', file);
      return (await api.post(`/staff/cpi-docs/${id}/upload`, fd, {
        onUploadProgress: e => {
          if (!onProgress) return;
          // `total` est absent si le serveur ne renvoie pas la taille : on ne
          // fabrique pas de pourcentage dans ce cas.
          if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })).data.data;
    },

    /** Réservé au super-admin (403 pour un agent CPI). */
    delete: async (id: string): Promise<void> => {
      await api.delete(`/staff/cpi-docs/${id}`);
    },

    publish: async (id: string): Promise<CpiDocData> =>
      (await api.post(`/staff/cpi-docs/${id}/publish`)).data.data,

    archive: async (id: string): Promise<CpiDocData> =>
      (await api.post(`/staff/cpi-docs/${id}/archive`)).data.data,

    sign: async (id: string): Promise<CpiDocData> =>
      (await api.post(`/staff/cpi-docs/${id}/sign`)).data.data,
  },

  /**
   * Banques partenaires. `list()` renvoie chaque banque avec ses orientations
   * (`assignments`) : il n'existe pas de route « toutes les orientations », la
   * carte des dossiers orientés se reconstitue à partir de cette réponse.
   * Créer / modifier / supprimer une banque est réservé à l'administrateur.
   */
  banks: {
    list: async (): Promise<BankData[]> =>
      (await api.get('/staff/banks')).data.data,

    create: async (input: BankCreateInput): Promise<BankData> =>
      (await api.post('/staff/banks', input)).data.data,

    update: async (id: string, input: BankUpdateInput): Promise<BankData> =>
      (await api.put(`/staff/banks/${id}`, input)).data.data,

    delete: async (id: string): Promise<void> => {
      await api.delete(`/staff/banks/${id}`);
    },

    /** Idempotent : ré-orienter un dossier ne crée pas de doublon. */
    assign: async (clientId: string, bankId: string): Promise<BankAssignmentData> =>
      (await api.post(`/staff/clients/${clientId}/banks/${bankId}/assign`)).data.data,

    setStatus: async (clientId: string, bankId: string, status: BankAssignmentStatus): Promise<BankAssignmentData> =>
      (await api.post(`/staff/clients/${clientId}/banks/${bankId}/status`, { status })).data.data,

    removeAssignment: async (clientId: string, bankId: string): Promise<void> => {
      await api.delete(`/staff/clients/${clientId}/banks/${bankId}`);
    },
  },

  /**
   * Décaissements bancaires d'un dossier. `step` et `num` sont les index des
   * tableaux JSON `foncier` (0-4) et `tranches` (0-3) — base 0.
   */
  decaissements: {
    get: async (clientId: string): Promise<DecaissementData> =>
      (await api.get(`/staff/decaissements/${clientId}`)).data.data,

    update: async (clientId: string, input: DecaissementUpdateInput): Promise<DecaissementData> =>
      (await api.put(`/staff/decaissements/${clientId}`, input)).data.data,

    validateTerrain: async (clientId: string): Promise<DecaissementData> =>
      (await api.post(`/staff/decaissements/${clientId}/validate-terrain`)).data.data,

    validateFoncierStep: async (clientId: string, step: number): Promise<DecaissementData> =>
      (await api.post(`/staff/decaissements/${clientId}/validate-foncier/${step}`)).data.data,

    validateTranche: async (clientId: string, num: number): Promise<DecaissementData> =>
      (await api.post(`/staff/decaissements/${clientId}/validate-tranche/${num}`)).data.data,
  },

  /**
   * Chantier d'un dossier : avancement des TRAVAUX (le décaissement, lui, suit
   * les versements bancaires). `get` renvoie le chantier avec ses tranches,
   * publications, médias et événements — un seul appel alimente tout l'écran.
   *
   * Attention : `num` est ici le NUMÉRO de la tranche (T1…T4, base 1), alors
   * que les tranches de décaissement sont indexées à partir de 0.
   */
  chantiers: {
    get: async (clientId: string): Promise<ChantierData> =>
      (await api.get(`/staff/chantiers/${clientId}`)).data.data,

    update: async (clientId: string, input: ChantierUpdateInput): Promise<ChantierData> =>
      (await api.put(`/staff/chantiers/${clientId}`, input)).data.data,

    updateProgression: async (clientId: string, pct: number): Promise<ChantierData> =>
      (await api.post(`/staff/chantiers/${clientId}/progression`, { pct })).data.data,

    updateEtape: async (clientId: string, etape: string): Promise<ChantierData> =>
      (await api.post(`/staff/chantiers/${clientId}/etape`, { etape })).data.data,

    updateStatut: async (clientId: string, statut: ChantierStatut): Promise<ChantierData> =>
      (await api.post(`/staff/chantiers/${clientId}/statut`, { statut })).data.data,

    validateTranche: async (clientId: string, num: number): Promise<ChantierData> =>
      (await api.post(`/staff/chantiers/${clientId}/tranche/${num}/validate`)).data.data,

    /** Fil de chantier — les publications internes ne sortent que côté staff. */
    publications: {
      list: async (clientId: string): Promise<ChantierPublicationData[]> =>
        (await api.get(`/staff/chantiers/${clientId}/publications`)).data.data,

      create: async (clientId: string, input: ChantierPublicationCreateInput): Promise<ChantierPublicationData> =>
        (await api.post(`/staff/chantiers/${clientId}/publications`, input)).data.data,

      update: async (clientId: string, id: string, input: ChantierPublicationUpdateInput): Promise<ChantierPublicationData> =>
        (await api.put(`/staff/chantiers/${clientId}/publications/${id}`, input)).data.data,

      delete: async (clientId: string, id: string): Promise<void> => {
        await api.delete(`/staff/chantiers/${clientId}/publications/${id}`);
      },
    },

    /**
     * Photos / vidéos. Le dépôt est multipart (champ `file`, 50 Mo max) et le
     * bucket est privé : la réponse ne contient jamais qu'un lien signé.
     */
    medias: {
      list: async (clientId: string): Promise<ChantierMediaData[]> =>
        (await api.get(`/staff/chantiers/${clientId}/medias`)).data.data,

      create: async (clientId: string, file: File, input: ChantierMediaCreateInput): Promise<ChantierMediaData> => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', input.type);
        fd.append('titre', input.titre);
        fd.append('phase', String(input.phase));
        if (input.description) fd.append('description', input.description);
        if (input.bg) fd.append('bg', input.bg);
        fd.append('visible_client', input.visible_client === false ? '0' : '1');
        const res = await api.post(`/staff/chantiers/${clientId}/medias`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.data;
      },

      update: async (clientId: string, id: string, input: ChantierMediaUpdateInput): Promise<ChantierMediaData> =>
        (await api.put(`/staff/chantiers/${clientId}/medias/${id}`, input)).data.data,

      delete: async (clientId: string, id: string): Promise<void> => {
        await api.delete(`/staff/chantiers/${clientId}/medias/${id}`);
      },
    },

    /** Calendrier de chantier (visites, inspections, réception…). */
    events: {
      list: async (clientId: string): Promise<ChantierEventData[]> =>
        (await api.get(`/staff/chantiers/${clientId}/events`)).data.data,

      create: async (clientId: string, input: ChantierEventCreateInput): Promise<ChantierEventData> =>
        (await api.post(`/staff/chantiers/${clientId}/events`, input)).data.data,

      update: async (clientId: string, id: string, input: ChantierEventUpdateInput): Promise<ChantierEventData> =>
        (await api.put(`/staff/chantiers/${clientId}/events/${id}`, input)).data.data,

      delete: async (clientId: string, id: string): Promise<void> => {
        await api.delete(`/staff/chantiers/${clientId}/events/${id}`);
      },
    },
  },

  /**
   * Notifications adressées aux dossiers clients. `list()` renvoie le flux
   * complet (toutes boîtes confondues) — c'est le journal des envois du
   * personnel CPI.
   */
  notifications: {
    list: async (): Promise<NotificationData[]> =>
      (await api.get('/staff/notifications')).data.data,

    send: async (input: NotificationSendInput): Promise<NotificationData> =>
      (await api.post('/staff/notifications/send', input)).data.data,
  },

  /**
   * Journal d'activité (Spatie Activity Log). En lecture seule : les entrées
   * naissent des mutations métier, jamais d'un appel direct. Le serveur est la
   * seule source de vérité de l'historique.
   */
  historique: {
    /** Une page du journal global (50 entrées, la plus récente en tête). */
    page: listHistoriquePage,

    /** Journal global complet : parcourt toutes les pages. */
    global: async (): Promise<ActivityLogData[]> => {
      const first = await listHistoriquePage(1);
      const all = [...first.data];
      for (let page = 2; page <= first.meta.last_page; page++) {
        all.push(...(await listHistoriquePage(page)).data);
      }
      return all;
    },

    /** Journal d'un seul dossier (non paginé). */
    forClient: async (clientId: string): Promise<ActivityLogData[]> =>
      (await api.get(`/staff/historique/${clientId}`)).data.data,
  },

  /**
   * Statistiques. `dashboard()` sert le bloc correspondant au rôle appelant —
   * `admin` y vaut null pour un agent CPI. `admin()` est réservé au super-admin
   * (permission `view-stats`) et répond 403 à un agent.
   */
  stats: {
    dashboard: async (): Promise<DashboardStats> =>
      (await api.get('/staff/stats/dashboard')).data.data,

    agent: async (): Promise<AgentStats> =>
      (await api.get('/staff/stats/agent')).data.data,

    admin: async (): Promise<AdminStats> =>
      (await api.get('/staff/stats/admin')).data.data,
  },

  /**
   * Jeu de démonstration (administrateur uniquement).
   *
   * `seed()` n'est PAS rejouable : tant que des dossiers fictifs subsistent, le
   * serveur répond 409 plutôt que de doubler le jeu. `clear()` est le seul
   * chemin de remise à zéro — il ne touche que les lignes préfixées « demo- ».
   */
  demo: {
    seed: async (): Promise<DemoSeedResult> =>
      (await api.post('/staff/demo/seed')).data.data,

    clear: async (): Promise<DemoClearResult> =>
      (await api.delete('/staff/demo/clear')).data.data,
  },
};
