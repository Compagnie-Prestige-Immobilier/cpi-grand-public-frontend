# Plan — MON DOSSIER 10/10 Upgrade

## Context

MonDossierPage already has the core structure (5 categories, upload modal, admin docs table, timeline). The goal is a premium quality upgrade: richer hero, smarter progress display, a left sub-navigation panel (DocuSign/Notion style), per-category color identity, richer document cards with metadata and history, admin docs reorganized into collapsible folders (not a table), and a full dossier activity log.

`AuthUser` only carries `{ role, name, memberNumber? }` — project metadata (villa, conseiller, bank, dates) will be hardcoded as demo constants inside MonDossierPage. No changes needed to App.tsx or AuthUser.

---

## Architecture change — two-panel layout

MonDossierPage becomes a **left sidebar + right content** layout (like DocuSign or Notion).

```
┌─────────────────┬────────────────────────────────────────┐
│  Sub-nav panel  │  Content area                          │
│  (220px fixed)  │  (flex-1)                              │
│                 │                                        │
│  Résumé         │  <active section renders here>         │
│  Documents req. │                                        │
│  Envoyés        │                                        │
│  Documents CPI  │                                        │
│  Historique     │                                        │
│  Commentaires   │                                        │
│  Support        │                                        │
└─────────────────┴────────────────────────────────────────┘
```

State: `activeSection: 'resume' | 'requis' | 'envoyes' | 'cpi' | 'historique' | 'commentaires' | 'support'`

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/components/MonDossierPage.tsx` | Full upgrade — all improvements below |

No other files need changes.

---

## Section-by-section implementation plan

### 1 — Hero card (always visible at top of content area)

Project info row:
- **Left**: `Projet : Villa R+1 — Ngolfagnick (Thiès)` in `var(--font-display)` large, below it a `Réf. CPI-2026-04721` chip
- **Right**: status pill `Dossier en cours de validation` (accent gold)

Meta row (5 chips in a row):
```
👤 Aïssatou Ndiaye   |   👩‍💼 Mme Thiombane (Conseiller)   |   🏦 CBAO Attijariwafa   |   📅 Ouverture : 03 juin 2026   |   🕐 Mise à jour : Aujourd'hui
```

Progress section below meta row:
- Horizontal progress bar (`var(--primary)` fill), bold `78%` label
- 3 status chips: `✔ 7 validés` (success green) · `🟡 1 en analyse` (accent) · `🔴 2 manquants` (destructive)
- "Prochaine étape →" label: **Validation bancaire**

### 2 — Sub-navigation panel (left, 220px)

```
Mon Dossier          ← section header
──────────────
📋 Résumé
📁 Documents requis
📤 Envoyés
🏛️ Documents CPI
──────────────
🕐 Historique
💬 Commentaires
──────────────
🆘 Support
```

Active item: `var(--secondary)` background + `var(--primary)` left border + `var(--primary)` text
Inactive: `var(--muted-foreground)` text, hover `var(--input-background)`
Fonts: `var(--font-sans)` for all labels

### 3 — Résumé section

When `activeSection === 'resume'` show:
- The hero card (always shown)
- 5 category progress cards in a 2-column grid — each shows category icon + color accent, label, completion chip, mini progress bar
- 7-step process timeline (already exists, move here from hero)
- Quick links to other sections ("Voir tous les documents requis →")

### 4 — Documents requis section

The existing 5-category accordion view with **color accent per category**:

| Category | Accent color token | Icon tint |
|---|---|---|
| Identité | `var(--primary)` | `#7B1A2E` |
| Revenus | `var(--success)` | `#1A6B44` |
| Bancaires | `#1A4A8B` (blue, add as `--info: #1A4A8B` to globals or use inline) | blue |
| Projet immobilier | `var(--accent)` | `#C8921A` |
| Construction | `#5B3FA0` (violet, or use chart-5 `var(--chart-5)`) | violet |

Each DocCard becomes richer:
- File icon + name + **format** (PDF) + **size** (3.2 Mo) + **date** metadata row
- Status badge
- Action buttons: Voir · Télécharger · **Historique** (shows per-doc history popover)
- On expand: date envoi, date validation, agent, commentaire CPI in styled quote block

