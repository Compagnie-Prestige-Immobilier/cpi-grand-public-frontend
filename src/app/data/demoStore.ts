// Data store — types partagés et bases VIDES.
//
// Aucune donnée fictive : la plateforme démarre avec une base vide. Les vrais
// clients apparaissent uniquement lorsqu'ils s'inscrivent (voir clientRegistry.ts),
// et l'Agent CPI / l'Administrateur les gèrent ensuite. Ce fichier ne conserve
// que les définitions de types et un helper pur, plus des collections vides pour
// préserver la compatibilité des imports existants.

// ─── Document requis types ───────────────────────────────────────────────────

export type DocStatus =
  | 'en-attente'
  | 'depose'
  | 'verification'
  | 'accepte'
  | 'refuse'
  | 'a-remplacer';

export interface RequisDocData {
  id: string;
  label: string;
  description: string;
  status: DocStatus;
  date?: string;
  dateValidation?: string;
  commentaire?: string;
  version: number;
  submittedLabel?: string;
  taille?: string;
}

// ─── CPI admin documents (folders) ──────────────────────────────────────────

export type CpiDocStatus = 'disponible' | 'signe' | 'en-attente' | 'a-signer' | 'consulte';

export interface CpiDocItem {
  id: string;
  label: string;
  status: CpiDocStatus;
  date?: string;
}

export interface CpiFolderData {
  id: string;
  label: string;
  docs: CpiDocItem[];
}

// ─── Chantier / Tranches ─────────────────────────────────────────────────────

export type TrancheEtat = 'terminee' | 'en-cours' | 'en-attente';
export type ModuleTrancheStatus = 'valide' | 'en-cours' | 'en-attente' | 'bloque';

export interface TrancheData {
  num: number;
  label: string;
  pct: number;
  montant: string;
  etat: TrancheEtat;
  date?: string;
  comment?: string;
  description?: string;
}

// ─── Helpers purs ─────────────────────────────────────────────────────────────

export function etatToStatus(etat: TrancheEtat): ModuleTrancheStatus {
  if (etat === 'terminee')  return 'valide';
  if (etat === 'en-cours')  return 'en-cours';
  return 'en-attente';
}

/**
 * Date ISO renvoyée par l'API → date lisible en français (« 25 juillet 2026 »).
 * Renvoie `undefined` si la valeur est absente ou illisible ; laisse passer les
 * chaînes déjà formatées côté serveur (ex. « 25/07/2026 »).
 */
export function frDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface NotifEntry {
  id: string;
  titre: string;
  message: string;
  date: string;
  heure: string;
  lu: boolean;
  type: 'info' | 'action' | 'validation' | 'alerte';
  /** Navigate to this page when the notification is clicked */
  targetPage?: string;
  /** Optional sub-section / item ID within the target page */
  targetSub?: string;
}

// ─── Historique des activités ────────────────────────────────────────────────

export type HistoActionType =
  | 'validation'
  | 'document'
  | 'notification'
  | 'photo'
  | 'decaissement'
  | 'commentaire'
  | 'depot'
  | 'refus';

export interface HistoEntry {
  id: string;
  date: string;
  heure: string;
  utilisateur: string;
  role: string;
  action: string;
  type: HistoActionType;
  cible?: string;
}

// ─── Client summary (registre des vrais clients) ─────────────────────────────

export interface ClientSummary {
  id: string;
  name: string;
  ref: string;
  statut: string;
  progression: number;
  projectNom: string;
  adresse: string;
  /** Date d'inscription réelle (format FR, ex. « 25 juillet 2026 »). */
  dateInscription?: string;
  /** Identité de connexion (permet de retrouver le compte à la reconnexion). */
  email?: string;
  /**
   * Compte utilisateur associé. Absent pour un dossier créé par le personnel
   * sans inscription : ce client ne peut pas se connecter, donc pas non plus
   * être consulté en prise en main.
   */
  userId?: string;
  phone?: string;
  employer?: string;
  fonction?: string;
  /** Conseiller CPI assigné, `undefined` tant qu'aucun ne l'est. */
  conseiller?: string;
}

// ─── Bases VIDES ──────────────────────────────────────────────────────────────
// Plus aucun compte fictif. Ces collections restent exportées (vides) pour ne
// pas casser les imports ; les vraies données proviennent du registre clients
// et des contextes alimentés par les actions réelles.

export const CLIENT_SUMMARIES: ClientSummary[] = [];

export const ALL_REQUIS_DOCS: Record<string, RequisDocData[]> = {};

export const ALL_HISTORIQUE: Record<string, HistoEntry[]> = {};
