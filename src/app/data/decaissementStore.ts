/**
 * decaissementStore — décaissements bancaires par dossier.
 *
 * Deux phases :
 *  1) Acquisition foncière (terrain/parcelle) : la banque décaisse la TOTALITÉ
 *     du prix en une fois (crédit conso). Parcours foncier en 5 étapes.
 *  2) Construction de la villa (optionnelle) : décaissement en 4 tranches
 *     (35 / 30 / 30 / 5 %).
 *
 * Objectif métier : enrôler le maximum de clients (acquisition) avant de lancer
 * les constructions. Un dossier peut n'avoir que l'acquisition (parcelle nue).
 *
 * La source de vérité est l'API Laravel (`/staff/decaissements/{client}`) — la
 * clé `cpi_decaissements_v1` a disparu. Comme `bankRegistry`, le module garde
 * un lecteur synchrone (`getDecaissement`) adossé à un cache mémoire alimenté
 * par les hooks TanStack Query exportés plus bas.
 *
 * Le module est interne au personnel CPI : l'API n'expose aucune route client
 * pour les décaissements (cf. STEP 9), donc le cache reste vide pour un compte
 * client.
 */

import { useEffect, useMemo } from 'react';
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { SILENCIEUX } from '../api/client';
import { staffApi, type DecaissementData, type DecaissementUpdateInput } from '../api/endpoints';

export interface DecaissementState {
  terrainMontant: number;      // prix du terrain (FCFA)
  terrainDecaisse: boolean;    // décaissement unique effectué
  terrainDate?: string;        // date du décaissement (FR)
  foncier: boolean[];          // 5 étapes du parcours foncier validées
  constructionActive: boolean; // la construction a été lancée
  constructionMontant: number; // coût total de construction (FCFA)
  tranches: { validated: boolean; date?: string; comment?: string }[]; // 4 tranches
}

export const FONCIER_STEPS = [
  'Inscription sur la plateforme',
  'Crédit conso de la banque',
  'Signature du contrat de réservation',
  'Régularisation foncière par la CPI',
  'Remise du titre foncier',
];

export const CONSTRUCTION_TRANCHES: { pct: number; label: string; detail: string }[] = [
  { pct: 35, label: 'Avance de démarrage',    detail: 'À la signature et au démarrage du chantier — mobilisation des équipes.' },
  { pct: 30, label: 'Élévation des murs, poteaux, dalle et toiture', detail: 'Libéré après certification de la mise hors d\'eau.' },
  { pct: 30, label: 'Second œuvre',           detail: 'Menuiseries, plomberie, électricité et carrelage.' },
  { pct: 5,  label: 'Remise des clés',        detail: 'À la réception définitive du logement.' },
];

export function defaultDecaissement(): DecaissementState {
  return {
    terrainMontant: 0,
    terrainDecaisse: false,
    foncier: [true, false, false, false, false], // inscription faite pour un client inscrit
    constructionActive: false,
    constructionMontant: 0,
    tranches: [{ validated: false }, { validated: false }, { validated: false }, { validated: false }],
  };
}

// ─── Clé de cache TanStack Query ──────────────────────────────────────────────

export const DECAISSEMENT_QUERY_KEY = ['staff', 'decaissements'] as const;

/** Clé d'un dossier : les mutations n'invalident que ce qui a bougé. */
export const decaissementQueryKey = (clientId: string) =>
  [...DECAISSEMENT_QUERY_KEY, clientId] as const;

// ─── Cache mémoire (pont vers les consommateurs synchrones) ───────────────────

let decaissementsCache: Record<string, DecaissementState> = {};

export function loadDecaissements(): Record<string, DecaissementState> {
  return decaissementsCache;
}

export function hydrateDecaissements(map: Record<string, DecaissementState>): void {
  decaissementsCache = map;
}

export function getDecaissement(clientId: string): DecaissementState {
  return decaissementsCache[clientId] ?? defaultDecaissement();
}

// ─── Conversion DTO → état d'écran ────────────────────────────────────────────

const FR_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Une date ISO renvoyée par l'API devient la date FR affichée par l'UI. */
function frDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : FR_DATE.format(d);
}

