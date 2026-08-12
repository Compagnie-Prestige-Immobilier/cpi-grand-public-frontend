/**
 * Visuels hébergés hors de la plateforme, et leur repli.
 *
 * Les photos d'illustration sont chargées depuis Unsplash. Rien ne garantit
 * qu'elles répondent : le service peut être bloqué par un pare-feu
 * d'entreprise, indisponible, ou simplement inaccessible depuis une connexion
 * dégradée — situation ordinaire pour une partie des utilisateurs visés.
 *
 * Sans repli, l'échec ne se voyait pas de la même manière selon le support :
 *  - en fond CSS (`backgroundImage`), le bloc devenait transparent et le texte
 *    blanc posé dessus passait sur du blanc — l'écran de connexion et l'en-tête
 *    du chantier devenaient illisibles ;
 *  - en `<img>`, la carte affichait l'icône d'image cassée du navigateur.
 *
 * Le dégradé ci-dessous est déclaré COMME DEUXIÈME COUCHE de `background-image`.
 * Le navigateur peint les couches de haut en bas : si la photo ne charge pas,
 * le dégradé reste, et le contraste du texte est préservé.
 */

/** Dégradé bordeaux du design system, utilisé comme couche de repli. */
export const DEGRADE_REPLI =
  'linear-gradient(140deg, var(--primary) 0%, var(--primary-hover) 55%, var(--foreground) 100%)';

/** `background-image` d'une photo distante, dégradé de repli inclus. */
export function fondPhoto(url: string): string {
  return `url(${url}), ${DEGRADE_REPLI}`;
}

/**
 * Repli d'une `<img>` distante : la balise disparaît au profit du dégradé de
 * son conteneur, plutôt que d'afficher une icône d'image cassée.
 */
export function replierImage(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  img.style.display = 'none';
  const parent = img.parentElement;
  if (parent) parent.style.backgroundImage = DEGRADE_REPLI;
}
