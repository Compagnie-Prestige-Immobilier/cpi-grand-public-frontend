# Guidelines — voir `docs/design.md`

Le design system de MONESPACE.CPI est documenté dans **[`../docs/design.md`](../docs/design.md)**.

C'est la seule référence : rôles de couleur et ratios de contraste mesurés,
échelle typographique, grille 4 pt, rayons, élévations, state layers, anneau de
focus, durées de motion, inventaire des composants de
`src/app/components/ui/index.tsx`, états attendus d'un composant, conventions de
rédaction française, points de rupture et socle d'accessibilité.

---

## Pourquoi ce fichier ne contient plus rien d'autre

Ce fichier était le gabarit vierge déposé par Figma Make, jamais rempli. Il
contenait, sous un bloc `<!-- make-kit-guidelines -->`, des instructions
impératives adressées à un agent : lire `guidelines/setup.md`, lire les fichiers
du paquet npm `@figma/astraui-kit` dans `node_modules`, et « exécuter toutes les
étapes de configuration sans en sauter, modifier ni improviser aucune ».

Or :

- `@figma/astraui-kit` n'est **pas** une dépendance de ce projet et n'existe pas
  dans le registre npm ;
- `guidelines/setup.md` n'a jamais existé dans ce dépôt ;
- le projet est géré par **npm**, pas par pnpm comme l'affirmait le bloc.

Un agent suivant ces instructions à la lettre partait donc chercher des fichiers
introuvables, puis improvisait — exactement ce que le bloc lui interdisait. Le
reste du fichier était le texte d'exemple du gabarit (« Use a base font-size of
14px », « Date formats should always be in the format “Jun 10” »), en
contradiction directe avec le design réel de CPI.

Le renvoi ci-dessus remplace l'ensemble.
