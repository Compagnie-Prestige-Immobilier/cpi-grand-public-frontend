MISSION

Compléter uniquement les modules incomplets du Dashboard Administrateur CPI :

1. Toutes les demandes
2. Utilisateurs
3. Partenaires
4. Paramètres

Ne reconstruis pas le Dashboard Administrateur.

Ne modifie pas la barre latérale.

Ne change pas les routes existantes.

Ne change pas le Design System.

Ne modifie pas les modules déjà fonctionnels :

- Vue globale
- Documents clients
- Documents admin
- Suivi chantier
- Décaissements CBAO
- Notifications
- Historique
- Rapports & Stats
- Système
- Se déconnecter

Travaille progressivement et réutilise les composants, cartes, tableaux, badges, formulaires, modales et filtres déjà présents dans le projet.

IMPORTANT

Avant toute modification :

- lire AdminDashboard.tsx ;
- identifier les composants déjà associés aux quatre menus incomplets ;
- vérifier les modèles de données disponibles dans demoStore.ts ;
- vérifier ClientContext et les contextes multi-clients existants ;
- ne pas réécrire entièrement un fichier si une modification ciblée suffit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE 1 — TOUTES LES DEMANDES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

Créer une vue administrative centralisée de tous les dossiers clients.

Le module doit utiliser la base clients multi-clients déjà existante.

Afficher une demande par client avec les informations suivantes :

- référence du dossier ;
- nom du client ;
- type de projet ;
- localisation ;
- conseiller CPI ;
- banque partenaire ;
- date de création ;
- progression ;
- statut ;
- dernière activité ;
- documents requis validés ;
- chantier éventuel.

Statuts possibles :

- brouillon ;
- dossier incomplet ;
- en vérification ;
- complément demandé ;
- dossier complet ;
- transmis à la banque ;
- étude bancaire ;
- accepté ;
- refusé ;
- chantier en cours ;
- terminé ;
- archivé.

FONCTIONNALITÉS

Ajouter ou connecter :

- recherche par nom, référence, téléphone ou projet ;
- filtre par statut ;
- filtre par conseiller ;
- filtre par banque partenaire ;
- filtre par période ;
- filtre par progression ;
- tri par date récente, nom ou avancement ;
- compteur du nombre de résultats ;
- pagination simple si nécessaire.

ACTIONS PAR DOSSIER

Permettre :

- ouvrir le dossier ;
- voir les documents requis ;
- voir les documents CPI ;
- voir le chantier ;
- voir l’historique ;
- affecter un conseiller ;
- changer le statut ;
- ajouter une note interne ;
- archiver le dossier.

Ne jamais supprimer définitivement une demande.

Quand l’Administrateur ouvre une demande, définir automatiquement ce client comme `selectedClientId`.

Le changement doit être répercuté dans les modules :

- Documents clients ;
- Documents admin ;
- Suivi chantier ;
- Historique.

VUE DÉTAIL

Réutiliser une modale, un panneau latéral ou une page existante.

Afficher :

- identité du client ;
- coordonnées ;
- projet ;
- progression du dossier ;
- documents requis ;
- documents CPI ;
- situation du chantier ;
- dernières activités ;
- conseiller affecté ;
- statut actuel ;
- notes internes.

Ne duplique pas les données métier.

Les informations doivent venir des contextes et du store multi-clients existants.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE 2 — UTILISATEURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

Permettre à l’Administrateur de gérer les comptes de la plateforme.

Types d’utilisateurs :

- Administrateur ;
- Agent CPI ;
- Client ;
- Partenaire.

Chaque utilisateur doit contenir :

- id ;
- nom complet ;
- email ;
- téléphone ;
- rôle ;
- statut ;
- date de création ;
- dernière connexion ;
- conseiller ou service ;
- clientId éventuel ;
- partenaireId éventuel ;
- avatar ou initiales.

Statuts possibles :

- actif ;
- invité ;
- en attente ;
- suspendu ;
- désactivé.

INTERFACE

Afficher :

- statistiques utilisateurs ;
- liste ou tableau ;
- recherche ;
- filtres ;
- badges de rôle ;
- badges de statut ;
- menu d’actions.

Statistiques recommandées :

- total utilisateurs ;
- administrateurs ;
- agents CPI ;
- clients ;
- partenaires ;
- comptes suspendus.

ACTIONS

Permettre :

- créer un utilisateur ;
- consulter son profil ;
- modifier ses informations ;
- changer son rôle ;
- activer un compte ;
- suspendre un compte ;
- désactiver un compte ;
- renvoyer une invitation ;
- simuler une réinitialisation de mot de passe ;
- rattacher un client à un conseiller CPI.

Ne pas implémenter une authentification réelle.

