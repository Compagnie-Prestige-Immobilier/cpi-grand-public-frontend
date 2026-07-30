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
