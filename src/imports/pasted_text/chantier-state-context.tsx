MISSION

Connecte maintenant le module de suivi du chantier entre :

- le Dashboard Agent CPI ;
- le Dashboard Administrateur ;
- le module « Mon Chantier » du client.

Travaille uniquement sur le suivi opérationnel du chantier d’Aïssatou Ndiaye.

Ne modifie pas encore :

- les décaissements ;
- les notifications ;
- le support ;
- les documents requis ;
- les documents CPI déjà connectés.

Ne reconstruis aucune page.

Ne change pas la navigation.

Ne modifie pas le Design System.

Réutilise les composants existants.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

L’Agent CPI et l’Administrateur doivent pouvoir mettre à jour le chantier d’Aïssatou Ndiaye.

Chaque modification doit être immédiatement visible dans :

Client
→ Mon Chantier

Les modifications doivent également rester disponibles après changement de rôle ou rechargement grâce à `localStorage`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARCHITECTURE

Créer un contexte React léger dédié au chantier, par exemple :

src/app/data/chantierStateContext.tsx

Ne mélange pas ce contexte avec :

- docStateContext.tsx ;
- cpiDocsContext.tsx.

Le contexte chantier doit gérer uniquement :

- les informations générales du chantier ;
- les étapes ;
- la progression ;
- les publications ;
- les photos ;
- les vidéos ;
- les commentaires ;
- le calendrier ;
- l’historique des actions du chantier.

Ajouter le Provider dans `AppShell.tsx`, au même niveau que les autres Providers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DONNÉES GÉNÉRALES DU CHANTIER

Utiliser comme source initiale :

CHANTIER_AISSATOU

déjà présent dans :

src/app/data/demoStore.ts

Le chantier doit contenir :

- id ;
- clientId ;
- client ;
- projet ;
- référence ;
- localisation ;
- chef de chantier ;
- entreprise ;
- date de début ;
- date estimée de livraison ;
- progression globale ;
- étape actuelle ;
- statut général ;
- dernière mise à jour.

Statuts autorisés :

- non-démarré ;
- en-cours ;
- suspendu ;
- en-retard ;
- terminé ;
- livré.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ÉTAPES DU CHANTIER

Le chantier suit exactement les quatre grandes phases suivantes :

1. TRANCHE 1 — 35 %

Avance de démarrage

Description :

À la signature du contrat et au démarrage du chantier, versement initial permettant de mobiliser les équipes.

2. TRANCHE 2 — 30 %

Élévation des murs, poteaux, dalle et toiture

Description :

Libérée après certification de la mise hors d’eau : murs, poteaux, dalle intermédiaire et toiture réalisés.

3. TRANCHE 3 — 30 %

Second œuvre

Description :

Menuiseries, plomberie, électricité, carrelage et travaux de finition.

4. TRANCHE 4 — 5 %

Remise des clés

Description :

Réception définitive du logement et remise officielle des clés à l’acquéreur.

IMPORTANT :

Dans cette étape, connecter uniquement le suivi physique du chantier.

Ne connecte pas encore les montants ni la validation bancaire des décaissements.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTIONS AGENT ET ADMINISTRATEUR

Pour chaque chantier, permettre :

- modifier la progression globale ;
- modifier l’étape actuelle ;
- changer le statut général ;
- ajouter une mise à jour ;
- ajouter un commentaire ;
- ajouter une photo ;
- ajouter une vidéo ;
- ajouter un document technique ;
- définir une date ;
- ajouter un événement au calendrier ;
- modifier la date estimée de livraison ;
- signaler un retard ;
- marquer une phase comme terminée.

Ne crée pas une nouvelle interface complexe.

Connecte les boutons et formulaires déjà présents dans `ChantierModule.tsx`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PUBLICATIONS DU CHANTIER

Chaque mise à jour doit contenir :

- id ;
- chantierId ;
- phase ;
- titre ;
- description ;
- date ;
- heure ;
- auteur ;
- type ;
- visibleClient ;
- médias éventuels.

Types autorisés :

- actualité ;
- photo ;
- vidéo ;
- document ;
- commentaire ;
- étape-validée ;
- retard ;
- visite.

Quand `visibleClient === true`, la publication apparaît dans le module « Mon Chantier » du client.

Quand `visibleClient === false`, elle reste visible uniquement pour l’Agent CPI et l’Administrateur.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHOTOS ET VIDÉOS

Pour chaque média, enregistrer :

- id ;
- type : photo ou vidéo ;
- titre ;
- description ;
- date ;
- phase ;
- auteur ;
- url ou fichier de démonstration ;
- visibleClient.

Côté client, les médias doivent apparaître dans :

Mon Chantier
→ Galerie du chantier

