/**
 * chantierStateContext — chantier du dossier sélectionné.
 *
 * La source de vérité est l'API Laravel : `GET /client/mon-chantier` pour un
 * client, `GET /staff/chantiers/{client}` pour le personnel CPI. La clé
 * `cpi_chantier_all_state_v3` a disparu — plus aucun état de chantier n'est
 * persisté dans le navigateur.
 *
 * Une ligne de chantier existe pour TOUT dossier (provisionnée à l'ouverture) :
 * l'écran a donc toujours quelque chose à afficher, « non démarré » à 0 % tant
 * que les travaux n'ont pas commencé. `hasChantier` dit si la construction est
 * réellement lancée — c'est ce qui décide l'entrée de menu « Mon chantier ».
 *
 * Le journal d'activité vient de /staff/historique : chaque contrôleur de l'API
 * écrit son entrée via Spatie Activity Log. Rien n'est plus journalisé depuis le
 * navigateur — le serveur est la seule source de vérité.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  clientApi, staffApi,
  type ChantierData, type ChantierTrancheData, type ChantierPublicationData,
  type ChantierMediaData, type ChantierEventData,
  type ChantierStatut, type ChantierTrancheEtat, type PublicationType,
  type CalendarEventType, type CalendarEventStatut, type ChantierMediaType,
} from '../api/endpoints';
import { apiErrorMessage, SILENCIEUX } from '../api/client';
import { toast } from 'sonner';
import { usePermission } from '../auth/PermissionContext';
import {
  HISTORIQUE_QUERY_KEY, propertyNumber, toActivityEntries, useHistoriqueQuery,
} from './activityLog';
import { useClientContext } from '../contexts/ClientContext';

// ─── Types ────────────────────────────────────────────────────────────────────
// Les énumérations sont réexportées depuis la couche API : une seule définition
// pour les valeurs que le serveur valide, deux chemins d'import pour les
// consommateurs existants.

export type {
  ChantierStatut, ChantierTrancheEtat, PublicationType,
  CalendarEventType, CalendarEventStatut, ChantierMediaType,
};

export interface ChantierTranche {
  num: number;
  label: string;
  description: string;
  pct: number;
  etat: ChantierTrancheEtat;
  date?: string;
  comment?: string;
}

export interface ChantierPublication {
  id: string;
  phase: number;
  titre: string;
  description: string;
  date: string;
  heure: string;
  auteur: string;
  type: PublicationType;
  visibleClient: boolean;
}

export interface ChantierMedia {
  id: string;
  type: ChantierMediaType;
  titre: string;
  description: string;
  date: string;
  phase: number;
  auteur: string;
  /** Lien signé de courte durée vers le fichier (bucket privé), '' si absent. */
  url: string;
  bg?: string;
  visibleClient: boolean;
}

export interface CalendarEvent {
  id: string;
  titre: string;
  type: CalendarEventType;
  date: string;
  heure?: string;
  description: string;
  statut: CalendarEventStatut;
  visibleClient: boolean;
}

export interface ChantierHistoryEntry {
  id: string;
  date: string;
  heure: string;
  auteur: string;
  role: string;
  action: string;
  phase?: number;
  ancienneValeur?: string;
  nouvelleValeur?: string;
}

export interface ChantierInfo {
  id: string;
  clientId: string;
  client: string;
  projet: string;
  reference: string;
  localisation: string;
  chefChantier: string;
  entreprise: string;
  /** Dates affichées en toutes lettres (« 15 mars 2027 ») ou « — ». */
  dateDebut: string;
  dateLivraison: string;
  /** Mêmes dates au format AAAA-MM-JJ, pour les `<input type="date">` et l'API. */
  dateDebutIso: string;
  dateLivraisonIso: string;
  progression: number;
  etapeActuelle: string;
  statut: ChantierStatut;
  derniereMAJ: string;
}

// ─── Context interface ────────────────────────────────────────────────────────