### 5 — Documents envoyés section

A flat list of all submitted docs across categories, sorted by date (newest first). Each row:
- Category chip (color-coded) + doc name + date + status badge + actions

### 6 — Documents CPI section (replaces admin docs table)

**Folder structure** — collapsible folder cards:

```
📁 Contrats (2)
    Contrat de réservation   Signé  15 juin   Voir · Télécharger · Historique
    Contrat de vente         —      —          À venir

📁 Banque (2)
    Convention financement   En attente   Voir · Signer · Refuser
    Offre de prêt CBAO       Disponible   Voir · Télécharger

📁 Courriers (1)
    Accusé de réception      Consulté     Voir · Télécharger

📁 Documents techniques (3)
    PV de réservation        Signé        Voir · Télécharger
    Autorisation prélèvement À signer     Signer · Télécharger
    Fiche conditions prêt    Disponible   Voir · Télécharger
```

Each folder: `chevron` toggle, doc count badge, folder icon in `var(--secondary)` tile.
Documents inside: card style (NOT table rows) with status badge + action buttons.
Sign button: `var(--primary)` outline button; tooltip "Interface de signature à venir".

### 7 — Historique section

Timeline feed grouped by date, newest first:

```
Aujourd'hui
  ✔ CNI validée par Mme Thiombane

Hier
  ✔ Bulletin de salaire reçu

15 juin 2026
  ✔ Relevé bancaire remplacé (V2)

13 juin 2026
  💬 Commentaire CPI — "Veuillez déposer un document plus lisible"

10 juin 2026
  ✔ Dossier ouvert — Réf. CPI-2026-04721
```

Each entry: icon circle (success/warning/info) + text + optional agent chip.

### 8 — Commentaires section

Per-document comment threads. Two comment cards visible:

1. Relevé bancaire mois 3:
   > "Veuillez déposer un document plus lisible" — Mme Thiombane, 14 juin

2. CNI:
   > "Document conforme, validité vérifiée. Merci." — Mme Thiombane, 8 juin

Style: quote block with `var(--border)` left border, agent avatar initials circle.

### 9 — Support section

Simple card with:
- Conseiller CPI contact (Mme Thiombane, phone/email)
- CBAO contact
- "Ouvrir un ticket" button (disabled, tooltip "Bientôt disponible")
- FAQ accordion: 3 questions about upload formats, delays, signature

---

## Demo constants (hardcoded in MonDossierPage.tsx)

```typescript
const PROJECT = {
  nom: 'Villa R+1',
  adresse: 'Ngolfagnick (Thiès)',
  ref: 'CPI-2026-04721',
  dateOuverture: '03 juin 2026',
  majDate: "Aujourd'hui",
  conseiller: 'Mme Thiombane',
  banque: 'CBAO Attijariwafa Bank',
  statut: 'Dossier en cours de validation',
  nextEtape: 'Validation bancaire',
};
```

---

## Design tokens in use

All from `var(--*)` CSS variables — no hardcoded hex except for the category accent colors that aren't already in the token set (category accents can reference `var(--chart-*)` for blue/violet).

| Purpose | Token |
|---|---|
| Category: Identité | `var(--primary)` |
| Category: Revenus | `var(--success)` |
| Category: Bancaires | `var(--chart-5)` (#8B5CF6 violet) |
| Category: Immobilier | `var(--accent)` |
| Category: Construction | `var(--chart-2)` (#C8921A same as accent, or differentiate) |
| Typography headings | `var(--font-display)` |
| Typography body/labels | `var(--font-sans)` |

---

## Verification

1. Log in as Aïssatou Ndiaye (client-public demo)
2. Click "Mon Dossier" in sidebar
3. Two-panel layout renders: left sub-nav (7 items) + right content
4. Hero shows Villa R+1 — Ngolfagnick, all 5 meta chips, progress bar with breakdown, next step
5. Sub-nav "Documents requis" → 5 color-coded category accordions with richer doc cards
6. Sub-nav "Documents CPI" → folder structure with card-style docs, Sign buttons
7. Sub-nav "Historique" → grouped activity feed
8. Sub-nav "Commentaires" → quote-style comment threads
9. Upload modal still works from Déposer/Remplacer buttons
10. No TypeScript errors
