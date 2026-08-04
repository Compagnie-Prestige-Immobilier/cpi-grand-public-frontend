/// <reference types="vite/client" />

// Les imports d'images (`.png`, `.jpg`…) sont résolus par Vite et deviennent une
// URL : la référence ci-dessus apporte leurs déclarations de module.

/**
 * Ressources Figma exportées, résolues vers `src/assets` par le greffon
 * `figmaAssetResolver` de vite.config.ts. Sans cette déclaration, TypeScript
 * ne peut pas connaître un schéma d'import propre à ce projet.
 */
declare module 'figma:asset/*' {
  const src: string;
  export default src;
}

/**
 * Variables de build lues dans le code applicatif. Déclarées explicitement pour
 * qu'une faute de frappe devienne une erreur de compilation plutôt qu'un
 * `undefined` silencieux au démarrage.
 *
 * `VITE_SITE_URL` et `VITE_GTAG_ID` ne figurent pas ici : elles sont lues par
 * vite.config.ts (côté Node), jamais par le code du navigateur.
 */
interface ImportMetaEnv {
  /** Base absolue de l'API. Vide = `/api` en relatif (proxy Vite ou même hôte). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
