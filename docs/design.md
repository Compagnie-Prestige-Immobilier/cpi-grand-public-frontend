# Design system — MONESPACE.CPI

Référence unique du design de l'espace client et du back-office CPI.
Toutes les valeurs citées ici existent réellement dans **`src/styles/globals.css`**
et dans **`src/app/components/ui/index.tsx`**. Si un chiffre de ce document ne
correspond plus au code, c'est le code qui fait foi — et ce document qu'il faut
corriger.

- **Source unique des tokens** : `src/styles/globals.css`
- **Chaîne d'import** : `src/main.tsx` → `src/styles/index.css` → `fonts.css`,
  Tailwind, `globals.css`. Il n'y a **pas** d'autre feuille de thème.
- **Bibliothèque de composants** : `src/app/components/ui/index.tsx`

---

## 1. Principes

1. **Structure Material Design 3, palette CPI.** On emprunte à Material 3 sa
   *structure* — rôles de couleur, échelle typographique, grille 4 pt, state
   layers, anneau de focus, seuils d'accessibilité. On n'emprunte **aucune**
   couleur : l'identité visuelle CPI (prune `#630210`, or `#C8921A`, fond
   `#FAF7F7`) est conservée telle quelle.
2. **Un token, un rôle.** On n'écrit jamais une couleur en dur dans le JSX. Une
   couleur qui n'a pas de token n'a pas de rôle : il faut lui en créer un.
3. **Le contraste n'est pas négociable.** Toute paire texte/fond est vérifiée
   ≥ 4,5:1 (WCAG 2.1 AA). Tout élément d'interface non textuel porteur de sens
   (bordure d'un champ, trait d'un graphique) est vérifié ≥ 3:1.
4. **L'écran dit la vérité.** Un bouton ne confirme jamais une action qui n'a pas
   eu lieu ; une donnée absente s'affiche comme absente, pas comme un zéro.
5. **Sobriété.** Le produit manipule de l'argent réel et des actes notariés. Pas
   d'animation spectaculaire, pas de couleur qui ne porte pas de sens.

---

## 2. Rôles de couleur

Toutes les valeurs sont dans `:root` de `globals.css`. Les ratios ci-dessous
sont calculés selon la formule de luminance relative WCAG 2.1 et arrondis à
deux décimales.

### 2.1 Surfaces

| Token | Valeur | Rôle |
|---|---|---|
| `--background` | `#FAF7F7` | Fond général de l'application |
| `--card` | `#ffffff` | Cartes, panneaux, feuilles |
| `--popover` | `#ffffff` | Menus, info-bulles, boîtes de dialogue |
| `--secondary` | `#F5ECEE` | Surface prune très claire (états sélectionnés) |
| `--muted` | `#EDE4E6` | Surface neutre (états inactifs, séparateurs pleins) |
| `--input-background` | `#F5ECEE` | Fond des champs de saisie |
| `--sidebar` | `#3A010A` | Bandeau latéral (surface sombre) |
| `--sidebar-accent` | `#4A0110` | Entrée de menu active du bandeau |

### 2.2 Contenus sur surfaces claires

