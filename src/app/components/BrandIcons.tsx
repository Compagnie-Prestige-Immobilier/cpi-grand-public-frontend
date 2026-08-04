/**
 * Icônes de marque (Facebook, Instagram, LinkedIn) du pied de page.
 *
 * lucide-react 1.x a retiré ses icônes de marque — elles reproduisaient des
 * logos déposés, que la licence de la bibliothèque ne couvre pas. Les tracés
 * ci-dessous reprennent ceux de lucide 0.x (licence ISC) pour que le pied de
 * page ne change pas d'aspect : même grille 24, même trait, `currentColor`,
 * donc les survols qui pilotent la couleur du lien continuent de fonctionner.
 *
 * Trois icônes seulement : tout le reste vient de lucide-react, qui demeure la
 * bibliothèque unique du projet.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

/** Attributs communs : grille 24, trait de 2, couleur héritée du parent. */
function svgProps({ className, ...rest }: IconProps) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className,
    ...rest,
  };
}

export function Facebook(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function Instagram(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function Linkedin(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