interface ChantierStateCtx {
  chantierInfo: ChantierInfo;
  tranches: ChantierTranche[];
  publications: ChantierPublication[];
  medias: ChantierMedia[];
  events: CalendarEvent[];
  chantierHistory: ChantierHistoryEntry[];
  updateProgression: (pct: number, agentName: string, role?: string, onOk?: () => void) => void;
  updateEtape: (etape: string, agentName: string, onOk?: () => void) => void;
  updateStatut: (statut: ChantierStatut, agentName: string, onOk?: () => void) => void;
  /** `date` au format ISO (AAAA-MM-JJ) — l'API valide une vraie date. */
  updateLivraison: (date: string, agentName: string, onOk?: () => void) => void;
  validateTranche: (trancheNum: number, agentName: string, onOk?: () => void) => void;
  addTrancheComment: (trancheNum: number, comment: string, agentName: string, onOk?: () => void) => void;
  addPublication: (pub: Omit<ChantierPublication, 'id' | 'date' | 'heure'>, agentName: string, onOk?: () => void) => void;
  /** Le fichier est obligatoire : le média part sur le stockage privé CPI. */
  addMedia: (media: Omit<ChantierMedia, 'id' | 'date'>, agentName: string, file?: File, onOk?: () => void) => void;
  addEvent: (event: Omit<CalendarEvent, 'id'>, agentName: string, onOk?: () => void) => void;
  signalerRetard: (reason: string, jours: number, agentName: string) => void;
  /** La construction est-elle lancée ? (entrée de menu « Mon chantier ») */
  hasChantier: boolean;
  /** Chargement du chantier depuis l'API. */
  loading: boolean;
  /** Erreur de chargement (null si tout va bien). */
  error: string | null;
  /** Relance le chargement après une erreur. */
  retry: () => void;
}

const ChantierStateContext = createContext<ChantierStateCtx | null>(null);

// ─── Clés de cache TanStack Query ────────────────────────────────────────────

export const MON_CHANTIER_QUERY_KEY = ['client', 'mon-chantier'] as const;
export const CHANTIER_QUERY_KEY = ['staff', 'chantiers'] as const;

/** Clé d'un dossier : une mutation n'invalide que le chantier concerné. */
export const chantierQueryKey = (clientId: string) =>
  [...CHANTIER_QUERY_KEY, clientId] as const;

/** Chantier du client connecté — partagé avec l'écran de chargement d'AppShell. */
export function useMonChantierQuery(enabled: boolean): UseQueryResult<ChantierData> {
  return useQuery({
    queryKey: MON_CHANTIER_QUERY_KEY,
    queryFn: () => clientApi.monChantier(),
    enabled,
  });
}

// ─── Conversion DTO → état d'écran ───────────────────────────────────────────

const FR_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * L'API sérialise ses dates en « AAAA-MM-JJ HH:MM:SS ». L'espace n'est pas de
 * l'ISO 8601 : on le normalise avant de construire la Date, sinon l'analyse
 * dépend du moteur JS.
 */
function parseApiDate(value: string): Date {
  return new Date(value.includes(' ') ? value.replace(' ', 'T') : value);
}

/** Une date de l'API devient la date FR affichée par l'UI. */
function frDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = parseApiDate(value);
  return Number.isNaN(d.getTime()) ? value : FR_DATE.format(d);
}

/** Champ optionnel de l'API → tiret cadratin, la convention d'affichage CPI. */
const orDash = (value: string | null | undefined): string => value && value !== '' ? value : '—';

/** Propriété d'entrée de journal rendue affichable (avant/après d'un changement). */
function stringProperty(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'object' ? undefined : String(value);
}

/**
 * Date de l'API → AAAA-MM-JJ, format attendu par l'API et `<input type="date">`.
 * On découpe la chaîne plutôt que de passer par toISOString(), qui décalerait
 * la date d'un jour pour tout navigateur hors UTC.
 */