| Texte | Sur `--card` (#ffffff) | Sur `--background` (#FAF7F7) | Verdict |
|---|---|---|---|
| `--foreground` `#1C0810` | **19,24:1** | **18,06:1** | AAA |
| `--muted-foreground` `#6B4A52` | **7,70:1** | **7,23:1** | AAA |
| `--primary` `#630210` | **13,58:1** | **12,74:1** | AAA |
| `--destructive` `#B91C1C` | **6,47:1** | **6,07:1** | AA |
| `--success` `#1A6B44` | **6,50:1** | **6,10:1** | AA |
| `--info` `#A34462` | **5,90:1** | **5,54:1** | AA |
| `--accent-text` `#856011` | **5,71:1** | **5,36:1** | AA |
| `--accent` `#C8921A` | **2,77:1** | **2,60:1** | **ÉCHEC — jamais en texte** |

### 2.3 Contenus sur surfaces sombres

| Texte | Sur `--sidebar` (#3A010A) | Sur `--primary` (#630210) |
|---|---|---|
| `#ffffff` | **17,67:1** | **13,58:1** |
| `--sidebar-foreground` `#DFC0C8` | **10,53:1** | — |
| `--accent-on-dark` `#FFC65A` | **11,34:1** | **8,71:1** |

### 2.4 Or CPI — la règle la plus importante de ce document

L'or `#C8921A` **échoue WCAG AA en texte** : 2,77:1 sur blanc, 2,60:1 sur
`--background`, et 2,53:1 dans un badge « attention » (or à 10 % composé sur
blanc). Il échoue même le seuil « grand texte » de 3:1. Quatre tokens séparent
désormais les usages :

| Token | Valeur | Usage autorisé | Ratio |
|---|---|---|---|
| `--accent` | `#C8921A` | **Surfaces décoratives uniquement** : aplats, dégradés, points de jalon, remplissages de barre de progression. Jamais du texte. | — |
| `--accent-foreground` | `#1C0810` | Texte posé **sur** une surface or | 6,95:1 sur `#C8921A` |
| `--accent-text` (= `--warning`) | `#856011` | **Tout texte et toute icône or** sur fond clair | 5,71 / 5,36 / 4,92 / 4,58 (card / background / secondary / muted) |
| `--accent-border` | `#A87A15` | Traits, bordures, séries de graphique | 3,85:1 sur blanc (seuil 3:1) |
| `--accent-on-dark` | `#FFC65A` | Texte or **sur surface bordeaux sombre** uniquement | 11,34:1 sur `--sidebar` |

### 2.5 Couples de statut (`DS.status`)

Les fonds sont des couleurs **opaques**, jamais des `rgba()` : un badge posé sur
autre chose que du blanc composait sinon une teinte imprévisible et le ratio
annoncé ne valait plus rien.

| Variante | Texte | Fond | Ratio |
|---|---|---|---|
| `success` | `--success` `#1A6B44` | `--success-surface` `#E8F0EC` | **5,60:1** |
| `warning` | `--accent-text` `#856011` | `--warning-surface` `#FAF4E8` | **5,21:1** |
| `danger` | `--destructive` `#B91C1C` | `--destructive-surface` `#F8E8E8` | **5,45:1** |
| `info` | `--info` `#A34462` | `--info-surface` `#F7EEF1` | **5,18:1** |
| `muted` | `--muted-foreground` `#6B4A52` | `--muted` `#EDE4E6` | **6,18:1** |
| `primary` | `--primary` `#630210` | `--secondary` `#F5ECEE` | **11,71:1** |

### 2.6 Graphiques

`--chart-1` … `--chart-5` = `#630210`, `#C8921A`, `#1A6B44`, `#B05070`,
`#8B5CF6`. Ce sont des **objets non textuels** : le seuil applicable est 3:1
contre la surface adjacente, pas 4,5:1. `--chart-2` (`#C8921A`, 2,77:1) ne
respecte pas ce seuil sur fond blanc : pour un trait fin ou une légende, utiliser
`--accent-border` (`#A87A15`, 3,85:1). Une série de graphique ne doit jamais être
identifiable **par la seule couleur** — libellé direct ou motif en complément.

---

## 3. Typographie

Deux familles, chargées depuis Google Fonts (`src/styles/fonts.css`) :

- `--font-display` : **Bricolage Grotesque** — titres, chiffres marquants, KPI.
- `--font-sans` : **Plus Jakarta Sans** — tout le reste.

Racine `--font-size: 16px`. Titres resserrés à `letter-spacing: -0.02em`.

| Token | Valeur | Usage |
|---|---|---|
| `--fs-display` | `clamp(2rem, 4vw, 2.75rem)` | Titre de page d'accueil / héros |
| `--fs-h1` | `clamp(1.625rem, 3vw, 2rem)` | Titre d'écran |
| `--fs-h2` | `1.5rem` | Titre de section |
| `--fs-h3` | `1.25rem` | Sous-section |
| `--fs-h4` | `1.0625rem` | Titre de carte |
| `--fs-body-xl` | `1.125rem` | Chapô, texte d'introduction |
| `--fs-body` | `0.9375rem` | Texte courant |
| `--fs-small` | `0.8125rem` | Texte secondaire, méta |
| `--fs-caption` | `0.75rem` | Légende, aide contextuelle |
| `--fs-label` | `0.6875rem` | Étiquette majuscule, badge |

Hauteurs de ligne : `--lh-tight: 1.15` (titres), `--lh-snug: 1.35` (sous-titres),
`--lh-normal: 1.55` (texte courant).

Graisses : `--font-weight-normal: 400`, `--font-weight-medium: 600`. Les titres
display montent à 700–800, les badges à 700.

**Plancher de taille** : jamais en dessous de `--fs-label` (0,6875 rem ≈ 11 px)
pour un contenu porteur de sens. Sur mobile, les champs de saisie sont forcés à
16 px (`globals.css`, `@media (max-width: 767px)`) : en dessous, iOS zoome
automatiquement au focus.

---

## 4. Espacement — grille 4 pt

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` ·
`--space-5: 20px` · `--space-6: 24px` · `--space-8: 32px` · `--space-10: 40px` ·
`--space-12: 48px` · `--space-16: 64px` · `--space-20: 80px`

Conventions :

- Padding interne d'une carte : `--space-4` à `--space-5` (mobile) /
  `--space-5` à `--space-6` (desktop).
- Écart entre cartes d'une grille : `--space-4`.
- Écart entre sections d'un écran : `--space-6` à `--space-8`.
- Écart icône ↔ libellé : `--space-2`.

Toute valeur d'espacement doit être un multiple de 4. Les valeurs impaires
héritées (`7px 14px` dans `Btn`, `9px` dans les grilles mobiles) sont des dettes
identifiées, à résorber lors de la prochaine passe sur les composants concernés.

---

## 5. Rayons

`--r-xs: 6px` · `--r-sm: 8px` · `--r-md: 12px` · `--r-lg: 16px` · `--r-xl: 20px`
· `--r-2xl: 24px` · `--r-full: 9999px`

- Boutons secondaires, champs, badges rectangulaires : `--r-sm` / `--r-md`.
- Cartes et panneaux : `--r-md`.
- Feuilles mobiles, modales : `--r-xl` (coins hauts seulement pour une feuille).
- Boutons principaux, pastilles, badges de statut : `--r-full`.

`--radius: 0.25rem` alimente les utilitaires Tailwind `rounded-*` ; l'application
utilise en pratique l'échelle `--r-*` en style inline.

---

## 6. Élévation

Ombres teintées de prune (`rgba(28,8,16,·)`), jamais de gris neutre ni de bleu.

| Token | Usage |
|---|---|
| `--elev-xs` | Séparation minimale, bandeau collant |
| `--elev-sm` | Carte au repos |
| `--elev-md` | Carte survolée, menu déroulant |
| `--elev-lg` | Panneau latéral, popover |
| `--elev-xl` | Modale, feuille mobile |
| `--shadow-hover` | `0 6px 22px rgba(99,2,16,0.10)` — survol d'une carte cliquable |

---

## 7. State layers (Material 3)

Opacités uniques pour toute l'application, appliquées à la couleur de premier
plan par-dessus la surface :

| Token | Valeur | État |
|---|---|---|
| `--state-hover` | `0.08` | Survol |
| `--state-focus` | `0.10` | Focus |
| `--state-pressed` | `0.12` | Pression |
| `--state-selected` | `0.12` | Sélection |
| `--state-dragged` | `0.16` | Glissé |
| `--state-disabled-content` | `0.38` | Contenu désactivé |
| `--state-disabled-container` | `0.12` | Conteneur désactivé |

Le retour de pression global est déjà posé dans `globals.css` :
`:where(button, a, [role="button"], summary):active:not(:disabled) { transform: scale(0.985) }`.
La classe `.cpi-lift` fournit le survol élevé des cartes cliquables.

---

## 8. Anneau de focus

```css
--ring: #630210;
--ring-focus: 0 0 0 3px rgba(99, 2, 16, 0.30);
```

Appliqué globalement à `a, button, input, select, textarea, [role="button"],
[tabindex]:not([tabindex="-1"])` en `:focus-visible` — donc **au clavier
uniquement**, jamais au clic souris. Aucun composant ne doit poser
`outline: none` sans fournir un remplacement visible : c'est la première cause
de perte de repère pour la navigation au clavier.

---

## 9. Motion

| Token | Valeur | Usage |
|---|---|---|
| `--dur-1` | `150ms` | Couleur, survol |
| `--dur-2` | `220ms` | Ombre, échelle, apparition d'un badge |
| `--dur-3` | `300ms` | Entrée de page, feuille, tiroir |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Défaut |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Apparition ponctuelle |

Animations nommées disponibles : `.cpi-page-enter`, `.cpi-animate-in`,
`.cpi-stagger` (cascade des enfants directs), `.cpi-scale-in`, `.cpi-slide-up`,
`.cpi-drawer-enter`, `.cpi-backdrop-enter`, `.cpi-skeleton`.

**Règle `animation-fill-mode`** : toujours `backwards`, **jamais** `both` ni
`forwards`. Avec `both`, l'élément conserve après coup une valeur de `transform`
calculée — l'identité, invisible, mais qui n'est pas le mot-clé `none` : elle
fait de l'élément le bloc conteneur de ses descendants en `position: fixed`, et
toasts, modales et panneaux se positionnent alors par rapport à la page au lieu
de la fenêtre.

**Mouvement réduit** : `@media (prefers-reduced-motion: reduce)` ramène
globalement toutes les durées d'animation et de transition à `0.01ms` et
désactive le défilement doux. Les animations pilotées en JavaScript (bibliothèque
`motion`) doivent en outre consulter `useReducedMotion()` : la règle CSS ne les
atteint pas.

---

## 10. Points de rupture

L'application suit les points de rupture Tailwind par défaut. Trois seulement
sont réellement utilisés dans le code :

| Nom | Largeur | Usages |
|---|---|---|
| `sm` | 640 px | 41 |
| `md` | 768 px | 20 |
| `lg` | 1024 px | 44 |

La bascule structurante est **767 px** : en dessous, `globals.css` remplace le
bandeau latéral par une barre de navigation basse (`.cpi-mobile-bottom-nav`) plus
une feuille « Plus » (`.cpi-mobile-more-sheet`), aplatit les grilles multi-colonnes
et impose une hauteur minimale de 44 px aux éléments interactifs.

---

## 11. Inventaire des composants — `src/app/components/ui/index.tsx`

| Composant | Rôle |
|---|---|
| `DS` | Objet de tokens JavaScript : `radius`, `shadow`, `transition`, `status` |
| `StatusBadge` | **Le seul** badge de statut de l'application. Variantes `success` / `warning` / `danger` / `info` / `muted` / `primary`, tailles `sm` / `md`, point optionnel |
| `Btn` | Bouton. Variantes `primary` / `secondary` / `outline` / `ghost` / `danger` / `success` / `icon`, tailles `sm` / `md` / `lg`, états `loading` / `disabled`, `ariaLabel` |
| `Field` | Champ de formulaire étiqueté (label associé, message d'erreur, aide) |
| `SmartCard` | Carte générique, avec survol élevé optionnel |
| `CardHeader` | En-tête de carte : icône pastillée, titre, action à droite |
| `CardDivider` | Séparateur horizontal interne à une carte |
| `KPICard` | Indicateur chiffré avec tendance |
| `HeroCard` | Bandeau bordeaux d'en-tête d'écran |
| `TimelineItem` | Étape de chronologie verticale |
| `ActionRow` | Ligne d'action cliquable avec chevron |
| `UploadCard` | Dépôt d'une pièce justificative (`DocStatus`, `DOC_STATUS_CFG`) |
| `MediaThumb` | Vignette d'image ou de document |
| `EmptyState` | État vide typé : `empty`, `no-docs`, `no-notifs`, `no-chantier`, `error`, `offline`, `no-results` |
| `ProgressBar` | Barre de progression |
| `SectionHeader` | Titre de section d'écran |
| `InlineAlert` | Message contextuel en ligne |
| `useCountUp` | Animation de comptage d'un nombre |

**Règle** : un besoin déjà couvert par cette liste ne se réimplémente pas
localement. `StatusBadge` en particulier avait été réécrit à la main dans une
dizaine d'écrans, avec des jeux de statuts divergents — c'est ainsi qu'un statut
`refuse` s'affichait « Disponible » dans le suivi des dossiers agents.

---

## 12. États d'un composant

Tout composant interactif ou piloté par des données doit traiter les huit états
suivants. Un écran qui n'en traite pas un est incomplet.

| État | Traitement attendu |
|---|---|
| **Repos** | Style par défaut du token |
| **Survol** | State layer `--state-hover`, ou `.cpi-lift` pour une carte |
| **Focus** | `--ring-focus`, visible au clavier, jamais supprimé |
| **Actif / pressé** | `scale(0.985)` global, ou state layer `--state-pressed` |
| **Désactivé** | `opacity` ≈ `--state-disabled-content`, `cursor: not-allowed`, attribut `disabled` réel (jamais un simple style) |
| **Chargement** | `aria-busy`, libellé au participe présent (« Envoi en cours… »), `cursor: progress`. Squelette `.cpi-skeleton` pour un écran entier |
| **Erreur** | Message en clair, cause et action de sortie. `role="alert"`, `aria-invalid` sur le champ fautif, `aria-describedby` vers le message |
| **Vide** | `EmptyState` typé, avec une action de sortie quand elle existe |

Un écran piloté par une requête réseau expose obligatoirement les trois derniers :
chargement, erreur (avec « Réessayer »), vide.

---

## 13. Accessibilité — socle

- `lang="fr"` sur `<html>` (`index.html`).
- Un seul `<h1>` par écran, puis descente de niveau sans saut.
- Repères ARIA : `<header>`, `<nav aria-label>`, `<main id="cpi-main">`,
  `<aside>`. Lien d'évitement `.cpi-skip` vers `#cpi-main`.
- Tout bouton icône-seule porte un `aria-label`.
- Tout champ possède un `<label htmlFor>` associé à un `id` réel. Un
  `placeholder` n'est pas une étiquette.
- Une erreur de saisie pose `aria-invalid="true"` et `aria-describedby` vers le
  message.
- Aucun `<div onClick>` : un élément cliquable est un `<button>` ou un `<a>`.
  À défaut, `role`, `tabIndex={0}` et gestion de <kbd>Entrée</kbd> /
  <kbd>Espace</kbd>.
- Toute image porteuse d'information est un `<img alt>` descriptif — jamais un
  `background-image` CSS, qui rend le texte alternatif impossible.
- Modales et tiroirs : `@radix-ui/react-dialog` ou `react-alert-dialog`, qui
  fournissent piège de focus, fermeture par <kbd>Échap</kbd>, `role="dialog"`,
  `aria-modal` et restitution du focus.
- Cible tactile minimale : `--tap-min` (44 px).
- L'information n'est jamais portée par la seule couleur : un statut associe
  toujours une couleur **et** un libellé.

---

## 14. Conventions de rédaction (français)

- **Vouvoiement** systématique. « Votre dossier », jamais « ton dossier » ni
  « mon dossier » dans un bouton d'action.
- **Majuscule initiale seule** dans les titres et les libellés de boutons :
  « Déposer une pièce », pas « Déposer Une Pièce ». Les badges de statut sont
  l'exception : ils sont rendus en capitales par `text-transform`, le texte
  source restant en casse normale.
- **Espace insécable** avant `: ; ! ?` et à l'intérieur des guillemets français
  « … ». Apostrophe typographique `’`.
- **Montants** : `1 250 000 FCFA` — séparateur de milliers par espace insécable
  fine, devise après le nombre. Le formatage passe exclusivement par
  `src/app/lib/format.ts`.
- **Dates** : `12 août 2026` en toutes lettres dans le corps de texte,
  `12/08/2026` dans un tableau dense.
- **Messages d'erreur** : dire ce qui s'est passé et quoi faire.
  « Le serveur CPI est injoignable pour le moment. Réessayez dans un instant. »
  Jamais de vocabulaire technique adressé au client (« backend », « endpoint »,
  « token », « payload »), jamais de code d'erreur brut.
- **Aucune promesse de fonctionnalité future** dans l'interface : une section non
  disponible se masque, elle n'annonce pas son propre inachèvement.

---

## 15. Dette connue et plan de résorption

Mesures relevées le 12 août 2026 sur `src/app` (hors `components/ui/`) :

| Constat | Volume |
|---|---|
| Attributs `style={{ }}` en ligne | **2 699** |
| Occurrences de `fontSize` littéral | **1 205**, pour **48** valeurs distinctes |
| Occurrences de `fontSize` utilisant un token `--fs-*` | **3** |
| Couleurs hexadécimales écrites en dur | **227**, pour **42** valeurs distinctes |

Les règles ESLint `no-restricted-syntax` d'`eslint.config.js` détectent les deux
dernières familles. Elles sont volontairement en **`warn`** : les passer en
`error` bloquerait la CI sur plus de mille occurrences préexistantes.

**Plan de résorption** — à appliquer par écran, jamais en une passe globale :

1. Toute **nouvelle** ligne de JSX utilise les tokens. Un avertissement ESLint
   introduit par un correctif se corrige dans ce même correctif.
2. À chaque intervention fonctionnelle sur un écran, convertir les `fontSize` de
   cet écran vers `--fs-*` et ses hex vers les tokens de rôle. Les cinq valeurs
   les plus fréquentes couvrent 78 % du volume : `0.8125rem` → `--fs-small`,
   `0.75rem` → `--fs-caption`, `0.875rem` → (nouveau `--fs-body-sm`),
   `0.6875rem` → `--fs-label`, `0.9375rem` → `--fs-body`.
3. Quand un fichier atteint zéro avertissement, l'ajouter à une liste
   `files` en `error` dans `eslint.config.js` pour empêcher la régression.
4. Quand tous les fichiers y figurent, basculer la règle globale en `error` et
   supprimer la liste.

---

## 16. Références internes

- Tokens : `src/styles/globals.css`
- Composants : `src/app/components/ui/index.tsx`
- Formatage devise / dates : `src/app/lib/format.ts`
- Règles de verrouillage : `eslint.config.js`
- Ce document remplace l'ancien `guidelines/Guidelines.md`.