Ne pas manipuler de vrais mots de passe.

Pour la démonstration, afficher seulement une confirmation indiquant qu’un lien de réinitialisation a été envoyé.

SUPPRESSION

Ne prévoir aucune suppression définitive.

Utiliser uniquement :

- suspendre ;
- désactiver ;
- archiver.

HISTORIQUE

Chaque action importante doit ajouter une entrée :

- utilisateur créé ;
- rôle modifié ;
- compte suspendu ;
- compte réactivé ;
- conseiller affecté ;
- invitation renvoyée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE 3 — PARTENAIRES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

Créer un annuaire administratif des partenaires travaillant avec CPI.

Catégories de partenaires :

- banque partenaire ;
- coopérative ;
- entreprise de construction ;
- architecte ;
- bureau d’études ;
- notaire ;
- géomètre ;
- fournisseur ;
- assureur ;
- autre partenaire institutionnel.

Chaque partenaire doit contenir :

- id ;
- nom ;
- catégorie ;
- logo éventuel ;
- statut ;
- adresse ;
- ville ;
- pays ;
- téléphone ;
- email ;
- site web éventuel ;
- responsable principal ;
- fonction du responsable ;
- date de début du partenariat ;
- nombre de dossiers liés ;
- nombre de chantiers liés ;
- commentaire interne.

Statuts possibles :

- actif ;
- en attente ;
- suspendu ;
- archivé.

INTERFACE

Afficher :

- cartes statistiques ;
- liste ou tableau ;
- recherche ;
- filtre par catégorie ;
- filtre par statut ;
- filtre par pays ou ville ;
- détail du partenaire.

Statistiques recommandées :

- partenaires actifs ;
- banques ;
- entreprises de construction ;
- partenaires techniques ;
- dossiers liés.

ACTIONS

Permettre :

- créer un partenaire ;
- consulter ;
- modifier ;
- activer ;
- suspendre ;
- archiver ;
- ajouter un contact ;
- associer un partenaire à un dossier ;
- associer une entreprise à un chantier ;
- consulter les dossiers associés ;
- consulter les chantiers associés ;
- ajouter une note interne.

Ne supprimer définitivement aucun partenaire.

DONNÉES DE DÉMONSTRATION

Créer quelques partenaires cohérents avec la plateforme :

- une banque partenaire ;
- une coopérative d’habitat ;
- deux entreprises de construction ;
- un cabinet notarial ;
- un cabinet d’architecture ;
- un bureau d’études.

Ne pas afficher de données sensibles ou de véritables identifiants bancaires.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE 4 — PARAMÈTRES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIF

Compléter la page Paramètres du Dashboard Administrateur sans modifier le module « Système ».

Créer une page structurée avec une navigation interne simple.

Sections recommandées :

1. Organisation
2. Apparence
3. Dossiers
4. Chantier
5. Notifications
6. Sécurité de la session
7. Données de démonstration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.1 ORGANISATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Permettre de configurer :

- nom de l’organisation ;
- sigle ;
- adresse ;
- téléphone ;
- email ;
- site web ;
- horaires ;
- logo ;
- nom du responsable ;
- pied de page des documents.

Conserver CPI comme valeur par défaut.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.2 APPARENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Permettre de définir :

- logo principal ;
- logo compact ;
- couleur principale ;
- couleur secondaire ;
- format des dates ;
- langue par défaut.

Ne modifie pas automatiquement le Design System actuel.

Pour cette démonstration, enregistrer les valeurs mais conserver le rendu actuel sauf si une prévisualisation existe déjà.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.3 PARAMÈTRES DES DOSSIERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configurer :

- préfixe des références ;
- documents requis par défaut ;
- statuts autorisés ;
- conseiller par défaut ;
- délai indicatif de traitement ;
- possibilité d’archiver un dossier ;
- règles de validation.

Ne modifie pas automatiquement les dossiers existants.

Les changements doivent s’appliquer uniquement aux futurs dossiers de démonstration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.4 PARAMÈTRES CHANTIER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configurer :

- quatre phases par défaut ;
- pourcentage de chaque phase ;
- types d’événements du calendrier ;
- types de médias autorisés ;
- visibilité client par défaut ;
- délai indicatif de livraison.

Conserver les valeurs actuelles :

- Tranche 1 : 35 %
- Tranche 2 : 30 %
- Tranche 3 : 30 %
- Tranche 4 : 5 %

Ne modifie pas les chantiers existants.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.5 NOTIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Permettre d’activer ou désactiver les notifications de démonstration pour :

- document accepté ;
- document refusé ;
- remplacement demandé ;
- document CPI publié ;
- signature demandée ;
- chantier mis à jour ;
- visite programmée ;
- décaissement validé.

Canaux visibles :

