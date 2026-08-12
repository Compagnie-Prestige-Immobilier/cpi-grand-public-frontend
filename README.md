# CPI Immobilier — MONESPACE.CPI

Plateforme de financement immobilier pour le Sénégal (fonctionnaires, secteur privé, diaspora). Application **React + Vite** avec trois espaces distincts et un design system maison.

🎨 [**Design d'origine (Figma)**](https://www.figma.com/design/ZxadxXNEWOPOWFg1xKdZux/Crowdfunding-Platform-UI-UX-Design--Community-)

> Cette application **nécessite l'API Laravel** [`cpi-chues-backend`](../backend) : toutes les données métier y vivent. Un hébergement statique seul (GitHub Pages…) ne suffit plus.

---

## Espaces

| Rôle | Accès | Fonctions clés |
| --- | --- | --- |
| **Client** | Espace client | Simulateur de prêt, demande de financement, suivi du dossier et des pièces, documents CPI, chantier, notifications |
| **Agent CPI** | Espace professionnel | Traitement des dossiers, documents clients/CPI, décaissements bancaires, suivi de chantier, historique |
| **Administrateur** | Espace professionnel | Vue globale, utilisateurs, partenaires bancaires, tous les décaissements, journal d'audit, statistiques, jeu de démonstration |

### Comptes

| Rôle | Identifiant | Mot de passe |
| --- | --- | --- |
| Agent CPI | `agent@cpi.sn` | `agent1234` |
| Administrateur | `admin@cpi.sn` | `admin1234` |

Les clients s'inscrivent librement (e-mail + mot de passe, ou Google). Les comptes du personnel sont créés par l'administrateur depuis l'application.

Pour peupler l'application, l'administrateur dispose de **Système → Données de démo** : 30 dossiers répartis sur tout le parcours, supprimables d'un clic sans toucher aux dossiers réels.

---

## Stack

- **React 19 + Vite 8**, **TypeScript 7 strict**
- **TanStack Query** pour toutes les lectures et mutations · **axios** pour le transport
- Styles : CSS-in-JS inline + variables CSS (design tokens) + Tailwind
- Graphiques : **Recharts** · Icônes : **lucide-react** (bibliothèque unique, hors les trois icônes de marque du pied de page : lucide 1.x les a retirées, voir `src/app/components/BrandIcons.tsx`)
- Polices : **Bricolage Grotesque** (titres) · **Plus Jakarta Sans** (texte)

### Données : le serveur fait autorité

Le navigateur ne conserve **aucune donnée métier**. Deux clés seulement subsistent dans `localStorage` :

| Clé | Rôle |
| --- | --- |
| `cpi_api_token` | Jeton d'authentification — confiné à [`src/app/api/client.ts`](src/app/api/client.ts) |
| `cpi_impersonator_token` | Jeton du membre du personnel mis de côté pendant une prise en main — même module |

Une garde d'intégration continue échoue si un autre module se met à écrire dans le navigateur : c'est ce qui empêche un état local de réapparaître en silence et de contredire le serveur.

### Types générés

[`src/app/api/types/generated.d.ts`](src/app/api/types/generated.d.ts) est **produit par le backend** (`php artisan typescript:transform`) et ne se modifie jamais à la main. Toute la couche API compile contre lui : une réponse qui change de forme devient une erreur de compilation, pas une erreur d'exécution.

### Design system

Tokens centralisés dans [`src/styles/globals.css`](src/styles/globals.css) : couleurs (bordeaux `#7B1A2E` en couleur reine), espacements, rayons, élévations, échelle typographique, motion, focus-visible. Primitives partagées dans [`src/app/components/ui/index.tsx`](src/app/components/ui/index.tsx).

---

## Démarrage

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
```

Le serveur de développement **relaie `/api` vers `http://localhost:8000`** (voir `API_PROXY_TARGET` dans `vite.config.ts`) : lancez le backend en parallèle.

```bash
# côté backend
php artisan serve --port=8000
```

Le client API appelle `/api` en **relatif** : le proxy réécrit vers le backend, le navigateur ne voit qu'une seule origine, et la question du CORS ne se pose jamais. Pour viser un autre backend, une seule valeur change :

```bash
# Backend sur une autre machine, un autre port, ou dans un conteneur.
VITE_API_PROXY_TARGET=http://192.0.2.10:8000 npm run dev
```

> Cette adresse était jusqu'ici l'IP du réseau local d'un développeur, écrite en
> dur dans quatre passages de ce fichier : le dépôt exposait un poste nommément,
> et la marche à suivre ne fonctionnait sur aucune autre machine.

Le serveur écoute sur toutes les interfaces (`host: true`) : l'application reste joignable depuis un autre poste du réseau, à l'adresse que Vite affiche au démarrage (ligne « Network »).

> ⚠️ La connexion Google reste configurée sur `http://localhost:5173/auth/google/callback` (`GOOGLE_REDIRECT_URI` côté backend). Depuis un autre appareil du réseau, ce retour ne résout pas : utilisez la connexion par mot de passe, ou déclarez l'adresse réseau comme URI de redirection supplémentaire dans la console Google Cloud.

```bash
npm run typecheck  # tsc --noEmit, mode strict
npm run build      # tsc --noEmit && vite build → dist/
```

`build` lance le contrôle de types **avant** Vite : une erreur de type arrête la construction, elle n'est jamais ignorée. Le build produit `dist/`, à servir derrière un hébergement pointant vers l'API.

Le `dist/` n'a **pas** de proxy : `/api` y reste relatif et suppose que l'API est servie par le même hôte. Si ce n'est pas le cas, donnez la base absolue au build — et pensez à autoriser l'origine du site côté backend (`FRONTEND_URL` dans son `.env`, lu par `config/cors.php`), sans quoi le navigateur bloquera les appels :

```bash
VITE_API_URL=https://api.exemple.sn npm run build
```

Chargement optimisé : l'espace connecté (dashboards + Recharts) est chargé **à la demande** ; la landing et la connexion restent légères.

---

## Référencement & mesure d'audience

L'application est un espace authentifié : **seule la page d'accueil est indexable**, tout le reste exige une connexion. Le référencement porte donc sur cette page, sur la présence de marque et sur le partage social.

En place : langue `fr`, titre et description orientés « financement immobilier au Sénégal », URL canonique, Open Graph et Twitter Card (carte 1200×630), données structurées Schema.org (`Organization`, `WebSite`, `Service`), jeu complet d'icônes, manifeste d'application, préconnexions aux polices, contenu de repli `<noscript>`, `robots.txt` et `sitemap.xml`.

`robots.txt` et `sitemap.xml` sont **générés au build** (voir `seoAndAnalytics()` dans `vite.config.ts`) : ils contiennent l'adresse du site, alors que les fichiers de `public/` sont copiés sans substitution.

### Deux variables de build

| Variable | Effet | Défaut |
| --- | --- | --- |
| `VITE_SITE_URL` | Adresse publique : URL canonique, balises sociales, données structurées, `sitemap.xml`, `robots.txt` | `https://monespace.cpi.sn` |
| `VITE_GTAG_ID` | Identifiant de mesure Google Analytics (`G-…`) | vide — **aucun script de suivi n'est injecté** |

```bash
VITE_SITE_URL=https://votre-domaine.sn VITE_GTAG_ID=G-XXXXXXXXXX npm run build
```

> ⚠️ `VITE_SITE_URL` doit pointer sur le domaine de production. Une URL canonique erronée est pire que pas d'URL du tout : les moteurs suivraient une adresse inexistante.

Tant que `VITE_GTAG_ID` est vide, la page ne contient **aucune** balise de suivi et n'émet aucune requête vers Google. Une fois l'identifiant fourni, le marqueur est ajouté avec `anonymize_ip`. Si vous mesurez des visiteurs situés dans l'Union européenne, prévoyez en plus une bannière de consentement — l'injection actuelle ne gère pas le consentement préalable.

---

## Intégration continue

`.github/workflows/ci.yml` — quatre contrôles bloquants sur `dev` et `main` :

| Contrôle | Détail |
| --- | --- |
| Types | `tsc --noEmit` en mode strict |
| Build | `npm run build` (types + Vite/Rollup) |
| Garde localStorage | Seuls deux modules peuvent écrire dans le navigateur ; le jeton reste dans la couche API |
| Types générés | `generated.d.ts` présent |

---

*Projet initialement généré via Figma Make, puis développé et perfectionné (design system, migration complète vers l'API Laravel, contrôle de types strict).*
