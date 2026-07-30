MISSION

Connecte maintenant la gestion des documents entre :

- le Dashboard Agent CPI ;
- le Dashboard Administrateur ;
- le Dashboard Client.

Travaille uniquement sur les documents requis du dossier d’Aïssatou Ndiaye.

Ne modifie pas le design actuel.

Ne reconstruis aucune page.

Ne change pas la navigation.

Ne touche pas encore :

- au chantier ;
- aux décaissements ;
- aux documents administratifs CPI ;
- aux notifications ;
- au support.

Utilise exclusivement la source centrale existante :

src/app/data/demoStore.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

Lorsqu’un Agent CPI ou un Administrateur modifie le statut d’un document, le nouvel état doit être immédiatement visible dans le module « Mon Dossier » du client.

Les documents requis sont uniquement :

1. Pièce d’identité valide
   - CNI ou passeport

2. Justificatifs de revenus
   - les 3 derniers bulletins regroupés dans un seul dossier

3. Relevés bancaires
   - les 3 derniers mois regroupés dans un seul dossier

Ne recrée pas les anciennes catégories :

- Projet immobilier
- Projet de construction
- Domicile
- Emploi
- Autres

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTIONS AGENT ET ADMINISTRATEUR

Pour chaque document, ajouter ou connecter les actions existantes :

- Consulter
- Télécharger
- Accepter
- Refuser
- Demander un remplacement
- Remettre en vérification
- Ajouter un commentaire

Les statuts autorisés sont uniquement :

- en-attente
- depose
- verification
- accepte
- refuse
- a-remplacer

Utiliser exactement les valeurs déjà définies dans demoStore.ts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPORTEMENT ATTENDU

Quand l’agent clique sur « Accepter » :

- le statut devient `accepte` ;
- la date de validation est renseignée ;
- le nom de l’agent est enregistré ;
- un événement est ajouté dans l’historique ;
- la progression du dossier client est recalculée.

Quand l’agent clique sur « Refuser » :

- le statut devient `refuse` ;
- un commentaire est obligatoire ;
- la date de décision est enregistrée ;
- un événement est ajouté dans l’historique.

Quand l’agent clique sur « Demander un remplacement » :

- le statut devient `a-remplacer` ;
- un commentaire explicatif est obligatoire ;
- le client voit le bouton « Remplacer » dans son espace ;
- un événement est ajouté dans l’historique.

Quand l’agent clique sur « Remettre en vérification » :

- le statut devient `verification` ;
- la date de mise à jour est enregistrée ;
- un événement est ajouté dans l’historique.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CÔTÉ CLIENT

Dans « Mon Dossier », afficher automatiquement le statut à jour.

Correspondance visuelle :

- `en-attente` → En attente
- `depose` → Déposé
- `verification` → En vérification
- `accepte` → Accepté
- `refuse` → Refusé
- `a-remplacer` → À remplacer

Afficher également, lorsque disponible :

- le commentaire CPI ;
- la date d’envoi ;
- la date de validation ;
- l’agent ayant traité le document ;
- la version du document.

Ne modifie pas la mise en page actuelle.

Réutilise les composants et badges déjà présents.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROGRESSION DU DOSSIER

La progression doit être calculée sur 3 dossiers requis.

Exemple :

- 3 acceptés sur 3 = 100 %
- 2 acceptés sur 3 = 67 %
- 1 accepté sur 3 = 33 %
- 0 accepté = 0 %

Les statuts `verification`, `depose`, `refuse`, `a-remplacer` et `en-attente` ne comptent pas comme validés.

Le résumé du client doit afficher :

- nombre total requis : 3 ;
- nombre validé ;
- nombre en vérification ;
- nombre manquant ou à corriger ;
- pourcentage global.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HISTORIQUE

À chaque action, ajouter une entrée contenant :

- identifiant ;
- date ;
- heure ;
- auteur ;
- rôle ;
- action ;
- client ;
- document concerné ;
- ancien statut ;
- nouveau statut ;
- commentaire éventuel.

Exemples :

« Mme Thiombane a accepté la pièce d’identité d’Aïssatou Ndiaye. »

« Mme Thiombane a demandé le remplacement des relevés bancaires. »

« Administrateur CPI a remis les justificatifs de revenus en vérification. »

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT — SÉCURITÉ DU CODE

Ne transforme pas demoStore.ts en système complexe.

Ne crée pas encore de backend.

Utilise un état React partagé simple ou une structure locale adaptée à la démonstration actuelle.

Évite les modifications massives.

Ne duplique pas les données dans plusieurs composants.

Ne modifie pas App.tsx sauf si cela est strictement nécessaire pour partager l’état ; dans ce cas, fais une modification minimale et explique-la.

Ne change aucune interface visuelle.

Ne supprime aucune fonctionnalité existante.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VÉRIFICATIONS OBLIGATOIRES

Tester le scénario suivant :

1. Connexion en Agent CPI.
2. Ouvrir le dossier d’Aïssatou Ndiaye.
3. Accepter la pièce d’identité.
4. Demander le remplacement des relevés bancaires avec un commentaire.
5. Se connecter comme Aïssatou Ndiaye.
6. Vérifier que les deux nouveaux statuts apparaissent.
7. Vérifier que le commentaire est visible.
8. Vérifier que la progression est recalculée.
9. Vérifier que les actions apparaissent dans l’historique.
10. Vérifier qu’aucune autre page n’a changé.

À la fin, fournir :

- la liste exacte des fichiers modifiés ;
- les fonctions ajoutées ;
- le chemin suivi par les données Agent/Admin → Client ;
- les tests effectués ;
- la confirmation qu’il n’existe aucune erreur TypeScript.