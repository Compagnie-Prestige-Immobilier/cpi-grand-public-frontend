import React, { createContext, useContext, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { DocStatus } from './demoStore';
import { clientApi, staffApi, type RequisDocData } from '../api/endpoints';
import { apiErrorMessage, SILENCIEUX } from '../api/client';
import { toast } from 'sonner';
import { usePermission } from '../auth/PermissionContext';
import {
  CLIENTS_QUERY_KEY, MY_PROFILE_QUERY_KEY,
  useClientsQuery, useMyProfileQuery,
} from './clientRegistry';
import { JOURNEY_QUERY_KEY } from './dossierJourney';
import { useClientContext } from '../contexts/ClientContext';
import {
  HISTORIQUE_QUERY_KEY, groupByClient, isCpiDocEvent, toActivityEntries,
  useHistoriqueQuery, type ActivityEntry,
} from './activityLog';
import { notifDateLabel, notifTimestamp, useMesNotificationsQuery, useSendNotification } from './notifications';
import type { NotificationData } from '../api/endpoints';

// ─── Shared doc shape (live state) ───────────────────────────────────────────

export interface SharedDoc {
  id: string;
  label: string;
  status: DocStatus;
  commentaire?: string;
  dateValidation?: string;
  agentName?: string;
  version: number;
  submittedLabel?: string;
  date?: string;
  taille?: string;
  /** Lien signé de courte durée vers le fichier déposé (bucket privé). */
  fileUrl?: string;
}

// ─── Context interface ────────────────────────────────────────────────────────

interface DocStateCtx {
  requisDocs: SharedDoc[];
  /**
   * Journal du dossier sélectionné. Personnel CPI : les entrées serveur du
   * dossier (hors documents CPI, exposés par `cpiDocsContext`). Client : sa
   * boîte de notifications — il n'existe pas de route /client/historique, et
   * ses notifications sont la trace serveur qui le concerne.
   */
  history: ActivityEntry[];
  allDocsByClient: Record<string, SharedDoc[]>;
  allHistoryByClient: Record<string, ActivityEntry[]>;
  acceptDoc: (docId: string, agentName: string, clientId?: string, onOk?: () => void) => void;
  refuseDoc: (docId: string, agentName: string, comment: string, clientId?: string, onOk?: () => void) => void;
  requestReplacement: (docId: string, agentName: string, comment: string, clientId?: string, onOk?: () => void) => void;
  remettreVerification: (docId: string, agentName: string, clientId?: string, onOk?: () => void) => void;
  // Dépôt côté client (dans « Ma demande ») : la pièce part sur le stockage CPI
  // puis passe en analyse. Le fichier réel est nécessaire (upload multipart).
  depositDoc: (docId: string, file?: File, clientId?: string, onOk?: () => void) => void;
  // Parcours du dossier piloté par l'Agent CPI (index 0-5 dans TIMELINE_STEPS).
  dossierEtape: number;
  dossierEtapes: Record<string, number>;
  setDossierEtape: (etape: number, agentName: string, clientId?: string, onOk?: () => void) => void;
  /**
   * Notification envoyée par le personnel CPI vers un dossier (ou « tous »).
   * Passe par POST /staff/notifications/send : la notification arrive vraiment
   * dans la boîte du client, et le serveur en journalise l'envoi.
   */
  pushNotification: (target: string, message: string, canal: string, agentName: string) => void;
  /** Demande envoyée, par client (calculé côté serveur). */
  submittedByClient: Record<string, boolean>;
  /** Chargement des pièces depuis l'API. */
  loading: boolean;
  /** Erreur de chargement (null si tout va bien). */
  error: string | null;
  /** Relance le chargement après une erreur. */
  retry: () => void;
}

const DocStateContext = createContext<DocStateCtx | null>(null);

// ─── Clé de cache TanStack Query ─────────────────────────────────────────────

export const MES_DOCS_QUERY_KEY = ['client', 'mes-documents'] as const;

/** Pièces requises du client connecté (les 3 pièces sont créées par l'API). */
export function useMesDocumentsQuery(enabled: boolean): UseQueryResult<RequisDocData[]> {
  return useQuery({
    queryKey: MES_DOCS_QUERY_KEY,
    queryFn: () => clientApi.mesDocuments(),
    enabled,
  });
}

// ─── Aucun localStorage ──────────────────────────────────────────────────────
// La clé `cpi_history_v4_*` a disparu en Phase 6 : le journal du dossier vient
// de /staff/historique (Spatie Activity Log), écrit par l'API à chaque mutation.
// Le front ne double plus l'écriture — il se contente de lire.

// ─── Conversion DTO → SharedDoc ──────────────────────────────────────────────

/** `docId` (identite / revenus / bancaires) est l'identifiant utilisé par l'UI. */
function toSharedDoc(d: RequisDocData): SharedDoc {
  return {
    id: d.docId,
    label: d.label,
    status: d.status as DocStatus,
    commentaire: d.commentaire ?? undefined,
    dateValidation: d.dateValidation ?? undefined,
    agentName: d.agentName ?? undefined,
    version: d.version,
    submittedLabel: d.submittedLabel ?? undefined,
    date: d.date ?? undefined,
    taille: d.taille ?? undefined,
    fileUrl: d.fileUrl ?? undefined,
  };
}

// ─── Conversion notification → entrée de journal ─────────────────────────────

/**
 * Le client n'a pas accès à /staff/historique. Sa vue « activité récente » est
 * donc alimentée par sa boîte de notifications, la seule trace serveur qui le
 * concerne — présentée dans le même format que le journal du personnel pour que
 * les écrans partagés (Mon dossier, tableau de bord) n'aient qu'une forme à lire.
 */
function notificationToEntry(n: NotificationData, clientName: string): ActivityEntry {
  return {
    id: `notif-${n.id}`,
    date: notifDateLabel(n),
    heure: n.heure,
    utilisateur: 'CPI',
    role: 'Agent CPI',
    action: n.message ? `${n.titre} — ${n.message}` : n.titre,
    type: 'notification',
    cible: clientName,
    clientId: n.clientId ?? undefined,
    event: 'notification-envoyee',
    timestamp: notifTimestamp(n),
  };
}

// ─── Un seul canal de retour : le toast global ───────────────────────────────
//
// Ce module affichait en plus son propre bandeau rouge fixe. Or `main.tsx`
// installe déjà un `MutationCache.onError` qui passe TOUTE erreur de mutation
// dans `apiErrorMessage` et la publie en toast : chaque échec produisait donc
// deux messages superposés, disant la même chose à deux endroits.
//
// Les mutations ci-dessous portent `meta: SILENCIEUX` — elles gèrent leur
// propre message, avec un repli plus précis que le repli générique —, et c'est
// bien ce message, celui du serveur quand il y en a un, qui s'affiche.
//
// Cela vaut en particulier pour les **409 de transition illégale** : leur
// `message` énumère les transitions possibles et il est écrit pour
// l'utilisateur. Il ne doit jamais être remplacé par un texte générique.

// ─── Provider ────────────────────────────────────────────────────────────────

export function DocStateProvider({ children }: { children: React.ReactNode }) {
  const { selectedClientId, allClients } = useClientContext();
  const { role } = usePermission();
  const isStaff  = role === 'agent-cpi' || role === 'super-admin';
  const isClient = role === 'client';
  const queryClient = useQueryClient();

  // Personnel CPI : la liste des dossiers embarque déjà `requisDocs` — un seul
  // appel suffit pour alimenter tous les tableaux de bord.
  const clientsQuery = useClientsQuery(isStaff);
  // Client : son propre dossier + ses propres pièces.
  const profileQuery = useMyProfileQuery(isClient);
  const mesDocsQuery = useMesDocumentsQuery(isClient);
  // Journal serveur : global pour le personnel, boîte de notifications pour le
  // client (aucune route /client/historique n'existe).
  const historiqueQuery = useHistoriqueQuery(isStaff);
  const notificationsQuery = useMesNotificationsQuery(isClient);

  // ── Pièces requises, par client ────────────────────────────────────────────
  const allDocs: Record<string, SharedDoc[]> = useMemo(() => {
    const result: Record<string, SharedDoc[]> = {};
    if (isStaff) {
      for (const c of clientsQuery.data ?? []) {
        result[c.id] = (c.requisDocs ?? []).map(toSharedDoc);
      }
    } else if (isClient && profileQuery.data) {
      result[profileQuery.data.id] = (mesDocsQuery.data ?? []).map(toSharedDoc);
    }
    return result;
  }, [isStaff, isClient, clientsQuery.data, profileQuery.data, mesDocsQuery.data]);

  // ── Étape du dossier + demande envoyée, par client ─────────────────────────
  const allEtapes: Record<string, number> = useMemo(() => {
    const result: Record<string, number> = {};
    if (isStaff) {
      for (const c of clientsQuery.data ?? []) result[c.id] = c.dossierEtape;
    } else if (isClient && profileQuery.data) {
      result[profileQuery.data.id] = profileQuery.data.dossierEtape;
    }
    return result;
  }, [isStaff, isClient, clientsQuery.data, profileQuery.data]);

  const submittedByClient: Record<string, boolean> = useMemo(() => {
    const result: Record<string, boolean> = {};
    if (isStaff) {
      for (const c of clientsQuery.data ?? []) result[c.id] = Boolean(c.demande?.submitted);
    } else if (isClient && profileQuery.data) {
      result[profileQuery.data.id] = Boolean(profileQuery.data.demande?.submitted);
    }
    return result;
  }, [isStaff, isClient, clientsQuery.data, profileQuery.data]);

  // ── Journal du dossier, alimenté par l'API ─────────────────────────────────
  //
  // Personnel CPI : /staff/historique, dont on écarte les entrées « documents
  // CPI » — elles sont servies par cpiDocsContext, comme du temps des deux
  // journaux locaux, pour que les écrans qui fusionnent les deux ne doublent
  // rien. Client : sa boîte de notifications, seule trace serveur qui le
  // concerne (il n'existe pas de route /client/historique).
  const allHistory: Record<string, ActivityEntry[]> = useMemo(() => {
    if (isStaff) {
      const entries = toActivityEntries(historiqueQuery.data)
        .filter(e => !isCpiDocEvent(e.event));
      return groupByClient(entries);
    }
    if (isClient && profileQuery.data) {
      return {
        [profileQuery.data.id]: [...(notificationsQuery.data ?? [])]
          .sort((a, b) => notifTimestamp(b) - notifTimestamp(a))
          .map(n => notificationToEntry(n, profileQuery.data.name)),
      };
    }
    return {};
  }, [isStaff, isClient, historiqueQuery.data, notificationsQuery.data, profileQuery.data]);

  // Valeurs dérivées pour le client sélectionné
  const requisDocs: SharedDoc[]     = allDocs[selectedClientId] ?? [];
  const history:    ActivityEntry[] = allHistory[selectedClientId] ?? [];
  const dossierEtape: number        = allEtapes[selectedClientId] ?? 0;


  /**
   * Rafraîchit les vues qui dépendent des pièces après une mutation.
   * L'historique en fait partie : le serveur y écrit une entrée à chaque geste.
   */
  const invalidateDocs = () => {
    void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: MES_DOCS_QUERY_KEY });
    // L'étape du parcours dépend des pièces : le serveur la recalcule.
    void queryClient.invalidateQueries({ queryKey: JOURNEY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: HISTORIQUE_QUERY_KEY });
  };

  // ── Mutations pièces (personnel CPI) ───────────────────────────────────────

  const acceptMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; docId: string }) => staffApi.docs.accept(v.clientId, v.docId),
    onSuccess: invalidateDocs,
    onError: e => toast.error(apiErrorMessage(e, 'Impossible de valider cette pièce.')),
  });

  const refuseMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; docId: string; comment: string }) =>
      staffApi.docs.refuse(v.clientId, v.docId, v.comment),
    onSuccess: invalidateDocs,
    onError: e => toast.error(apiErrorMessage(e, 'Impossible de refuser cette pièce.')),
  });

  const replaceMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; docId: string; comment: string }) =>
      staffApi.docs.requestReplacement(v.clientId, v.docId, v.comment),
    onSuccess: invalidateDocs,
    onError: e => toast.error(apiErrorMessage(e, 'Impossible de demander le remplacement.')),
  });

  const verifyMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; docId: string }) => staffApi.docs.remettreVerification(v.clientId, v.docId),
    onSuccess: invalidateDocs,
    onError: e => toast.error(apiErrorMessage(e, 'Impossible de remettre la pièce en vérification.')),
  });

  const depositMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { docId: string; file: File }) => clientApi.depositDoc(v.docId, v.file),
    onSuccess: invalidateDocs,
    onError: e => toast.error(apiErrorMessage(e, 'Le dépôt du document a échoué.')),
  });

  const etapeMutation = useMutation({
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; etape: number }) => staffApi.clients.setDossierEtape(v.clientId, v.etape),
    onSuccess: invalidateDocs,
    onError: e => toast.error(apiErrorMessage(e, "Impossible de mettre à jour l'étape du dossier.")),
  });

  const sendNotificationMutation = useSendNotification();

  // ── Actions exposées (mêmes signatures qu'avant l'API) ─────────────────────
  //
  // Plus aucune écriture de journal ici : l'API journalise chaque geste
  // (`doc-depose`, `validated`, `refused`, `dossier-etape`…) et `invalidateDocs`
  // rafraîchit l'historique. Écrire des deux côtés produirait des doublons —
  // et une trace locale mensongère quand le serveur refuse.

  /**
   * `onOk` n'est appelé qu'après acceptation par le serveur.
   *
   * Les écrans affichaient leur confirmation (« Document accepté », « Pièce
   * remise en vérification ») dès le clic. L'API refuse maintenant les
   * transitions impossibles — mettre en vérification une pièce jamais déposée,
   * toucher au dossier d'un parcours verrouillé — avec un 409 : sans ce rappel,
   * l'écran annonçait la réussite d'un geste que le serveur venait de refuser.
   */
  const acceptDoc = (docId: string, _agentName: string, clientId: string = selectedClientId, onOk?: () => void) => {
    acceptMutation.mutate({ clientId, docId }, { onSuccess: () => onOk?.() });
  };

  const refuseDoc = (docId: string, _agentName: string, comment: string, clientId: string = selectedClientId, onOk?: () => void) => {
    refuseMutation.mutate({ clientId, docId, comment }, { onSuccess: () => onOk?.() });
  };

  const requestReplacement = (docId: string, _agentName: string, comment: string, clientId: string = selectedClientId, onOk?: () => void) => {
    replaceMutation.mutate({ clientId, docId, comment }, { onSuccess: () => onOk?.() });
  };

  const remettreVerification = (docId: string, _agentName: string, clientId: string = selectedClientId, onOk?: () => void) => {
    verifyMutation.mutate({ clientId, docId }, { onSuccess: () => onOk?.() });
  };

  // Nombre d'étapes du parcours (miroir de dossierJourney.TIMELINE_STEPS).
  const NB_ETAPES = 6;

  const setDossierEtape = (etape: number, _agentName: string, clientId: string = selectedClientId, onOk?: () => void) => {
    etapeMutation.mutate({ clientId, etape: Math.max(0, Math.min(NB_ETAPES - 1, etape)) }, { onSuccess: () => onOk?.() });
  };

  const depositDoc = (docId: string, file?: File, _clientId: string = selectedClientId, onOk?: () => void) => {
    if (!file) {
      toast.error('Aucun fichier sélectionné — le dépôt a été annulé.');
      return;
    }
    // Le dépôt est refusé (409) dès que le parcours est verrouillé
    // (`dossier_etape >= 3`) : la confirmation attend la réponse du serveur, et
    // le message de refus explique au client pourquoi son dossier est figé.
    depositMutation.mutate({ docId, file }, { onSuccess: () => onOk?.() });
  };

  /**
   * `canal` (Notification / E-mail / SMS / WhatsApp) devient le titre : l'API
   * n'a qu'un canal de distribution — la notification applicative —, mais le
   * choix de l'agent reste visible dans la boîte du destinataire.
   */
  const pushNotification = (target: string, message: string, canal: string, _agentName: string) => {
    const ids = target === 'tous' ? allClients.map(c => c.id) : [target];
    for (const clientId of ids) {
      sendNotificationMutation.mutate(
        { client_id: clientId, titre: canal, message, type: 'info' },
        { onError: e => toast.error(apiErrorMessage(e, "L'envoi de la notification a échoué.")) },
      );
    }
  };

  // ── État de chargement / erreur ────────────────────────────────────────────
  const sourceQuery = isStaff ? clientsQuery : mesDocsQuery;
  const loading = (isStaff || isClient) && sourceQuery.isPending;
  const queryError = isStaff
    ? (clientsQuery.error ?? historiqueQuery.error)
    : (profileQuery.error ?? mesDocsQuery.error ?? notificationsQuery.error);
  const error = queryError ? apiErrorMessage(queryError, 'Impossible de charger les pièces du dossier.') : null;
  const retry = () => {
    void clientsQuery.refetch();
    void profileQuery.refetch();
    void mesDocsQuery.refetch();
    void historiqueQuery.refetch();
    void notificationsQuery.refetch();
  };

  return (
    <DocStateContext.Provider value={{
      requisDocs, history, allDocsByClient: allDocs, allHistoryByClient: allHistory,
      acceptDoc, refuseDoc, requestReplacement, remettreVerification, depositDoc,
      dossierEtape, dossierEtapes: allEtapes, setDossierEtape, pushNotification,
      submittedByClient, loading, error, retry,
    }}>
      {children}
    </DocStateContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocState(): DocStateCtx {
  const ctx = useContext(DocStateContext);
  if (!ctx) throw new Error('useDocState must be used within DocStateProvider');
  return ctx;
}
