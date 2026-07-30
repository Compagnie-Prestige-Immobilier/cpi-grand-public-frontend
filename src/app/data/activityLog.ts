// ─────────────────────────────────────────────────────────────────────────────
// Journal d'activité GLOBAL de la plateforme (traçabilité complète).
//
// Depuis la Phase 6, le journal n'est plus tenu par le navigateur : chaque
// mutation de l'API (dépôt de pièce, validation, décaissement, avancement de
// chantier, envoi de notification…) écrit son entrée côté serveur via Spatie
// Activity Log. La clé `cpi_activity_log_v1` a disparu, et avec elle le risque
// qu'un poste ait un historique et un autre non : le serveur est la SEULE
// source de vérité.
//
// Ce module ne fait donc plus qu'une chose : lire /staff/historique et traduire
// les entrées brutes en `ActivityEntry`, la forme que les écrans affichent
// (date et heure en français, rôle lisible, famille d'action pour l'icône).
//
// Journal en lecture seule : rien ne s'écrit ni ne s'efface depuis le front.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { staffApi, type ActivityLogData } from '../api/endpoints';

export type ActivityType =
  | 'validation'
  | 'document'
  | 'notification'
  | 'photo'
  | 'decaissement'
  | 'commentaire'
  | 'depot'
  | 'refus'
  | 'compte'
  | 'banque';

export type ActivityRole = 'Client' | 'Agent CPI' | 'Administrateur' | 'Système';

export interface ActivityEntry {
  id: string;
  date: string;   // « 25 juillet 2026 »
  heure: string;  // « 14:32 »
  utilisateur: string;
  role: ActivityRole | string;
  action: string;
  type: ActivityType;
  cible?: string;      // dossier / client concerné
  /** Identifiant du dossier concerné, quand l'entrée porte sur un client. */
  clientId?: string;
  /** Événement brut du serveur (`doc-depose`, `chantier-statut`…). */
  event?: string;
  /** Propriétés jointes à l'entrée par le contrôleur (`tranche`, `doc_id`…). */
  properties?: Record<string, unknown>;
  /**
   * Horodatage serveur en millisecondes — la seule clé de tri fiable. Les
   * champs `date` / `heure` sont des libellés français destinés à l'affichage :
   * les trier comme du texte donnerait n'importe quoi.
   */
  timestamp: number;
}

// ─── Clés de cache TanStack Query ────────────────────────────────────────────

export const HISTORIQUE_QUERY_KEY = ['staff', 'historique'] as const;

export const historiqueQueryKey = (clientId: string) =>
  [...HISTORIQUE_QUERY_KEY, clientId] as const;

/**
 * Journal global (toutes pages confondues). Réservé au personnel CPI : la route
 * /staff/historique répond 403 à un client, `enabled` doit donc refléter le rôle.
 */
export function useHistoriqueQuery(enabled: boolean): UseQueryResult<ActivityLogData[]> {
  return useQuery({
    queryKey: HISTORIQUE_QUERY_KEY,
    queryFn: () => staffApi.historique.global(),
    enabled,
  });
}

/** Journal d'un seul dossier. */
export function useHistoriqueClientQuery(
  clientId: string,
  enabled: boolean,
): UseQueryResult<ActivityLogData[]> {
  return useQuery({
    queryKey: historiqueQueryKey(clientId),
    queryFn: () => staffApi.historique.forClient(clientId),
    enabled,
  });
}

// ─── Traduction API → entrée affichable ──────────────────────────────────────

const FR_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const FR_TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * L'API sérialise ses dates en « AAAA-MM-JJ HH:MM:SS ». L'espace n'est pas de
 * l'ISO 8601 : on le normalise avant de construire la Date, sinon l'analyse
 * dépend du moteur JS.
 */
function parseApiDate(value: string): Date {
  return new Date(value.includes(' ') ? value.replace(' ', 'T') : value);
}

/** Rôles Spatie → libellés affichés (et filtrés) dans l'écran Historique. */
const ROLE_LABELS: Record<string, ActivityRole> = {
  'client': 'Client',
  'agent-cpi': 'Agent CPI',
  'super-admin': 'Administrateur',
};

/**
 * Familles d'événements → icône / couleur de l'écran Historique.
 *
 * Les clés sont les `event` posés par les contrôleurs de l'API. Les entrées
 * automatiques du modèle Client (`created` / `updated` / `deleted`, écrites par
 * le trait LogsActivity) tombent dans la famille « compte ».
 */
