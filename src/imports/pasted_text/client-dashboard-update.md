MISSION

Nous restons exclusivement sur la page :

📋 Ma demande

du Dashboard Client CPI Immobilier.

La précédente modification est incomplète.

Le code annonce :

• upload fonctionnel
• machine à états
• modals
• sauvegarde automatique
• actions réelles

Mais l’interface visible ne permet toujours pas au client d’utiliser ces fonctionnalités.

Tu dois corriger réellement les deux sections suivantes :

1. Documents requis
2. Actions disponibles

IMPORTANT

Ne modifie pas le design général de la page.

Conserve :

• les couleurs
• les cartes
• la typographie
• les espacements
• la structure actuelle

Mais rends les fonctions visibles, compréhensibles et utilisables.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTIE 1 — DOCUMENTS REQUIS

PROBLÈME ACTUEL

Les documents apparaissent dans une liste avec des icônes, mais le client ne voit pas clairement :

• comment envoyer un document
• comment remplacer un document
• comment renvoyer un document refusé
• comment visualiser un document
• comment savoir si le fichier a réellement été envoyé

Les petites icônes seules ne sont pas suffisantes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AJOUTER UN VRAI BOUTON D’UPLOAD

Pour chaque document non envoyé, afficher clairement :

Bouton principal :

Téléverser le document

Avec une icône upload et un libellé visible.

Le clic doit ouvrir immédiatement le sélecteur de fichiers.

Prévoir aussi le glisser-déposer.

Afficher les formats autorisés :

PDF, JPG, JPEG, PNG

Afficher la taille maximale.

Exemple :

PDF, JPG ou PNG — 10 Mo maximum

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DOCUMENT DÉJÀ REÇU

Pour un document reçu, afficher clairement les actions :

• Visualiser
• Télécharger
• Remplacer

Ne pas afficher uniquement des icônes sans texte sur desktop.

Les icônes seules peuvent être conservées sur mobile avec tooltip accessible.

Le bouton Remplacer doit ouvrir le sélecteur de fichiers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. DOCUMENT REFUSÉ

Pour un document refusé, afficher une action principale très visible :

Renvoyer le document

Ce bouton doit être placé à droite du statut Refusé ou sous le motif du refus.

Ne pas afficher seulement une icône circulaire.

Au clic :

• ouvrir le sélecteur de fichiers
• permettre le remplacement
• afficher la progression de l’envoi
• créer une nouvelle version
• conserver l’ancienne version dans l’historique
• changer le statut vers En cours d’envoi
• puis Reçu
• puis En attente de validation

Le motif du refus doit rester visible jusqu’au nouvel envoi.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. ÉTATS VISUELS OBLIGATOIRES

Chaque document doit afficher l’un de ces états :

• À envoyer
• En cours d’envoi
• Reçu
• En attente de validation
• Validé
• Refusé
• Expiré

Chaque état doit posséder :

• couleur
• icône
• libellé
• message explicatif
• action correspondante

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. PROGRESSION D’UPLOAD

Lors d’un envoi, afficher réellement :

• nom du fichier
• poids du fichier
• barre de progression
• pourcentage
• bouton Annuler
• message de succès ou d’erreur

Ne jamais simuler un upload sans retour visuel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. VALIDATION DU FICHIER

Avant acceptation, vérifier :

• extension
• type MIME
• taille
• fichier vide
• doublon
• nom invalide

En cas d’erreur, afficher un message précis.

Exemple :

Le fichier dépasse 10 Mo.

ou

Format non autorisé. Utilisez PDF, JPG ou PNG.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. COMPTEUR DES DOCUMENTS

Le compteur en haut doit refléter l’état réel.

Ne pas écrire seulement :

3 documents reçus sur 4

Distinguer :

• envoyés
• validés
• refusés
• manquants

Exemple :

3 envoyés sur 4
2 validés
1 refusé
1 manquant

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTIE 2 — ACTIONS DISPONIBLES

PROBLÈME ACTUEL

Les cinq lignes sont toujours présentées comme une simple liste.

Le client ne sait pas :

• quelles actions sont disponibles
• quelles actions sont bloquées
• pourquoi elles sont bloquées
• ce qui se passe au clic
• si une action a réellement fonctionné

Chaque action doit avoir un comportement réel et un état dynamique.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ENVOYER LA DEMANDE

Cette action doit devenir le CTA principal.

Elle doit être activée uniquement si :

• tous les champs obligatoires du projet sont valides
• tous les documents obligatoires ont été envoyés
• aucun document obligatoire n’est refusé
• les informations du profil nécessaires sont complètes
• aucune erreur bloquante n’existe

Si le dossier est incomplet :

• désactiver le bouton
• afficher une apparence désactivée
• afficher la raison

Exemple :

Impossible d’envoyer la demande :
1 document refusé doit être renvoyé.

Au clic si le dossier est complet :

1. ouvrir une modal de confirmation
2. afficher le résumé du dossier
3. afficher les documents joints
4. demander confirmation
5. envoyer réellement la demande
6. modifier le statut en En cours d’étude
7. enregistrer la date d’envoi
8. ajouter une entrée dans l’historique
9. créer une notification
10. mettre à jour le Tableau de bord

Après envoi, remplacer l’action par :

Demande envoyée

avec état non cliquable ou bouton Voir le suivi.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. MODIFIER LA DEMANDE

Avant envoi :

Le clic doit ouvrir le formulaire Projet immobilier en mode édition.

Effectuer automatiquement :

• scroll vers la section
• ouverture de la carte
• focus sur le premier champ
• affichage des boutons Enregistrer et Annuler si nécessaires

Après envoi :

Le bouton devient :

Demander une modification

Le clic ouvre une modal avec :