export function toIsoDay(value: string | null | undefined): string {
  if (!value) return '';
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const d = parseApiDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function toInfo(data: ChantierData, clientName: string): ChantierInfo {
  return {
    id: data.id,
    clientId: data.clientId,
    client: clientName,
    projet: orDash(data.projet),
    reference: orDash(data.reference),
    localisation: orDash(data.localisation),
    chefChantier: orDash(data.chefChantier),
    entreprise: orDash(data.entreprise),
    dateDebut: orDash(frDay(data.dateDebut)),
    dateLivraison: orDash(frDay(data.dateLivraison)),
    dateDebutIso: toIsoDay(data.dateDebut),
    dateLivraisonIso: toIsoDay(data.dateLivraison),
    progression: data.progression,
    etapeActuelle: data.etapeActuelle,
    statut: data.statut as ChantierStatut,
    derniereMAJ: orDash(data.derniereMaj),
  };
}

function toTranche(t: ChantierTrancheData): ChantierTranche {
  return {
    num: t.num,
    label: t.label,
    description: t.description ?? '',
    pct: t.pct,
    etat: t.etat as ChantierTrancheEtat,
    date: frDay(t.date),
    comment: t.comment ?? undefined,
  };
}

function toPublication(p: ChantierPublicationData): ChantierPublication {
  return {
    id: p.id,
    phase: p.phase,
    titre: p.titre,
    description: p.description,
    date: frDay(p.date) ?? '—',
    heure: p.heure,
    auteur: p.auteur,
    type: p.type as PublicationType,
    visibleClient: p.visibleClient,
  };
}

function toMedia(m: ChantierMediaData): ChantierMedia {
  return {
    id: m.id,
    type: m.type as ChantierMediaType,
    titre: m.titre,
    description: m.description ?? '',
    date: frDay(m.date) ?? '—',
    phase: m.phase,
    auteur: m.auteur,
    // Bucket privé : `fileUrl` est un lien signé régénéré à chaque lecture.
    url: m.fileUrl ?? '',
    bg: m.bg ?? undefined,
    visibleClient: m.visibleClient,
  };
}

function toEvent(e: ChantierEventData): CalendarEvent {
  return {
    id: e.id,
    titre: e.titre,
    type: e.type as CalendarEventType,
    date: frDay(e.date) ?? '—',
    heure: e.heure ?? undefined,
    description: e.description,
    statut: e.statut as CalendarEventStatut,
    visibleClient: e.visibleClient,
  };
}

/** Chantier vide affichable le temps du chargement (jamais d'écran blanc). */
const emptyInfo = (clientId: string, clientName: string): ChantierInfo => ({
  id: '', clientId, client: clientName,
  projet: '—', reference: '—', localisation: '—',
  chefChantier: '—', entreprise: '—', dateDebut: '—', dateLivraison: '—',
  dateDebutIso: '', dateLivraisonIso: '',
  progression: 0, etapeActuelle: 'Non démarré', statut: 'non-demarre', derniereMAJ: '—',
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ChantierStateProvider({ children }: { children: React.ReactNode }) {
  const { selectedClientId, allClients } = useClientContext();
  const { role } = usePermission();
  const isStaff = role === 'agent-cpi' || role === 'super-admin';
  const isClient = role === 'client';
  const queryClient = useQueryClient();

  const clientName = allClients.find(c => c.id === selectedClientId)?.name ?? selectedClientId;

  // Client : son propre chantier. Personnel : celui du dossier sélectionné.
  const mienQuery = useMonChantierQuery(isClient);
  const staffQuery = useQuery({
    queryKey: chantierQueryKey(selectedClientId),
    queryFn: () => staffApi.chantiers.get(selectedClientId),
    enabled: isStaff && Boolean(selectedClientId) && selectedClientId !== 'c-none',
  });

  const source = isClient ? mienQuery : staffQuery;
  const data = source.data;

  // Le journal vient du serveur (/staff/historique) : chaque contrôleur y écrit
  // son entrée. Réservé au personnel — un client n'a pas accès à cette route.
  const historiqueQuery = useHistoriqueQuery(isStaff);
  const journal = useMemo(() => toActivityEntries(historiqueQuery.data), [historiqueQuery.data]);

  // ── Valeurs dérivées ───────────────────────────────────────────────────────

  const chantierInfo = useMemo(
    () => data ? toInfo(data, clientName) : emptyInfo(selectedClientId, clientName),
    [data, clientName, selectedClientId],
  );

  const publications = useMemo(() => (data?.publications ?? []).map(toPublication), [data]);
  const medias = useMemo(() => (data?.medias ?? []).map(toMedia), [data]);
  const events = useMemo(() => (data?.events ?? []).map(toEvent), [data]);

  /**
   * L'API ne sait pas écrire le commentaire d'une tranche : le STEP 9 n'expose
   * aucune route pour cela. Un commentaire de tranche est donc publié dans le
   * fil sous le type « commentaire », avec la phase de la tranche ; on le
   * raccroche ici à sa tranche pour que l'écran reste cohérent.
   */
  const tranches = useMemo(() => {
    const rows = (data?.tranches ?? []).map(toTranche);
    return rows.map(t => {
      if (t.comment) return t;
      const pub = publications.find(p => p.type === 'commentaire' && p.phase === t.num);
      return pub ? { ...t, comment: pub.titre || pub.description } : t;
    });
  }, [data, publications]);

  // Entrées « chantier » du dossier courant. Le rattachement se fait sur
  // l'identifiant du dossier, pas sur le nom : deux clients peuvent être
  // homonymes, et le serveur nous donne l'id.
  const chantierHistory = useMemo<ChantierHistoryEntry[]>(
    () => journal
      .filter(e => e.event?.startsWith('chantier-') && e.clientId === selectedClientId)
      .map(e => ({
        id: e.id, date: e.date, heure: e.heure, auteur: e.utilisateur,
        role: e.role, action: e.action,
        phase: propertyNumber(e, 'tranche'),
        ancienneValeur: stringProperty(e.properties?.ancienne ?? e.properties?.ancien),
        nouvelleValeur: stringProperty(e.properties?.nouvelle ?? e.properties?.nouveau),
      })),
    [journal, selectedClientId],
  );

  // Construction lancée : statut sorti de « non démarré », ou avancement entamé
  // par un agent qui n'aurait pas encore changé le statut.
  const hasChantier = chantierInfo.statut !== 'non-demarre' || chantierInfo.progression > 0;

  /**
   * Options de mutation. Le journal n'est plus tenu par le navigateur : chaque
   * contrôleur écrit son entrée côté serveur, on se contente donc de relire
   * l'historique une fois la mutation acceptée. Une action refusée n'y figure
   * jamais, puisque rien n'est écrit tant que le serveur n'a pas répondu.
   */
  const journaliseSiOk = (fallback: string, onOk?: () => void) => ({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HISTORIQUE_QUERY_KEY });
      // `onOk` n'est appelé que par le serveur. L'écran d'administration du
      // chantier annonçait « Avancement mis à jour » dès le clic, avant toute
      // réponse : sur un 409 de transition (« non démarré » → « livré »),
      // l'agent lisait donc une confirmation ET le refus, l'un sous l'autre.
      onOk?.();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, fallback)),
  });

  /** Rafraîchit le chantier après une mutation (les deux vues possibles). */
  const invalidateChantier = () => {
    void queryClient.invalidateQueries({ queryKey: chantierQueryKey(selectedClientId) });
    void queryClient.invalidateQueries({ queryKey: MON_CHANTIER_QUERY_KEY });
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const progressionMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; pct: number }) =>
      staffApi.chantiers.updateProgression(v.clientId, v.pct),
    onSuccess: invalidateChantier,
  });

  const etapeMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; etape: string }) =>
      staffApi.chantiers.updateEtape(v.clientId, v.etape),
    onSuccess: invalidateChantier,
  });

  const statutMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; statut: ChantierStatut }) =>
      staffApi.chantiers.updateStatut(v.clientId, v.statut),
    onSuccess: invalidateChantier,
  });

  const ficheMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; input: Parameters<typeof staffApi.chantiers.update>[1] }) =>
      staffApi.chantiers.update(v.clientId, v.input),
    onSuccess: invalidateChantier,
  });

  const trancheMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; num: number }) =>
      staffApi.chantiers.validateTranche(v.clientId, v.num),
    onSuccess: invalidateChantier,
  });

  const publicationMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; input: Parameters<typeof staffApi.chantiers.publications.create>[1] }) =>
      staffApi.chantiers.publications.create(v.clientId, v.input),
    onSuccess: invalidateChantier,
  });

  const mediaMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; file: File; input: Parameters<typeof staffApi.chantiers.medias.create>[2] }) =>
      staffApi.chantiers.medias.create(v.clientId, v.file, v.input),
    onSuccess: invalidateChantier,
  });

  const eventMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; input: Parameters<typeof staffApi.chantiers.events.create>[1] }) =>
      staffApi.chantiers.events.create(v.clientId, v.input),
    onSuccess: invalidateChantier,
  });

  // ── Actions exposées (mêmes signatures qu'avant l'API) ─────────────────────

  const updateProgression = (pct: number, agentName: string, role = 'Agent CPI', onOk?: () => void) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const ancienne = chantierInfo.progression;
    if (clamped === ancienne) return;
    progressionMutation.mutate({ clientId: selectedClientId, pct: clamped }, journaliseSiOk("La mise à jour de l'avancement a échoué.", onOk));
  };

  const updateEtape = (etape: string, agentName: string, onOk?: () => void) => {
    if (etape === chantierInfo.etapeActuelle) return;
    etapeMutation.mutate({ clientId: selectedClientId, etape }, journaliseSiOk("La mise à jour de l'étape a échoué.", onOk));
  };

  const updateStatut = (statut: ChantierStatut, agentName: string, onOk?: () => void) => {
    if (statut === chantierInfo.statut) return;
    statutMutation.mutate({ clientId: selectedClientId, statut }, journaliseSiOk('La mise à jour du statut a échoué.', onOk));
  };

  const updateLivraison = (livDate: string, agentName: string, onOk?: () => void) => {
    ficheMutation.mutate(
      { clientId: selectedClientId, input: { date_livraison: livDate || null } },
      journaliseSiOk('La mise à jour de la date de livraison a échoué.', onOk),
    );
  };

  const validateTranche = (trancheNum: number, agentName: string, onOk?: () => void) => {
    trancheMutation.mutate({ clientId: selectedClientId, num: trancheNum }, journaliseSiOk('La validation de la tranche a échoué.', onOk));
  };

  const addTrancheComment = (trancheNum: number, comment: string, agentName: string, onOk?: () => void) => {
    const texte = comment.trim();
    if (!texte) return;
    publicationMutation.mutate({
      clientId: selectedClientId,
      input: { phase: trancheNum, titre: texte, description: '', type: 'commentaire', visible_client: true },
    }, journaliseSiOk("L'enregistrement du commentaire a échoué.", onOk));
  };

  const addPublication = (pub: Omit<ChantierPublication, 'id' | 'date' | 'heure'>, agentName: string, onOk?: () => void) => {
    publicationMutation.mutate({
      clientId: selectedClientId,
      input: {
        phase: pub.phase, titre: pub.titre, description: pub.description,
        type: pub.type, visible_client: pub.visibleClient,
      },
    }, journaliseSiOk('La publication a échoué.', onOk));
  };

  const addMedia = (media: Omit<ChantierMedia, 'id' | 'date'>, agentName: string, file?: File, onOk?: () => void) => {
    if (!file) {
      toast.error('Sélectionnez une photo ou une vidéo à envoyer.');
      return;
    }
    mediaMutation.mutate({
      clientId: selectedClientId,
      file,
      input: {
        type: media.type, titre: media.titre, description: media.description,
        phase: media.phase, bg: media.bg ?? null, visible_client: media.visibleClient,
      },
    }, journaliseSiOk("L'envoi du média a échoué.", onOk));
  };

  const addEvent = (event: Omit<CalendarEvent, 'id'>, agentName: string, onOk?: () => void) => {
    eventMutation.mutate({
      clientId: selectedClientId,
      input: {
        titre: event.titre, type: event.type, date: event.date,
        heure: event.heure || null, description: event.description,
        statut: event.statut, visible_client: event.visibleClient,
      },
    }, journaliseSiOk("La planification de l'événement a échoué.", onOk));
  };

  const signalerRetard = (reason: string, jours: number, agentName: string) => {
    const libelle = `Retard signalé — ${jours} jour${jours > 1 ? 's' : ''}`;
    // Deux écritures enchaînées : le statut d'abord, la publication seulement si
    // le serveur l'a acceptée — sinon le fil annoncerait un retard non enregistré.
    statutMutation.mutate({ clientId: selectedClientId, statut: 'en-retard' }, {
      onSuccess: () => publicationMutation.mutate({
        clientId: selectedClientId,
        input: { phase: 0, titre: libelle, description: reason, type: 'retard', visible_client: true },
      }, journaliseSiOk('Le signalement du retard a échoué.')),
      onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Le signalement du retard a échoué.')),
    });
  };

  // ── État de chargement / erreur ────────────────────────────────────────────

  const loading = (isClient || isStaff) && source.isPending;
  const error = source.error
    ? apiErrorMessage(source.error, 'Impossible de charger le chantier de ce dossier.')
    : null;
  const retry = () => { void source.refetch(); };

  return (
    <ChantierStateContext.Provider value={{
      chantierInfo, tranches, publications, medias, events, chantierHistory,
      updateProgression, updateEtape, updateStatut, updateLivraison,
      validateTranche, addTrancheComment, addPublication, addMedia, addEvent, signalerRetard,
      hasChantier, loading, error, retry,
    }}>
      {children}
    </ChantierStateContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChantierState(): ChantierStateCtx {
  const ctx = useContext(ChantierStateContext);
  if (!ctx) throw new Error('useChantierState must be used within ChantierStateProvider');
  return ctx;
}
