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
 */

import type { StatusVariant } from '../components/ui/index';
import { DS } from '../components/ui/index';
import type { CpiDocStatus } from '../data/cpiDocsContext';
import type { DocStatus } from '../data/demoStore';

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
export const STATUT_DOC_CPI: Record<CpiDocStatus, StatutUI> = {
  brouillon:  ui('Brouillon',  'muted'),
  publie:     ui('Publié',     'success'),
  disponible: ui('Disponible', 'primary'),
  'a-signer': ui('À signer',   'danger'),
  signe:      ui('Signé',      'success'),
  // Absent d'une des deux tables : un document refusé s'affichait « Disponible ».
  refuse:     ui('Refusé',     'danger'),
  archive:    ui('Archivé',    'warning'),
};

/** Lecture sûre : un statut inconnu se signale comme tel, il ne se déguise pas. */
export function statutDocCpi(statut: string): StatutUI {
  return STATUT_DOC_CPI[statut as CpiDocStatus] ?? ui(statut, 'muted');
}

// ─── Pièces justificatives déposées par le client ───────────────────────────

export const STATUT_PIECE: Record<DocStatus, StatutUI> = {
  'en-attente':  ui('Non déposée',  'muted'),
  depose:        ui('À vérifier',   'info'),
  verification:  ui('En vérification', 'warning'),
  accepte:       ui('Validée',      'success'),
  refuse:        ui('Refusée',      'danger'),
  'a-remplacer': ui('À remplacer',  'danger'),
};

export function statutPiece(statut: string): StatutUI {
  return STATUT_PIECE[statut as DocStatus] ?? ui(statut, 'muted');
}

// ─── Tranches de décaissement ───────────────────────────────────────────────

export type TrancheStatut = 'valide' | 'en-cours' | 'en-attente' | 'bloque';

export const STATUT_TRANCHE: Record<TrancheStatut, StatutUI> = {
  valide:       ui('Validée',    'success'),
  'en-cours':   ui('En cours',   'primary'),
  'en-attente': ui('En attente', 'warning'),
  bloque:       ui('Bloquée',    'danger'),
};
