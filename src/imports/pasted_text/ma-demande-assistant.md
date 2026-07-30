MISSION

Tu es désormais le Product Owner, Lead UX Designer, Lead Frontend Engineer et Software Architect de CPI Immobilier.

Tu travailles avec une équipe composée de :

• Product Owner
• Senior UX Designer
• UI Designer
• React Expert
• TypeScript Expert
• State Management Expert
• Backend Architect
• QA Engineer

Ta mission est de transformer la page "📋 Ma demande" en un véritable assistant intelligent de constitution de dossier.

IMPORTANT

La structure visuelle actuelle est VALIDÉE.

Ne refais pas le design.

Ne modifies pas les composants.

Ne modifies pas les couleurs.

Ne modifies pas la disposition générale.

Tu dois uniquement rendre la page totalement fonctionnelle et cohérente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

Le client doit pouvoir :

• créer sa demande

• compléter son projet immobilier

• déposer ses documents

• suivre leur validation

• corriger les erreurs

• envoyer son dossier

• télécharger son récapitulatif

• contacter son conseiller

Sans jamais quitter cette page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. FORMULAIRE "PROJET IMMOBILIER"

Transformer cette section en véritable formulaire métier.

Tous les champs doivent être modifiables tant que la demande n'est pas envoyée.

Les données doivent être automatiquement pré-remplies.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRÉ-REMPLISSAGE AUTOMATIQUE

Lorsqu'un client ouvre cette page :

Récupérer automatiquement les informations provenant de :

• Landing Page (formulaire d'inscription)

• Mon Profil

• Données déjà enregistrées

Pré-remplir automatiquement :

Type de demande

Nature du projet

Montant demandé

Durée

Apport personnel

Région

Commune

Adresse

Description

Le client ne doit jamais ressaisir une information déjà connue.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SAUVEGARDE AUTOMATIQUE

Toute modification doit être sauvegardée automatiquement.

Sans bouton "Enregistrer".

Le client peut quitter la page puis revenir.

Les informations doivent être conservées.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDATION EN TEMPS RÉEL

Contrôler automatiquement :

• champs obligatoires

• montant demandé

• apport minimum

• durée autorisée

• formats

Afficher immédiatement les erreurs.

Ne jamais attendre le clic sur "Envoyer".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DOCUMENTS REQUIS

Transformer cette section en gestionnaire documentaire.

Chaque document possède :

Nom

Description

Document obligatoire ou facultatif

Formats acceptés

Taille maximale

Date d'ajout

Version

Historique

Commentaires de l'agent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UPLOAD

Chaque document doit pouvoir être :

Glissé-déposé

ou

Sélectionné depuis l'ordinateur.

Pendant l'envoi afficher :

Téléchargement

Analyse

Traitement

Document reçu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATUTS

Chaque document possède un état :

Non envoyé

Téléchargement en cours

Reçu

En attente de validation

Validé

Refusé

Expiré

Chaque statut possède :

badge

couleur

icône

message explicatif

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOCUMENT REFUSÉ

Lorsqu'un document est refusé :

Afficher immédiatement :

le motif du refus

la date

l'agent

le bouton :

Remplacer le document

Conserver l'historique des versions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

APERÇU

Le client doit pouvoir :

Visualiser

Télécharger

Remplacer

Comparer les versions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTIFICATIONS

Créer automatiquement une notification lorsque :

un document est reçu

un document est validé

un document est refusé

un commentaire est ajouté

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. ACTIONS DISPONIBLES

Toutes les actions doivent devenir réellement fonctionnelles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A. ENVOYER LA DEMANDE

Avant l'envoi effectuer automatiquement :

Validation complète.

Vérifier :

Projet immobilier

Documents obligatoires

Informations personnelles

Aucune erreur

Si tout est valide :

Afficher :

Résumé

Confirmation

Puis :

Créer le dossier

Attribuer le numéro

Créer l'historique

Notifier le client

Notifier l'agent

Changer automatiquement le statut :

"En cours d'étude"

Le bouton devient :

Demande envoyée

et n'est plus modifiable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B. MODIFIER LA DEMANDE

Disponible uniquement avant l'envoi.

Après l'envoi :

Le bouton devient :

Demander une modification.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C. COMPLÉTER LES INFORMATIONS

Cette action doit analyser automatiquement le dossier.

Afficher précisément :

Les éléments manquants.

Exemple :

Relevés bancaires

Description du projet

Adresse

Le clic redirige directement vers la section concernée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D. TÉLÉCHARGER LE RÉCAPITULATIF

Générer automatiquement un PDF contenant :

Informations personnelles

Projet immobilier

Documents déposés

Statut

Historique

Référence dossier

Date

QR Code

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E. CONTACTER MON CONSEILLER

Créer un véritable point de contact.

Afficher :

Nom

Photo

Téléphone

Email

Disponibilité

Créer automatiquement un message pré-rempli contenant :

Nom du client

Référence du dossier

Sujet

Permettre :

Envoyer un message

Demander un rappel

Prendre rendez-vous

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. BARRE DE PROGRESSION

Ajouter une progression globale.

Exemple :

Constitution du dossier

72 %

Afficher :

Informations personnelles

Projet immobilier

Documents

Validation

Envoi

Chaque étape doit changer automatiquement selon les données.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. SYNCHRONISATION

Toute modification doit être immédiatement visible dans :

Tableau de bord

Mon dossier

Mon Profil

Notifications

Mon chantier (si concerné)

Sans rechargement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. HISTORIQUE

Tracer automatiquement :

Modification d'un champ

Ajout d'un document

Remplacement

Validation

Refus

Envoi

Modification du statut

Chaque action doit être enregistrée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. TESTS OBLIGATOIRES

Tester :

Pré-remplissage depuis la Landing Page

Pré-remplissage depuis Mon Profil

Modification d'un champ

Sauvegarde automatique

Ajout d'un document

Remplacement d'un document refusé

Validation

Refus

Téléchargement PDF

Envoi de la demande

Notifications

Synchronisation avec le Dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÈGLES

Ne pas modifier le design.

Ne pas supprimer les composants existants.

Conserver toute la structure actuelle.

Transformer uniquement le comportement fonctionnel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÉSULTAT ATTENDU

La page "📋 Ma demande" doit devenir le centre opérationnel du parcours client.

Le client doit pouvoir gérer l'intégralité de sa demande de financement depuis cette seule page, avec un parcours fluide, des validations intelligentes, des documents suivis en temps réel, des actions réellement fonctionnelles et une synchronisation parfaite avec le reste du Dashboard Client.