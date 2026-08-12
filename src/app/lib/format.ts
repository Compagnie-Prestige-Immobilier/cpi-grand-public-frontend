/**
 * Formatage et lecture des nombres, montants et dates françaises.
 *
 * Point unique de l'application. Ces fonctions existaient auparavant en dix
 * copies (`fmt`, `fmtN`, `fmtFCFA`, `fmtMontant`, `parseAmount`) et six copies
 * de `MONTHS_FR` / `parseFrDate` / `sortKey`, chacune avec ses écarts : l'une
 * arrondissait, l'autre non ; l'une renvoyait `now` pour une chaîne vide,
 * l'autre `null` ; l'une reconnaissait « Aujourd'hui », les autres non. Un
 * montant affiché n'avait donc pas la même forme selon l'écran.
 */

// ─── Nombres et montants ─────────────────────────────────────────────────────

/**
 * Nombre au format français : séparateur de milliers par espace insécable
 * étroite, tel que le produit `Intl` pour `fr-FR`.
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

/**
 * Montant en francs CFA. Toujours arrondi à l'unité : le FCFA n'a pas de
 * subdivision en circulation, afficher des décimales serait faux.
 */
export function formatFCFA(n: number): string {
  return `${formatNumber(Math.round(n))} FCFA`;
}

/** Montant sans la devise (l'unité est portée par le libellé voisin). */
export function formatAmount(n: number): string {
  return formatNumber(Math.round(n));
}

/**
 * Lit un montant saisi au clavier. Tout caractère non numérique est ignoré :
 * l'utilisateur peut coller « 12 500 000 FCFA » ou « 12.500.000 ».
 */
export function parseAmount(saisie: string): number {
  return parseInt(saisie.replace(/\D/g, ''), 10) || 0;
}

/**
 * Reformate une saisie libre de montant pour l'affichage.
 *
 * Si la saisie n'est pas numérique, elle est renvoyée telle quelle plutôt que
 * transformée en « NaN » sous les yeux de l'utilisateur.
 */
export function formatMontantSaisi(valeur: string): string {
  const n = Number(valeur);
  return valeur.trim() !== '' && Number.isFinite(n) ? formatNumber(n) : valeur;
}

// ─── Dates françaises ────────────────────────────────────────────────────────

export const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/** Abréviations distinctes deux à deux — « juin » ≠ « juil ». */
export const MONTHS_ABBR = [
  'jan', 'fév', 'mar', 'avr', 'mai', 'juin',
  'juil', 'août', 'sep', 'oct', 'nov', 'déc',
] as const;

/**
 * Retire les accents et met en minuscules.
 *
 * Indispensable : les copies précédentes comparaient directement à « août » et
 * « février ». Une date écrite « 3 aout 2026 » ou « 5 fevrier 2026 » — ce que
 * produit n'importe quelle saisie sans clavier accentué — n'était pas reconnue,
 * et `sortKey` la rangeait alors en janvier.
 */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const MONTHS_FOLDED = MONTHS_FR.map(fold);

/** Index 0–11 du mois désigné, ou −1. Accepte le nom complet et l'abrégé. */
export function monthIndexFr(nom: string): number {
  const n = fold(nom).replace(/\.$/, '');
  // Comparaison par préfixe de 4 caractères : « juin » et « juil » restent
  // distincts, « sept » couvre « septembre » comme « sept. ».
  return MONTHS_FOLDED.findIndex(m => n.startsWith(m.slice(0, 4)));
}

const FR_DATE_RE = /(\d{1,2})\s+([^\s]+)\s+(\d{4})/;

/**
 * Lit une date française du type « 18 juin 2026 ».
 *
 * @param date  Chaîne à lire. `null`, vide ou « — » donnent `null`.
 * @param now   Valeur renvoyée pour « Aujourd'hui ». Passer l'instant courant
 *              du composant plutôt que `new Date()` rend le rendu déterministe
 *              et testable.
 */
export function parseFrDate(date: string | null | undefined, now?: Date): Date | null {
  if (!date || date === '—') return null;
  if (/aujourd/i.test(date)) return now ?? new Date();
  const m = FR_DATE_RE.exec(date);
  if (!m) return null;
  const idx = monthIndexFr(m[2]);
  if (idx < 0) return null;
  return new Date(Number(m[3]), idx, Number(m[1]));
}

/**
 * Clé de tri lexicographique `AAAA-MM-JJ hh:mm` construite depuis une date
 * française et une heure. Les valeurs illisibles sont renvoyées telles quelles :
 * elles se rangent alors ensemble, en fin de liste, plutôt que d'être toutes
 * datées de janvier.
 */
export function frDateSortKey(date: string, heure: string): string {
  const m = FR_DATE_RE.exec(date);
  if (!m) return `${date} ${heure}`;
  const idx = monthIndexFr(m[2]);
  if (idx < 0) return `${date} ${heure}`;
  const jour = m[1].padStart(2, '0');
  const mois = String(idx + 1).padStart(2, '0');
  return `${m[3]}-${mois}-${jour} ${heure || '00:00'}`;
}

/** Date en toutes lettres : « 12 août 2026 ». */
export function formatFrDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/** Date compacte pour un tableau dense : « 12/08/2026 ». */
export function formatFrDateShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Ancienneté d'un dépôt, en français, relative à `now`.
 * Renvoie une chaîne vide si la date est illisible — l'appelant n'affiche alors
 * rien plutôt qu'une mention fausse.
 */
export function ageDepotLabel(date: string, now: Date = new Date()): string {
  const d = parseFrDate(date, now);
  if (!d) return '';
  const jours = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (jours <= 0) return "déposé aujourd'hui";
  if (jours === 1) return 'déposé hier';
  return `déposé il y a ${jours} jours`;
}
