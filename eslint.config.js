// =============================================================================
// ESLint — configuration « plate » (ESLint 9)
//
// Trois familles de règles, et une seule raison d'être pour chacune :
//
//  1. Correction    — react-hooks, no-unused-vars… ce que `tsc` ne voit pas.
//  2. Accessibilité — jsx-a11y. L'audit a trouvé une case CGU inatteignable au
//                     clavier et des images sans alternative textuelle : ces
//                     défauts se détectent mécaniquement, ils ne devraient plus
//                     jamais dépendre d'une relecture humaine.
//  3. Design system — pas de couleur hexadécimale en dur, pas de taille de
//                     police littérale dans le JSX. Les tokens de
//                     src/styles/globals.css sont la source unique (docs/design.md).
//
// `typescript-eslint` n'est pas chargé depuis la racine mais depuis
// `tools/lint/`, qui embarque sa propre copie de l'API TypeScript 6 — voir
// l'explication complète dans tools/lint/index.js.
// =============================================================================

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const js = require('@eslint/js');
const tseslint = require('./tools/lint/index.js');
const reactHooks = require('eslint-plugin-react-hooks');
// Ce greffon n'est publié qu'en ESM : chargé par `require`, il arrive emballé
// dans `.default`. Les autres exposent directement leur objet de greffon.
const reactRefresh = require('eslint-plugin-react-refresh').default;
const jsxA11y = require('eslint-plugin-jsx-a11y');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

/**
 * Couleur écrite en dur : `#630210`, `#fff`, `#1A6B44`…
 *
 * Ces valeurs ont divergé écran par écran — c'est ce qui a produit un or
 * illisible sur fond clair et trois bordeaux différents. Tout passe par
 * `var(--…)` ou par `DS` (src/app/components/ui/index.tsx).
 */
const COULEUR_EN_DUR = String.raw`^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`;

export default tseslint.config(
  {
    // `dist/` est produit, `node_modules/` ne nous appartient pas, et le
    // fichier de types généré par le backend ne se corrige pas ici.
    ignores: [
      'dist/**',
      'node_modules/**',
      // Passerelle CommonJS vers la chaîne d'outils isolée (voir son en-tête) :
      // elle est chargée par ESLint lui-même, elle ne peut pas s'auto-analyser.
      'tools/lint/index.js',
      'src/app/api/types/generated.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: {
        // Analyse purement syntaxique : aucune des règles activées ici n'a
        // besoin du vérificateur de types. `tsc --noEmit` s'en charge, sur le
        // périmètre complet, et c'est lui qui bloque le build.
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ── Règles issues du compilateur React : signalées, non bloquantes ────
      //
      // `eslint-plugin-react-hooks` 7 embarque les vérifications du React
      // Compiler. Elles sont justes — un composant défini pendant le rendu perd
      // son état à chaque rafraîchissement, `Date.now()` pendant le rendu n'est
      // pas pur — mais les corriger suppose de remonter des composants et de
      // revoir des effets dans cinq écrans. Ce n'est pas une correction
      // mécanique, et bloquer l'intégration continue dessus aujourd'hui
      // conduirait à désactiver la règle plutôt qu'à traiter la dette.
      //
      // `rules-of-hooks`, elle, RESTE bloquante : c'est la seule qui décrit un
      // plantage certain, et elle en a trouvé un (AdminDashboard).
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // `tsc` a déjà `noUnusedLocals`. La règle ESLint ferait doublon, sauf sur
      // les arguments préfixés `_`, convention utilisée partout dans ce dépôt
      // pour les paramètres conservés par compatibilité de signature.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // `any` est encore présent dans les gabarits de graphiques Recharts, qui
      // n'exposent pas de types utilisables. Signalé, pas bloquant.
      '@typescript-eslint/no-explicit-any': 'warn',

      // ── Accessibilité : durcissements par rapport au préréglage ───────────
      //
      // FE-04 : la case « J'accepte les conditions » était un `<div>` cliquable.
      // Un utilisateur au clavier ne pouvait tout simplement pas s'inscrire.
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',

      // ── Design system ────────────────────────────────────────────────────
      //
      // `warn` et non `error` : la dette existante se compte en centaines
      // d'occurrences, et bloquer l'intégration continue dessus reviendrait à
      // désactiver la règle dans le mois. Le plan de résorption est écrit dans
      // docs/design.md § Dette de style — il n'est pas facultatif.
      'no-restricted-syntax': [
        'warn',
        {
          selector: `Literal[value=/${COULEUR_EN_DUR}/]`,
          message:
            'Couleur hexadécimale en dur. Utilisez un token : var(--primary), var(--foreground)… ou DS.status (voir docs/design.md).',
        },
        {
          selector: "Property[key.name='fontSize'] > Literal",
          message:
            "Taille de police littérale. Utilisez l'échelle typographique du design system (var(--text-…), voir docs/design.md § Dette de style).",
        },
      ],
    },
  },

  {
    // Le design system lui-même : c'est le seul endroit où une couleur peut
    // être écrite en clair, puisque c'est lui qui la définit.
    files: ['src/app/components/ui/index.tsx', 'src/app/lib/statuts.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  {
    // Fichiers de configuration et tests : environnement Node, pas de JSX.
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off' },
  },

  // En dernier : neutralise les règles de mise en forme qui entreraient en
  // conflit avec Prettier. Aucune divergence possible entre les deux outils.
  prettier,
);
