// Point d'entrée du sous-paquet : il réexporte typescript-eslint.
//
// L'intérêt n'est pas le code — c'est l'ENDROIT d'où il est chargé. Résolu
// depuis ce dossier, `require('typescript')` tombe sur
// tools/lint/node_modules/typescript (6.0.3), et non sur le TypeScript 7 du
// projet, dont le paquet npm n'expose plus d'API JavaScript (binaire Go) et
// que @typescript-eslint refuse explicitement de charger.
//
// C'est la mise en œuvre littérale de l'exécution « côte à côte » recommandée
// par l'annonce de TypeScript 7. `tsc` reste en 7 pour le typecheck et le
// build ; seule l'analyse syntaxique d'ESLint utilise l'API 6.
//
// À supprimer le jour où typescript-eslint saura lire TS ≥ 7
// (typescript-eslint#10940) : remonter `typescript-eslint` dans les
// devDependencies de la racine, retirer le workspace, et rien d'autre.

module.exports = require('typescript-eslint');
