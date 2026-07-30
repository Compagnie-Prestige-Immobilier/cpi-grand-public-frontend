# CPI Immobilier — MONESPACE.CPI

Plateforme de financement immobilier pour le Sénégal (fonctionnaires, secteur privé, diaspora). Application **React + Vite** avec trois espaces distincts et un design system maison.

🔗 **Démo en ligne** : https://lavenderblush-opossum-991431.hostingersite.com
🎨 **Design d'origine (Figma)** : https://www.figma.com/design/ZxadxXNEWOPOWFg1xKdZux/Crowdfunding-Platform-UI-UX-Design--Community-

---

## Espaces

| Rôle | Accès | Fonctions clés |
|------|-------|----------------|
| **Client** | Espace client (nom + e-mail) | Simulateur de prêt, dépôt de demande, suivi du dossier & des pièces, chantier, notifications |
| **Agent CPI** | Espace professionnel | Traitement des dossiers, documents clients/CPI, décaissements bancaires, produits financiers, historique |
| **Administrateur** | Espace professionnel | Vue globale, utilisateurs, partenaires bancaires, tous les décaissements, journal d'audit, statistiques |

### Comptes de connexion (démo, sans backend)
- **Agent CPI** : `agent@cpi.sn` — mot de passe : n'importe quoi ≥ 4 caractères
- **Administrateur** : `admin@cpi.sn` — mot de passe : n'importe quoi ≥ 4 caractères
- **Client** : créer un compte via l'inscription, ou se connecter avec un nom + e-mail (réutilisé s'il existe déjà)

> ⚠️ Pas de backend : toutes les données vivent en `localStorage` (base vide au départ, aucun compte fictif). Les identifiants pro ci-dessus sont provisoires.

---

## Stack & architecture

- **React 18 + Vite** (build esbuild), **TypeScript**
- Styles : **CSS-in-JS inline + variables CSS (design tokens)** + Tailwind
- Graphiques : **Recharts** · Icônes : **lucide-react** (bibliothèque unique)
- Polices : **Bricolage Grotesque** (titres) · **Plus Jakarta Sans** (texte)
- État : Contextes React + persistance `localStorage` (registres clients/staff/banques, décaissements, journal d'audit)

### Design system
Tokens centralisés dans [`src/styles/globals.css`](src/styles/globals.css) : couleurs (bordeaux `#7B1A2E` en couleur reine), espacements, rayons, élévations, échelle typographique, motion, focus-visible. Primitives partagées dans [`src/app/components/ui/`](src/app/components/ui/).

---

## Démarrage

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production → dist/
```

Le build produit `dist/` (statique), déployable sur n'importe quel hébergement statique. Chargement optimisé : l'espace connecté (dashboards + Recharts) est chargé **à la demande** (code-splitting) ; la landing/connexion reste légère (~57 Ko gzip).

---

*Projet initialement généré via Figma Make, puis développé et perfectionné (design system, comptes réels, cohérence de charte, performances).*
# cpi-chues-frontend