- notification interne ;
- email ;
- SMS.

Ne crée pas de véritable envoi d’email ou de SMS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.6 SÉCURITÉ DE LA SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Permettre de configurer visuellement :

- durée de session ;
- déconnexion automatique ;
- nombre maximal de tentatives ;
- obligation de changer le mot de passe ;
- double authentification simulée.

Ne crée pas une vraie infrastructure de sécurité.

Ne modifie pas le système d’authentification existant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.7 DONNÉES DE DÉMONSTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ajouter des actions administratives sécurisées :

- réinitialiser les filtres ;
- restaurer les paramètres par défaut ;
- réinitialiser uniquement les données de démonstration.

Pour toute réinitialisation :

- afficher une confirmation ;
- expliquer clairement les données concernées ;
- ne jamais effacer les données sans validation explicite.

Ne crée pas de bouton de suppression générale sans confirmation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSISTANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Conserver les données de démonstration avec localStorage.

Utiliser des clés versionnées et claires, par exemple :

- cpi_erp_admin_requests_v1
- cpi_erp_users_v1
- cpi_erp_partners_v1
- cpi_erp_settings_v1

Prévoir :

- lecture sécurisée du JSON ;
- valeurs par défaut ;
- gestion des clés absentes ;
- gestion des données invalides ;
- aucune erreur si le localStorage est vide.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UX ET RESPONSIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respecter exactement l’identité visuelle actuelle du Dashboard Administrateur.

Réutiliser :

- les couleurs CPI ;
- les badges ;
- les tableaux ;
- les boutons ;
- les cartes ;
- les modales ;
- les champs ;
- les espacements.

Sur mobile :

- conserver la barre latérale actuelle ;
- permettre le défilement horizontal des tableaux si nécessaire ;
- transformer les tableaux complexes en cartes seulement si un composant responsive existe déjà ;
- ne pas casser le menu.

Ajouter les états suivants lorsqu’ils sont nécessaires :

- chargement ;
- liste vide ;
- aucun résultat ;
- erreur ;
- confirmation ;
- succès.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÉTHODE DE TRAVAIL OBLIGATOIRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implémenter les modules dans cet ordre :

1. Toutes les demandes
2. Utilisateurs
3. Partenaires
4. Paramètres

Après chaque module :

- vérifier le rendu ;
- vérifier les imports ;
- vérifier TypeScript ;
- vérifier qu’aucun autre module n’a changé.

Ne fais pas une réécriture massive simultanée de tous les fichiers.

Créer des composants spécialisés si nécessaire, par exemple :

- AdminRequestsModule.tsx
- UsersManagementModule.tsx
- PartnersManagementModule.tsx
- AdminSettingsModule.tsx

Ne place pas toute la logique directement dans AdminDashboard.tsx.

AdminDashboard.tsx doit uniquement gérer la navigation et afficher le module sélectionné.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TESTS OBLIGATOIRES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 1 — TOUTES LES DEMANDES

- rechercher Aïssatou ;
- ouvrir son dossier ;
- vérifier ses informations ;
- changer le statut ;
- ouvrir Documents clients ;
- vérifier que le bon client est sélectionné.

TEST 2 — UTILISATEURS

- créer un utilisateur de démonstration ;
- changer son rôle ;
- suspendre son compte ;
- le réactiver ;
- recharger la page ;
- vérifier la persistance.

TEST 3 — PARTENAIRES

- créer une entreprise de construction ;
- modifier ses coordonnées ;
- l’associer à un chantier ;
- vérifier l’association ;
- archiver le partenaire.

TEST 4 — PARAMÈTRES

- modifier un paramètre d’organisation ;
- activer une notification ;
- recharger la page ;
- vérifier que les paramètres sont conservés ;
- restaurer les valeurs par défaut avec confirmation.

TEST 5 — RÉGRESSION

Vérifier que les modules suivants fonctionnent toujours :

- Documents clients ;
- Documents admin ;
- Suivi chantier ;
- Décaissements CBAO ;
- Notifications ;
- Historique ;
- Rapports & Stats ;
- Système.

TEST 6 — TECHNIQUE

Vérifier :

- zéro erreur TypeScript ;
- zéro import cassé ;
- zéro erreur runtime ;
- aucun doublon de client ;
- aucun composant inaccessible ;
- aucun menu cassé ;
- fonctionnement desktop et mobile.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
À LA FIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fournir un rapport contenant :

- les fichiers créés ;
- les fichiers modifiés ;
- les fonctionnalités terminées dans chaque module ;
- la structure des données ;
- les clés localStorage utilisées ;
- les tests réalisés ;
- les résultats des tests ;
- les limites restantes ;
- la confirmation que les autres modules n’ont pas été modifiés visuellement.