const EVENT_TYPES: Record<string, ActivityType> = {
  // Pièces requises
  'doc-depose': 'depot',
  'validated': 'validation',
  'refused': 'refus',
  'replacement-requested': 'refus',
  'verification': 'document',
  // Demande & dossier
  'demande-soumise': 'document',
  'dossier-etape': 'validation',
  'client-cree': 'compte',
  'client-supprime': 'compte',
  'created': 'compte',
  'updated': 'compte',
  'deleted': 'compte',
  // Documents CPI
  'cpi-doc-cree': 'document',
  'cpi-doc-publie': 'document',
  'cpi-doc-archive': 'document',
  'cpi-doc-signe': 'validation',
  'cpi-doc-signe-client': 'validation',
  'cpi-doc-supprime': 'document',
  // Banques
  'banque-creee': 'banque',
  'banque-modifiee': 'banque',
  'banque-supprimee': 'banque',
  'banque-assignee': 'banque',
  'banque-statut': 'banque',
  'banque-retiree': 'banque',
  // Décaissements
  'decaissement-modifie': 'decaissement',
  'terrain-decaisse': 'decaissement',
  'foncier-valide': 'decaissement',
  'tranche-decaissee': 'decaissement',
  // Chantier
  'chantier-modifie': 'commentaire',
  'chantier-progression': 'validation',
  'chantier-etape': 'validation',
  'chantier-statut': 'validation',
  'chantier-tranche-terminee': 'validation',
  'chantier-publication-ajoutee': 'commentaire',
  'chantier-publication-modifiee': 'commentaire',
  'chantier-publication-supprimee': 'commentaire',
  'chantier-media-ajoute': 'photo',
  'chantier-media-modifie': 'photo',
  'chantier-media-supprime': 'photo',
  'chantier-event-planifie': 'commentaire',
  'chantier-event-modifie': 'commentaire',
  'chantier-event-supprime': 'commentaire',
  // Notifications
  'notification-envoyee': 'notification',
};

/**
 * Les entrées automatiques du modèle Client ont pour description le nom brut de
 * l'événement Eloquent : on leur donne une phrase française.
 */
const DESCRIPTIONS_BRUTES: Record<string, string> = {
  created: 'Dossier créé',
  updated: 'Dossier mis à jour',
  deleted: 'Dossier supprimé',
};

/** Événements portant sur un document CPI — cf. `cpiHistory` du contexte dédié. */
export function isCpiDocEvent(event?: string | null): boolean {
  return typeof event === 'string' && event.startsWith('cpi-doc-');
}

/** Traduit une entrée brute du journal en entrée affichable. */
export function toActivityEntry(a: ActivityLogData): ActivityEntry {
  const d = a.createdAt ? parseApiDate(a.createdAt) : null;
  const valid = d !== null && !Number.isNaN(d.getTime());

  return {
    id: String(a.id),
    date: valid ? FR_DATE.format(d) : '—',
    heure: valid ? FR_TIME.format(d) : '—',
    utilisateur: a.causerName ?? 'Système',
    role: a.causerRole ? (ROLE_LABELS[a.causerRole] ?? a.causerRole) : 'Système',
    action: DESCRIPTIONS_BRUTES[a.description] ?? a.description,
    type: (a.event ? EVENT_TYPES[a.event] : undefined) ?? 'document',
    cible: a.clientName ?? undefined,
    clientId: a.clientId ?? undefined,
    event: a.event ?? undefined,
    properties: a.properties ?? undefined,
    timestamp: valid ? d.getTime() : 0,
  };
}

/** Entier d'une propriété d'entrée (numéro de tranche, version…). */
export function propertyNumber(entry: ActivityEntry, key: string): number | undefined {
  const value = entry.properties?.[key];
  return typeof value === 'number' ? value : undefined;
}

/** Journal complet, traduit et trié (le plus récent en tête). */
export function toActivityEntries(entries: ActivityLogData[] | undefined): ActivityEntry[] {
  return (entries ?? [])
    .map(toActivityEntry)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Regroupe un journal par dossier. Les entrées sans dossier (création de
 * banque, suppression de client…) restent dans le journal global mais n'entrent
 * dans aucune fiche.
 */
export function groupByClient(entries: ActivityEntry[]): Record<string, ActivityEntry[]> {
  const result: Record<string, ActivityEntry[]> = {};
  for (const entry of entries) {
    if (!entry.clientId) continue;
    (result[entry.clientId] ??= []).push(entry);
  }
  return result;
}
