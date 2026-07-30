MISSION

Connecte maintenant les documents administratifs entre :

- le Dashboard Agent CPI ;
- le Dashboard Administrateur ;
- le module « Mon Dossier » du client.

Travaille uniquement sur les documents CPI.

Ne modifie pas encore :

- le suivi du chantier ;
- les décaissements ;
- les notifications ;
- la messagerie ;
- le support ;
- les documents requis déjà connectés.

Ne reconstruis aucune page.

Ne change pas le Design System.

Ne modifie pas la navigation.

Réutilise l’architecture React Context déjà créée pour les documents requis, en l’étendant proprement ou en créant un contexte séparé léger si cela évite de complexifier `docStateContext.tsx`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

L’Agent CPI et l’Administrateur doivent pouvoir publier des documents destinés à Aïssatou Ndiaye.

Une fois publiés, ces documents doivent apparaître immédiatement dans :

Mon Dossier
→ Documents CPI

Les catégories à gérer sont uniquement :

- Contrats
- Conventions
- Documents bancaires
- Courriers
- Procès-verbaux
- Autorisations
- Documents à signer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRUCTURE D’UN DOCUMENT CPI

Chaque document doit contenir :

- id
- catégorie
- nom
- référence éventuelle
- date de création
- date de publication
- version
- statut
- auteur
- fichier
- commentaire éventuel
- visibleClient
- signatureRequise

Statuts autorisés :

- brouillon
- publié
- disponible
- à-signer
- signé
- refusé
- archivé

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTIONS AGENT ET ADMINISTRATEUR

Pour chaque document, permettre :

- Créer
- Modifier
- Publier
- Consulter
- Télécharger
- Archiver
- Demander une signature
- Marquer comme signé
- Retirer de l’espace client

Ne crée pas encore une véritable signature électronique.

Le bouton « Signer » côté client peut rester simulé.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPORTEMENT ATTENDU

Quand un document est créé :

- son statut initial est `brouillon` ;
- il n’est pas visible côté client ;
- une entrée est ajoutée dans l’historique.

Quand l’agent clique sur « Publier » :

- le statut devient `publié` ou `disponible` ;
- `visibleClient` devient `true` ;
- la date de publication est enregistrée ;
- le document apparaît immédiatement dans « Documents CPI » du client ;
- une entrée est ajoutée dans l’historique.

Quand une signature est demandée :

- `signatureRequise` devient `true` ;
- le statut devient `à-signer` ;
- le client voit le bouton « Signer » ;
- une entrée est ajoutée dans l’historique.

Quand le document est marqué comme signé :

- le statut devient `signé` ;
- la date de signature est enregistrée ;
- le bouton « Signer » disparaît ;
- une entrée est ajoutée dans l’historique.

Quand un document est archivé ou retiré :

- il disparaît de la vue principale du client ;
- il reste conservé dans l’historique ;
- aucune suppression définitive n’est autorisée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOCUMENTS DE DÉMONSTRATION

Conserver les documents déjà présents, notamment :

- Contrat de réservation CPI
- Convention de financement
- Accusé de réception du dossier
- Fiche des conditions de prêt
- Autorisation de prélèvement
- PV de réservation

Les faire venir de la source centrale existante au lieu de les redéfinir dans plusieurs composants.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CÔTÉ CLIENT

Dans :

Mon Dossier
→ Documents CPI

Conserver l’organisation actuelle en dossiers ou sous-dossiers.

Afficher uniquement les documents dont :

visibleClient === true

Pour chaque document, afficher :

- catégorie
- nom
- référence
- version
- date
- statut
- auteur
- actions disponibles

Actions client :

- Consulter
- Télécharger
- Signer, seulement si `signatureRequise === true`
- Voir les détails
- Voir l’historique

Ne modifie pas la mise en page actuelle.

Réutilise les cartes, badges et boutons existants.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HISTORIQUE

Chaque action doit ajouter une entrée contenant :

- id
- date
- heure
- auteur
- rôle
- action
- client
- document
- ancien statut
- nouveau statut
- commentaire éventuel

Exemples :

« Mme Thiombane a publié le contrat de réservation d’Aïssatou Ndiaye. »

« Administrateur CPI a demandé la signature de la convention de financement. »

« Mme Thiombane a archivé l’ancien contrat V1. »

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT

Ne duplique pas les documents dans plusieurs composants.

Ne crée pas de backend.

Ne transforme pas le contexte existant en système complexe.

Ne modifie pas les documents requis déjà fonctionnels.

Ne change pas le rendu visuel des autres modules.

Ne modifie pas `App.tsx`.

Ne change `AppShell.tsx` que si un nouveau Provider est strictement nécessaire.

Préférer de petits fichiers spécialisés plutôt qu’un contexte unique trop volumineux.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VÉRIFICATIONS OBLIGATOIRES

Tester le scénario suivant :

1. Se connecter comme Agent CPI.
2. Ouvrir le dossier d’Aïssatou Ndiaye.
3. Créer ou sélectionner une convention.
4. Publier la convention.
5. Demander la signature du client.
6. Se connecter comme Aïssatou Ndiaye.
7. Vérifier que la convention apparaît dans « Documents CPI ».
8. Vérifier que le statut est « À signer ».
9. Vérifier que le bouton « Signer » est visible.
10. Revenir dans l’espace Agent ou Administrateur.
11. Marquer le document comme signé.
12. Vérifier côté client que le statut devient « Signé ».
13. Vérifier que toutes les actions apparaissent dans l’historique.
14. Vérifier qu’aucune autre page n’a changé.

À la fin, fournir :

- la liste exacte des fichiers créés ou modifiés ;
- la structure du contexte utilisé ;
- les actions disponibles ;
- le chemin des données Agent/Admin → Client ;
- les tests réalisés ;
- les limites actuelles de la démonstration ;
- la confirmation qu’il n’existe aucune erreur TypeScript ou import cassé.