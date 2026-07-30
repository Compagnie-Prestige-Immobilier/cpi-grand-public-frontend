import React, { createContext, useContext, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { frDate } from './demoStore';
import { clientApi, staffApi, type CpiDocData } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { usePermission } from '../auth/PermissionContext';
import { useMyProfileQuery } from './clientRegistry';
import { ApiErrorBanner } from './docStateContext';
import { useClientContext } from '../contexts/ClientContext';
import {
  HISTORIQUE_QUERY_KEY, groupByClient, isCpiDocEvent, toActivityEntries,
  useHistoriqueQuery, type ActivityEntry,
} from './activityLog';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CpiDocStatus =
  | 'brouillon'
  | 'publie'
  | 'disponible'
  | 'a-signer'
  | 'signe'
  | 'refuse'
  | 'archive';

export type CpiCategorie =
  | 'contrats'
  | 'conventions'
  | 'bancaires'
  | 'courriers'
  | 'pv'
  | 'autorisations';

export interface CpiDoc {
  id: string;
  categorie: CpiCategorie;
  nom: string;
  reference?: string;
  dateCreation: string;
  datePublication?: string;
  version: string;
  status: CpiDocStatus;
  auteur: string;
  fichier?: string;
  commentaire?: string;
  visibleClient: boolean;
  signatureRequise: boolean;
  taille?: string;
  format?: string;
}

// ─── Context interface ────────────────────────────────────────────────────────

interface CpiDocsCtx {
  cpiDocs: CpiDoc[];
  /**
   * Journal des documents CPI du dossier sélectionné : les entrées serveur dont
   * l'événement appartient à la famille `cpi-doc-*`. Vide pour un client — la
   * route /staff/historique lui est interdite.
   */
  cpiHistory: ActivityEntry[];
  allCpiDocsByClient: Record<string, CpiDoc[]>;
  allCpiHistoryByClient: Record<string, ActivityEntry[]>;
  publishDoc: (docId: string, agentName: string, clientId?: string) => void;
  archiveDoc: (docId: string, agentName: string, clientId?: string) => void;
  requestSignature: (docId: string, agentName: string, clientId?: string) => void;
  markSigned: (docId: string, agentName: string, clientId?: string) => void;
  // Signature électronique par le client (depuis « Mon dossier »).
  signDocByClient: (docId: string, clientId?: string) => void;
  retireFromClient: (docId: string, agentName: string, clientId?: string) => void;
  createDoc: (
    fields: Omit<CpiDoc, 'id' | 'dateCreation' | 'datePublication' | 'status' | 'visibleClient'>,
    agentName: string,
    publishNow: boolean,
    clientId?: string,
  ) => void;
  /** Chargement des documents CPI depuis l'API. */
  loading: boolean;
  /** Erreur de chargement (null si tout va bien). */
  error: string | null;
  /** Relance le chargement après une erreur. */
  retry: () => void;
}

const CpiDocsContext = createContext<CpiDocsCtx | null>(null);

// ─── Clés de cache TanStack Query ─────────────────────────────────────────────

export const CPI_DOCS_QUERY_KEY     = ['staff', 'cpi-docs'] as const;
export const MES_CPI_DOCS_QUERY_KEY = ['client', 'mes-documents-cpi'] as const;

/** Documents CPI visibles par le client connecté. */
export function useMesDocumentsCpiQuery(enabled: boolean): UseQueryResult<CpiDocData[]> {
  return useQuery({
    queryKey: MES_CPI_DOCS_QUERY_KEY,
    queryFn: () => clientApi.mesDocumentsCpi(),
    enabled,
  });
}

/** Tous les documents CPI (personnel) — regroupés par client côté front. */
export function useCpiDocsQuery(enabled: boolean): UseQueryResult<CpiDocData[]> {
  return useQuery({
    queryKey: CPI_DOCS_QUERY_KEY,
    queryFn: () => staffApi.cpiDocs.list(),
    enabled,
  });
}

// ─── Aucun localStorage ──────────────────────────────────────────────────────
// La clé `cpi_cpihistory_v3_*` a disparu en Phase 6 : le journal des documents
// CPI est celui du serveur (événements `cpi-doc-*` de Spatie Activity Log).

// ─── Conversion DTO → CpiDoc ─────────────────────────────────────────────────

function toCpiDoc(d: CpiDocData): CpiDoc {
  return {
    id: d.id,
    categorie: d.categorie as CpiCategorie,
    nom: d.nom,
    reference: d.reference ?? undefined,
    dateCreation: frDate(d.dateCreation) ?? d.dateCreation,
    datePublication: frDate(d.datePublication),
    version: d.version,
    status: d.status as CpiDocStatus,
    auteur: d.auteur,
    fichier: d.fichier ?? undefined,
    commentaire: d.commentaire ?? undefined,
    visibleClient: d.visibleClient,
    signatureRequise: d.signatureRequise,
    taille: d.taille ?? undefined,
    format: d.format ?? undefined,
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CpiDocsProvider({ children }: { children: React.ReactNode }) {
  const { selectedClientId } = useClientContext();
  const { role } = usePermission();
  const isStaff  = role === 'agent-cpi' || role === 'super-admin';
  const isClient = role === 'client';
  const queryClient = useQueryClient();

  // Personnel CPI : tous les documents en un appel, regroupés par client ici.
  const staffDocsQuery = useCpiDocsQuery(isStaff);
  // Client : uniquement les documents publiés pour lui.
  const profileQuery = useMyProfileQuery(isClient);
  const mesDocsQuery = useMesDocumentsCpiQuery(isClient);

  // Journal serveur : seules les entrées « documents CPI » nous concernent, le
  // reste est servi par docStateContext — les écrans qui fusionnent les deux ne
  // doublent donc rien.
  const historiqueQuery = useHistoriqueQuery(isStaff);

  const [actionError, setActionError] = useState<string | null>(null);

  const allCpiDocs: Record<string, CpiDoc[]> = useMemo(() => {
    const result: Record<string, CpiDoc[]> = {};
    if (isStaff) {
      for (const d of staffDocsQuery.data ?? []) {
        (result[d.clientId] ??= []).push(toCpiDoc(d));
      }
    } else if (isClient && profileQuery.data) {
      result[profileQuery.data.id] = (mesDocsQuery.data ?? []).map(toCpiDoc);
    }
    return result;
  }, [isStaff, isClient, staffDocsQuery.data, profileQuery.data, mesDocsQuery.data]);

  const allCpiHistory: Record<string, ActivityEntry[]> = useMemo(() => {
    if (!isStaff) return {};
    return groupByClient(toActivityEntries(historiqueQuery.data).filter(e => isCpiDocEvent(e.event)));
  }, [isStaff, historiqueQuery.data]);

  const cpiDocs:    CpiDoc[]        = allCpiDocs[selectedClientId]    ?? [];
  const cpiHistory: ActivityEntry[] = allCpiHistory[selectedClientId] ?? [];

  /**
   * Rafraîchit les documents CPI et le journal : le serveur écrit une entrée
   * `cpi-doc-*` à chaque geste, plus rien n'est journalisé côté navigateur.
   */
  const invalidateCpiDocs = () => {
    void queryClient.invalidateQueries({ queryKey: CPI_DOCS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: MES_CPI_DOCS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: HISTORIQUE_QUERY_KEY });
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const publishMutation = useMutation({
    mutationFn: (docId: string) => staffApi.cpiDocs.publish(docId),
    onSuccess: invalidateCpiDocs,
    onError: e => setActionError(apiErrorMessage(e, 'La publication du document a échoué.')),
  });

  const archiveMutation = useMutation({
    mutationFn: (docId: string) => staffApi.cpiDocs.archive(docId),
    onSuccess: invalidateCpiDocs,
    onError: e => setActionError(apiErrorMessage(e, "L'archivage du document a échoué.")),
  });

  // Demander une signature = marquer la signature requise puis publier
  // (l'API bascule alors le statut en « à signer » et rend le doc visible).
  const requestSignatureMutation = useMutation({
    mutationFn: async (docId: string) => {
      await staffApi.cpiDocs.update(docId, { signature_requise: true });
      return staffApi.cpiDocs.publish(docId);
    },
    onSuccess: invalidateCpiDocs,
    onError: e => setActionError(apiErrorMessage(e, 'La demande de signature a échoué.')),
  });

  const signMutation = useMutation({
    mutationFn: (docId: string) => staffApi.cpiDocs.sign(docId),
    onSuccess: invalidateCpiDocs,
    onError: e => setActionError(apiErrorMessage(e, 'La signature du document a échoué.')),
  });

  const signByClientMutation = useMutation({
    mutationFn: (docId: string) => clientApi.signCpiDoc(docId),
    onSuccess: invalidateCpiDocs,
    onError: e => setActionError(apiErrorMessage(e, 'La signature électronique a échoué.')),
  });

  // Retirer de l'espace client sans archiver : seule la visibilité change.
  const retireMutation = useMutation({
    mutationFn: (docId: string) => staffApi.cpiDocs.update(docId, { visible_client: false }),
    onSuccess: invalidateCpiDocs,
    onError: e => setActionError(apiErrorMessage(e, 'Le retrait du document a échoué.')),
  });

  const createMutation = useMutation({
    mutationFn: async (v: {
      clientId: string;
      fields: Omit<CpiDoc, 'id' | 'dateCreation' | 'datePublication' | 'status' | 'visibleClient'>;
      publishNow: boolean;
    }) => {
      const created = await staffApi.cpiDocs.create({
        client_id: v.clientId,
        categorie: v.fields.categorie,
        nom: v.fields.nom,
        reference: v.fields.reference ?? null,
        version: v.fields.version,
        commentaire: v.fields.commentaire ?? null,
        fichier: v.fields.fichier ?? null,
        signature_requise: v.fields.signatureRequise,
        taille: v.fields.taille ?? null,
        format: v.fields.format ?? null,
      });
      return v.publishNow ? staffApi.cpiDocs.publish(created.id) : created;
    },
    onSuccess: invalidateCpiDocs,
    onError: e => setActionError(apiErrorMessage(e, 'La création du document a échoué.')),
  });

  // ── Actions exposées (mêmes signatures qu'avant l'API) ─────────────────────

  // Aucune écriture de journal ici : l'API journalise chaque geste
  // (`cpi-doc-publie`, `cpi-doc-signe`…) et `invalidateCpiDocs` recharge
  // l'historique. Le paramètre `agentName` reste dans la signature — les écrans
  // l'affichent —, mais il ne sert plus à écrire de trace locale.

  const publishDoc = (docId: string, _agentName?: string, _clientId: string = selectedClientId) => {
    publishMutation.mutate(docId);
  };

  const archiveDoc = (docId: string, _agentName?: string, _clientId: string = selectedClientId) => {
    archiveMutation.mutate(docId);
  };

  const requestSignature = (docId: string, _agentName?: string, _clientId: string = selectedClientId) => {
    requestSignatureMutation.mutate(docId);
  };

  const markSigned = (docId: string, _agentName?: string, _clientId: string = selectedClientId) => {
    signMutation.mutate(docId);
  };

  const signDocByClient = (docId: string, _clientId: string = selectedClientId) => {
    signByClientMutation.mutate(docId);
  };

  const retireFromClient = (docId: string, _agentName?: string, _clientId: string = selectedClientId) => {
    retireMutation.mutate(docId);
  };

  const createDoc = (
    fields: Omit<CpiDoc, 'id' | 'dateCreation' | 'datePublication' | 'status' | 'visibleClient'>,
    _agentName: string,
    publishNow: boolean,
    clientId: string = selectedClientId,
  ) => {
    createMutation.mutate({ clientId, fields, publishNow });
  };

  // ── État de chargement / erreur ────────────────────────────────────────────
  const sourceQuery = isStaff ? staffDocsQuery : mesDocsQuery;
  const loading = (isStaff || isClient) && sourceQuery.isPending;
  const queryError = isStaff
    ? (staffDocsQuery.error ?? historiqueQuery.error)
    : (profileQuery.error ?? mesDocsQuery.error);
  const error = queryError ? apiErrorMessage(queryError, 'Impossible de charger les documents CPI.') : null;
  const retry = () => {
    void staffDocsQuery.refetch();
    void mesDocsQuery.refetch();
    void historiqueQuery.refetch();
  };

  return (
    <CpiDocsContext.Provider value={{
      cpiDocs, cpiHistory, allCpiDocsByClient: allCpiDocs, allCpiHistoryByClient: allCpiHistory,
      publishDoc, archiveDoc, requestSignature, markSigned, signDocByClient, retireFromClient, createDoc,
      loading, error, retry,
    }}>
      {actionError && <ApiErrorBanner message={actionError} onClose={() => setActionError(null)} />}
      {children}
    </CpiDocsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCpiDocs(): CpiDocsCtx {
  const ctx = useContext(CpiDocsContext);
  if (!ctx) throw new Error('useCpiDocs must be used within CpiDocsProvider');
  return ctx;
}