export function toDecaissementState(d: DecaissementData): DecaissementState {
  const fallback = defaultDecaissement();
  // `tranches` est une colonne JSON libre côté base : le DTO généré ne peut pas
  // en décrire la forme, on la lit donc champ par champ.
  const raw: Record<string, unknown>[] = d.tranches;

  return {
    terrainMontant: d.terrainMontant,
    terrainDecaisse: d.terrainDecaisse,
    terrainDate: frDay(d.terrainDate),
    foncier: d.foncier.length > 0 ? d.foncier : fallback.foncier,
    constructionActive: d.constructionActive,
    constructionMontant: d.constructionMontant,
    tranches: raw.length === 0 ? fallback.tranches : raw.map(t => ({
      validated: t.validated === true,
      date: typeof t.date === 'string' ? frDay(t.date) : undefined,
      comment: typeof t.comment === 'string' ? t.comment : undefined,
    })),
  };
}

/** Corps accepté par PUT /staff/decaissements/{client} (snake_case). */
export function toTranchesInput(tranches: DecaissementState['tranches']) {
  return tranches.map(t => ({
    validated: t.validated,
    date: t.date ?? null,
    comment: t.comment ?? null,
  }));
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

export interface DecaissementsQueryResult {
  /** État par dossier, complété par les valeurs par défaut le temps du chargement. */
  states: Record<string, DecaissementState>;
  loading: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * État de décaissement de plusieurs dossiers. L'API n'expose qu'une lecture
 * par dossier (`GET /staff/decaissements/{client}`) : on parallélise.
 */
export function useDecaissementsQuery(clientIds: string[], enabled: boolean): DecaissementsQueryResult {
  const queries = useQueries({
    queries: clientIds.map(clientId => ({
      queryKey: decaissementQueryKey(clientId),
      queryFn: () => staffApi.decaissements.get(clientId),
      enabled,
    })),
  });

  // Signature stable : la carte n'est reconstruite que lorsqu'une réponse
  // change réellement, pas à chaque rendu.
  const signature = clientIds.join('|') + '#' + queries.map(q => q.dataUpdatedAt).join('|');

  const states = useMemo(() => {
    const map: Record<string, DecaissementState> = {};
    clientIds.forEach((clientId, i) => {
      // `useQueries` sur un tableau dynamique ne conserve pas toujours le type
      // de retour du queryFn : on le rétablit ici, il est connu (staffApi).
      const data = queries[i]?.data as DecaissementData | undefined;
      if (data) map[clientId] = toDecaissementState(data);
    });
    return map;
  }, [signature]);

  useEffect(() => { hydrateDecaissements(states); }, [states]);

  return {
    states,
    loading: enabled && queries.some(q => q.isPending),
    error: queries.find(q => q.error)?.error ?? null,
    retry: () => { queries.forEach(q => { void q.refetch(); }); },
  };
}

// ─── Écriture ─────────────────────────────────────────────────────────────────

function useInvalidateDecaissements() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: DECAISSEMENT_QUERY_KEY }); };
}

export function useUpdateDecaissement() {
  const invalidate = useInvalidateDecaissements();
  return useMutation({
    // L'appelant affiche le message du serveur ; pas de second toast.
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; input: DecaissementUpdateInput }) =>
      staffApi.decaissements.update(v.clientId, v.input),
    onSuccess: invalidate,
  });
}

export function useValidateTerrain() {
  const invalidate = useInvalidateDecaissements();
  return useMutation({
    // L'appelant affiche le message du serveur ; pas de second toast.
    meta: SILENCIEUX,
    mutationFn: (clientId: string) => staffApi.decaissements.validateTerrain(clientId),
    onSuccess: invalidate,
  });
}

export function useValidateFoncierStep() {
  const invalidate = useInvalidateDecaissements();
  return useMutation({
    // L'appelant affiche le message du serveur ; pas de second toast.
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; step: number }) =>
      staffApi.decaissements.validateFoncierStep(v.clientId, v.step),
    onSuccess: invalidate,
  });
}

export function useValidateTranche() {
  const invalidate = useInvalidateDecaissements();
  return useMutation({
    // L'appelant affiche le message du serveur ; pas de second toast.
    meta: SILENCIEUX,
    mutationFn: (v: { clientId: string; num: number }) =>
      staffApi.decaissements.validateTranche(v.clientId, v.num),
    onSuccess: invalidate,
  });
}
