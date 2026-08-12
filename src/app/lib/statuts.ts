/**
 * Registre unique des statuts métier : libellé, variante visuelle, couleurs.
 *
 * Chaque écran redéclarait sa propre table (`CPI_STATUS_CFG`, `DOC_STATUS_CFG`,
 * `STATUS_CONFIG`, `CPI_STATUS`, `TRANCHE_STATUS_CFG`…) et elles avaient
 * divergé — pas seulement en couleur, en **contenu** :
 *
 *   - `AgentDossiersReels.CPI_STATUS_CFG` ne connaissait pas le statut
 *     `refuse`, alors que `AdminDashboard.CPI_STATUS` le connaissait. Le repli
 *     `?? CPI_STATUS_CFG.disponible` affichait donc **« Disponible »** sur un
 *     document que CPI venait de refuser : l'agent lisait exactement l'inverse
 *     de la vérité.
 *   - `DocumentsAdminModule` peignait `archive` en or et `publie` en vert,
 *     `AgentDossiersReels` peignait les deux en gris et en prune.
 *   - `AdminDashboard.DOC_STATUS` traduisait `depose` par « À vérifier »,
 *     `MaDemandePage` par « En attente de validation ».
 *
 * Les couples couleur/fond viennent de `DS.status`, dont chaque paire est
 * vérifiée ≥ 4,5:1 (voir docs/design.md § Rôles de couleur).
 *
 * ── Ce qui empêche la divergence de revenir ─────────────────────────────────
 * Chaque table est typée `Record<…Statut, StatutUI>` sur l'union de littéraux
 * produite par le backend (`src/app/api/types/generated.d.ts`). Le compilateur
 * exige donc l'exhaustivité : ajouter un statut côté Laravel casse le build ici
 * tant que son libellé n'est pas écrit, et inventer un statut que l'API ne
 * connaît pas est également une erreur de type. C'est ce qui manquait quand ces
 * tables étaient des `Record<string, …>` : rien ne signalait le trou.
 */

import type { StatusVariant } from '../components/ui/index';
import { DS } from '../components/ui/index';

type CpiDocStatut         = App.Enums.CpiDocStatut;
type RequisDocStatut      = App.Enums.RequisDocStatut;
type ChantierStatut       = App.Enums.ChantierStatut;
type BankAssignmentStatut = App.Enums.BankAssignmentStatut;

export interface StatutUI {
  label: string;
  variant: StatusVariant;
  color: string;
  bg: string;
}

/** Complète une entrée `{ label, variant }` avec les couleurs du design system. */
function ui(label: string, variant: StatusVariant): StatutUI {
  const { color, bg } = DS.status[variant];
  return { label, variant, color, bg };
}

// ─── Documents établis par CPI (contrats, actes, conventions) ────────────────

/**
 * Les CLÉS sont les statuts renvoyés par l'API et ne changent pas — seuls les
 * libellés évoluent. Renommer une clé casserait la lecture des réponses.
 */
export const STATUT_DOC_CPI: Record<CpiDocStatut, StatutUI> = {
  brouillon:  ui('Brouillon',  'muted'),
  disponible: ui('Disponible', 'primary'),
  'a-signer': ui('À signer',   'danger'),
  signe:      ui('Signé',      'success'),
  archive:    ui('Archivé',    'warning'),
};

/** Lecture sûre : un statut inconnu se signale comme tel, il ne se déguise pas. */
export function statutDocCpi(statut: string): StatutUI {
  return STATUT_DOC_CPI[statut as CpiDocStatut] ?? ui(statut, 'muted');
}

// ─── Pièces justificatives déposées par le client ───────────────────────────

export const STATUT_PIECE: Record<RequisDocStatut, StatutUI> = {
  'en-attente':  ui('Non déposée',  'muted'),
  depose:        ui('À vérifier',   'info'),
  verification:  ui('En vérification', 'warning'),
  accepte:       ui('Validée',      'success'),
  refuse:        ui('Refusée',      'danger'),
  'a-remplacer': ui('À remplacer',  'danger'),
};

export function statutPiece(statut: string): StatutUI {
  return STATUT_PIECE[statut as RequisDocStatut] ?? ui(statut, 'muted');
}

// ─── Chantier ───────────────────────────────────────────────────────────────

/**
 * Le libellé était calculé par une chaîne de ternaires dans MonChantierPage :
 * tout statut non prévu retombait sur « Non démarré ». Un chantier « livré »
 * mal orthographié côté serveur se serait donc affiché comme jamais commencé.
 */
export const STATUT_CHANTIER: Record<ChantierStatut, StatutUI> = {
  'non-demarre': ui('Non démarré', 'muted'),
  'en-cours':    ui('En cours',    'warning'),
  suspendu:      ui('Suspendu',    'muted'),
  'en-retard':   ui('En retard',   'danger'),
  termine:       ui('Terminé',     'success'),
  livre:         ui('Livré',       'success'),
};

export function statutChantier(statut: string): StatutUI {
  return STATUT_CHANTIER[statut as ChantierStatut] ?? ui(statut, 'muted');
}

// ─── Orientation bancaire d'un dossier ──────────────────────────────────────

export const STATUT_BANQUE: Record<BankAssignmentStatut, StatutUI> = {
  'en-attente': ui('En cours d’étude',   'warning'),
  accord:       ui('Accord de principe', 'success'),
  refus:        ui('Non retenue',        'danger'),
};

export function statutBanque(statut: string): StatutUI {
  return STATUT_BANQUE[statut as BankAssignmentStatut] ?? ui(statut, 'muted');
}

// ─── Tranches de décaissement ───────────────────────────────────────────────

export type TrancheStatut = 'valide' | 'en-cours' | 'en-attente' | 'bloque';

export const STATUT_TRANCHE: Record<TrancheStatut, StatutUI> = {
  valide:       ui('Validée',    'success'),
  'en-cours':   ui('En cours',   'primary'),
  'en-attente': ui('En attente', 'warning'),
  bloque:       ui('Bloquée',    'danger'),
};