Conserver la présentation visuelle actuelle.

Ne crée pas encore un véritable stockage de fichiers.

Utiliser des données de démonstration et des URLs locales ou temporaires compatibles avec le projet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CALENDRIER

Permettre à l’Agent CPI et à l’Administrateur d’ajouter des événements :

- visite de chantier ;
- inspection ;
- livraison de matériaux ;
- début d’une étape ;
- fin d’une étape ;
- rendez-vous client ;
- réception ;
- remise des clés.

Chaque événement contient :

- id ;
- titre ;
- type ;
- date ;
- heure éventuelle ;
- description ;
- statut ;
- visibleClient.

Statuts :

- prévu ;
- confirmé ;
- réalisé ;
- reporté ;
- annulé.

Les événements visibles doivent apparaître dans :

Client
→ Mon Chantier
→ Calendrier du chantier

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CÔTÉ CLIENT

Dans « Mon Chantier », afficher automatiquement :

- la progression globale ;
- l’étape actuelle ;
- le statut général ;
- la date de début ;
- la livraison estimée ;
- le chef de chantier ;
- les quatre phases ;
- les dernières publications ;
- les photos et vidéos ;
- le calendrier ;
- les commentaires visibles.

Réutiliser la mise en page actuelle.

Ne recrée pas les cartes.

Ne change pas les couleurs ou la typographie.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CALCUL DE LA PROGRESSION

Ne déduis pas automatiquement la progression globale uniquement à partir des quatre tranches.

L’Agent CPI ou l’Administrateur peut saisir une progression réelle entre 0 et 100 %.

Cependant :

- la progression ne peut pas être inférieure à 0 ;
- elle ne peut pas dépasser 100 ;
- une phase terminée doit rester marquée comme terminée ;
- la progression globale ne doit pas diminuer sans confirmation explicite.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HISTORIQUE

Chaque action chantier doit créer une entrée contenant :

- id ;
- date ;
- heure ;
- auteur ;
- rôle ;
- action ;
- client ;
- chantier ;
- phase concernée ;
- ancienne valeur ;
- nouvelle valeur ;
- commentaire éventuel.

Exemples :

- « Mme Thiombane a fait passer le chantier à 42 %. »
- « Administrateur CPI a ajouté 4 photos à la phase 2. »
- « Mme Thiombane a signalé un retard de 5 jours. »
- « La phase Élévation des murs a été marquée comme terminée. »
- « Une visite de chantier a été planifiée pour le 28 juillet 2026. »

L’historique doit être conservé dans `localStorage`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSISTANCE

Utiliser `localStorage` comme pour les deux contextes déjà en place.

Créer une clé dédiée, par exemple :

cpi_chantier_aissatou_state

Ne supprime pas les données initiales de `demoStore.ts`.

Elles servent de valeurs par défaut lors du premier chargement.

Prévoir une lecture sécurisée de `localStorage` :

- vérifier les données ;
- gérer les JSON invalides ;
- revenir aux valeurs par défaut en cas d’erreur.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT

Ne connecte pas encore les décaissements.

Ne modifie pas `DecaissementsModule.tsx`.

Ne crée pas de backend.

Ne modifie pas `App.tsx`.

Ne touche pas aux contextes déjà fonctionnels, sauf import strictement nécessaire.

Ne duplique pas les données chantier dans plusieurs composants.

Ne modifie aucune autre page visuellement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VÉRIFICATIONS OBLIGATOIRES

Tester ce scénario :

1. Se connecter comme Agent CPI.
2. Ouvrir le chantier d’Aïssatou Ndiaye.
3. Faire passer la progression à 42 %.
4. Définir la phase actuelle sur « Élévation des murs, poteaux, dalle et toiture ».
5. Ajouter une mise à jour visible par le client.
6. Ajouter deux photos de démonstration.
7. Planifier une visite de chantier.
8. Changer de rôle et se connecter comme Aïssatou Ndiaye.
9. Vérifier que la progression affiche 42 %.
10. Vérifier que la phase actuelle est correcte.
11. Vérifier que la mise à jour apparaît.
12. Vérifier que les photos apparaissent dans la galerie.
13. Vérifier que la visite apparaît dans le calendrier.
14. Recharger la page.
15. Vérifier que toutes les données sont conservées.
16. Vérifier qu’aucune autre page n’a changé.
17. Vérifier qu’il n’existe aucune erreur TypeScript ou import cassé.

À la fin, fournir :

- la liste exacte des fichiers créés ;
- la liste exacte des fichiers modifiés ;
- la structure du contexte chantier ;
- les actions disponibles ;
- le chemin des données Agent/Admin → Client ;
- les tests réalisés ;
- les limites actuelles de la démonstration.