• motif
• message
• pièce jointe facultative
• bouton Envoyer la demande de modification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. COMPLÉTER LES INFORMATIONS

Cette action doit analyser les données réelles.

Le clic doit ouvrir une modal ou un panneau contenant la liste exacte des éléments à corriger.

Exemple :

Éléments à compléter :

• Relevés bancaires refusés
• Description du projet incomplète
• Numéro de téléphone non vérifié

Chaque ligne doit être cliquable.

Au clic :

• ouvrir la bonne section
• effectuer un scroll automatique
• mettre l’élément en évidence

Ne pas rediriger simplement vers le haut de la page.

Quand tout est complet :

Remplacer cette action par :

Dossier complet

avec badge vert et aucune alerte.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. TÉLÉCHARGER LE RÉCAPITULATIF

Le clic doit générer et télécharger un vrai PDF.

Le PDF doit contenir :

• identité du client
• référence du dossier
• date
• statut
• informations du projet
• liste des documents
• statuts des documents
• historique
• coordonnées du conseiller
• QR Code ou identifiant de vérification

Pendant la génération, afficher :

Génération du PDF…

Puis :

Récapitulatif téléchargé avec succès.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. CONTACTER MON CONSEILLER

Le clic doit ouvrir une vraie modal ou messagerie.

Afficher :

• nom du conseiller
• photo ou avatar
• fonction
• téléphone
• email
• horaires ou disponibilité

Proposer :

• Envoyer un message
• Demander un rappel
• Prendre rendez-vous

Le message doit être automatiquement lié à :

• clientId
• dossierId
• référence de la demande

Le champ objet doit être prérempli :

Demande CPI-2026-04721

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. ÉTATS DES ACTIONS

Chaque action doit posséder un état parmi :

• disponible
• recommandée
• bloquée
• terminée
• en cours
• erreur

Ne pas afficher les cinq actions comme si elles étaient toujours disponibles.

Exemple dans l’état actuel visible :

Envoyer la demande
→ Bloquée

Motif :
Le relevé bancaire a été refusé.

Modifier la demande
→ Disponible ou remplacée par Demander une modification selon le statut réel.

Compléter les informations
→ Recommandée

Télécharger le récapitulatif
→ Disponible

Contacter mon conseiller
→ Disponible

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. ACTION PRIORITAIRE

Mettre visuellement en avant l’action urgente.

Dans l’état actuel :

Renvoyer les relevés bancaires

doit devenir l’action prioritaire.

Ajouter dans Actions disponibles une ligne ou un bandeau prioritaire :

Action requise

Renvoyer les relevés bancaires

Le clic doit ouvrir directement le document refusé et le sélecteur d’upload.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. RETOURS UTILISATEUR

Chaque action doit produire un retour visible :

• toast succès
• toast erreur
• état de chargement
• modal de confirmation
• changement de statut
• mise à jour immédiate de l’interface

Aucun clic ne doit sembler inactif.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. ACCESSIBILITÉ

Tous les boutons doivent avoir :

• libellé visible
• aria-label
• focus clavier
• état disabled réel
• tooltip pour les icônes
• zone cliquable suffisante

Ne jamais utiliser une icône seule sans explication sur desktop.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. TESTS OBLIGATOIRES

Exécuter et documenter les tests suivants.

TEST 1

Cliquer sur Téléverser le document.

Résultat attendu :

Le sélecteur de fichiers s’ouvre.

TEST 2

Envoyer un fichier PDF valide.

Résultat attendu :

Progression visible, puis statut Reçu.

TEST 3

Envoyer un fichier trop lourd.

Résultat attendu :

Erreur claire, fichier refusé.

TEST 4

Cliquer sur Renvoyer le document refusé.

Résultat attendu :

Le sélecteur s’ouvre et une nouvelle version est créée.

TEST 5

Avec un document refusé, cliquer sur Envoyer la demande.

Résultat attendu :

Action bloquée avec motif visible.

TEST 6

Cliquer sur Compléter les informations.

Résultat attendu :

Liste exacte des éléments manquants, puis navigation directe vers le document refusé.

TEST 7

Corriger tous les éléments.

Résultat attendu :

Le bouton Envoyer la demande devient actif.

TEST 8

Envoyer la demande.

Résultat attendu :

Confirmation, statut En cours d’étude, historique et notification mis à jour.

TEST 9

Cliquer sur Télécharger le récapitulatif.

Résultat attendu :

Un PDF réel est généré.

TEST 10

Cliquer sur Contacter mon conseiller.

Résultat attendu :

La modal ou la messagerie s’ouvre avec la référence du dossier préremplie.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÈGLES STRICTES

• Ne pas répondre uniquement avec une explication
• Modifier réellement les composants
• Ne pas laisser les actions sous forme de placeholders
• Ne pas simuler les clics sans effet
• Ne pas utiliser uniquement des icônes
• Ne pas déclarer une fonction terminée sans l’avoir testée
• Ne pas modifier le reste du Dashboard Client
• Ne pas toucher au Dashboard Agent
• Ne pas toucher au Dashboard Administrateur

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LIVRABLE FINAL

À la fin, fournir obligatoirement :

1. la liste précise des fichiers modifiés
2. les actions réellement fonctionnelles
3. les états gérés pour chaque document
4. les conditions d’activation de chaque action
5. les tests exécutés
6. les captures ou preuves des états suivants :
   • document à envoyer
   • upload en cours
   • document reçu
   • document refusé
   • demande bloquée
   • demande prête à envoyer
   • demande envoyée
7. un verdict final PASS ou FAIL

Ne pas écrire PASS si les boutons d’upload et les cinq actions ne sont pas réellement visibles et fonctionnels dans l’interface.