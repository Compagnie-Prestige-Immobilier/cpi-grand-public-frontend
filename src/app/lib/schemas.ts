/**
 * Schémas de validation des formulaires.
 *
 * Chaque schéma reproduit **exactement** les règles du contrôleur Laravel
 * correspondant. La règle est stricte : si le backend accepte, le frontend
 * accepte ; si le backend refuse, le frontend refuse avant l'appel réseau.
 *
 * La validation était auparavant réécrite à la main, en `useState`, dans chaque
 * écran — et elle avait divergé. Le cas le plus visible : l'inscription
 * exigeait 8 caractères de mot de passe (`form.pwd.length >= 8`) alors que
 * `AppServiceProvider::registerPasswordPolicy` impose depuis peu
 * `Password::min(10)->letters()->numbers()`. Le formulaire se déclarait valide,
 * l'API répondait 422, et l'utilisateur voyait un message générique sans savoir
 * quelle règle il violait.
 *
 * Référence backend : ../cpi-grand-public-backend/app/Http/Controllers/Api/
 */

import { z } from 'zod';

// ─── Messages ────────────────────────────────────────────────────────────────

const REQUIS = 'Ce champ est obligatoire.';

/** `required|string|max:N` de Laravel. */
const texteRequis = (max: number, libelle = 'Ce champ') =>
  z
    .string()
    .trim()
    .min(1, REQUIS)
    .max(max, `${libelle} ne peut pas dépasser ${max} caractères.`);

/** `nullable|string|max:N` : la chaîne vide est acceptée et vaut « non renseigné ». */
const texteFacultatif = (max: number) =>
  z.string().trim().max(max, `Ce champ ne peut pas dépasser ${max} caractères.`).optional().or(z.literal(''));

/**
 * `required|email`.
 *
 * Volontairement plus permissif que la RFC : refuser une adresse valide est
 * bien plus grave que d'en laisser passer une fausse, que le serveur rejettera.
 */
const email = z
  .string()
  .trim()
  .min(1, REQUIS)
  .email("Cette adresse e-mail n'est pas valide.");

// ─── Mot de passe ────────────────────────────────────────────────────────────

/** Longueur minimale imposée par `Password::min(10)` côté serveur. */
export const MOT_DE_PASSE_LONGUEUR_MIN = 10;

/**
 * Politique de mot de passe — miroir exact de `Password::min(10)->letters()->numbers()`.
 *
 * `uncompromised()` s'y ajoute en production (vérification auprès de la base
 * Have I Been Pwned). Elle n'est PAS reproduite ici : elle demande un appel
 * réseau, et un mot de passe compromis doit être refusé par le serveur, pas par
 * un contrôle client contournable. Le message d'erreur de l'API est alors
 * affiché tel quel.
 */
export const motDePasse = z
  .string()
  .min(MOT_DE_PASSE_LONGUEUR_MIN, `Le mot de passe doit contenir au moins ${MOT_DE_PASSE_LONGUEUR_MIN} caractères.`)
  .regex(/\p{L}/u, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre.');

/** Règles individuelles, pour l'indicateur de robustesse affiché à la saisie. */
export const REGLES_MOT_DE_PASSE: { libelle: string; verifie: (v: string) => boolean }[] = [
  { libelle: `Au moins ${MOT_DE_PASSE_LONGUEUR_MIN} caractères`, verifie: v => v.length >= MOT_DE_PASSE_LONGUEUR_MIN },
  { libelle: 'Au moins une lettre', verifie: v => /\p{L}/u.test(v) },
  { libelle: 'Au moins un chiffre', verifie: v => /\d/.test(v) },
];

// ─── Téléphone sénégalais ────────────────────────────────────────────────────

/**
 * Neuf chiffres, séparateurs libres. Le backend n'impose que
 * `nullable|string|max:50` : le format est une exigence métier CPI, pas une
 * contrainte serveur — d'où un message qui explique, plutôt qu'un refus sec.
 */
export const telephoneSenegal = z
  .string()
  .trim()
  .min(1, REQUIS)
  .refine(v => v.replace(/\D/g, '').length === 9, 'Le numéro doit comporter 9 chiffres (ex. 77 123 45 67).');

// ─── Authentification — Api/Auth/AuthController ──────────────────────────────

/** POST /auth/login — `email: required|email`, `password: required|string`. */
export const schemaConnexion = z.object({
  email,
  // Aucune règle de robustesse à la connexion : un compte plus ancien peut
  // avoir un mot de passe qui ne satisfait plus la politique courante.
  // L'y soumettre l'empêcherait de se connecter pour le changer.
  password: z.string().min(1, REQUIS),
});
export type Connexion = z.infer<typeof schemaConnexion>;

/**
 * POST /auth/register — `name: required|string|max:255`,
 * `email: required|email|unique`, `password: required|string|Password::defaults()`,
 * `phone: nullable|string|max:50`.
 *
 * Le formulaire d'inscription CPI enchaîne dans la foulée
 * `POST /auth/onboarding`, d'où la présence d'`employeur`, `revenus` et
 * `profil` : ce sont les champs requis de `completeOnboarding`.
 */
export const schemaInscription = z
  .object({
    nom: texteRequis(255, 'Le nom').refine(v => v.length >= 2, 'Le nom doit comporter au moins 2 caractères.'),
    email,
    tel: telephoneSenegal,
    employeur: texteRequis(255, "L'employeur").refine(v => v.length >= 2, 'Indiquez le nom de votre employeur.'),
    revenus: z.string().min(1, 'Sélectionnez une tranche de revenus.'),
    pwd: motDePasse,
    pwd2: z.string().min(1, REQUIS),
    // La case n'est pas décorative : elle vaut acceptation des CGU.
    accepted: z.literal(true, {
      message: "Vous devez accepter les conditions générales d'utilisation.",
    }),
  })
  .refine(d => d.pwd === d.pwd2, {
    path: ['pwd2'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
export type Inscription = z.infer<typeof schemaInscription>;

/**
 * POST /auth/onboarding — `phone: required|string`, `employer: required|string`,
 * `profile_type: required|in:fonctionnaire,prive,autre`, `revenus: required|string`.
 */
export const schemaOnboarding = z.object({
  phone: telephoneSenegal,
  employer: texteRequis(255, "L'employeur"),
  profile_type: z.enum(['fonctionnaire', 'prive', 'autre'] as const, {
    message: 'Sélectionnez votre situation professionnelle.',
  }),
  revenus: z.string().min(1, 'Sélectionnez une tranche de revenus.'),
});
export type Onboarding = z.infer<typeof schemaOnboarding>;

// ─── Demande de financement — Api/DemandeController ──────────────────────────

/**
 * PUT /client/ma-demande. Toutes les règles sont `sometimes` côté serveur : la
 * demande se remplit progressivement et s'enregistre par fragments. Les champs
 * sont donc facultatifs ici aussi — c'est `schemaDemandeSoumission` qui exige
 * l'essentiel, au moment de soumettre.
 */
export const schemaDemandeBrouillon = z.object({
  type_projet: texteFacultatif(100),
  nature_projet: texteFacultatif(100),
  montant: z.number().min(0, 'Le montant ne peut pas être négatif.').nullable().optional(),
  duree: texteFacultatif(10),
  apport: z.number().min(0, "L'apport ne peut pas être négatif.").optional(),
  region: texteFacultatif(100),
  commune: texteFacultatif(150),
  adresse_projet: texteFacultatif(255),
  description: texteFacultatif(5000),
});
export type DemandeBrouillon = z.infer<typeof schemaDemandeBrouillon>;

/**
 * POST /client/ma-demande/submit.
 *
 * Le serveur ne revalide pas le contenu au moment de la soumission : il se
 * contente de basculer `submitted`. Ces exigences sont donc purement métier —
 * elles évitent qu'un dossier vide parte à l'instruction et revienne au client
 * une semaine plus tard.
 */
export const schemaDemandeSoumission = schemaDemandeBrouillon.extend({
  type_projet: texteRequis(100, 'Le type de projet'),
  montant: z
    .number({ message: 'Indiquez le montant souhaité.' })
    .min(1, 'Indiquez le montant souhaité.'),
  duree: texteRequis(10, 'La durée'),
  region: texteRequis(100, 'La région'),
});

// ─── Support — Api/SupportController ─────────────────────────────────────────

/** POST /client/support — `sujet: required|string|max:150`, `message: required|string|max:5000`. */
export const schemaSupport = z.object({
  sujet: texteRequis(150, "L'objet"),
  message: texteRequis(5000, 'Le message').refine(
    v => v.length >= 10,
    'Décrivez votre demande en quelques mots (10 caractères minimum).',
  ),
});
export type Support = z.infer<typeof schemaSupport>;

// ─── Profil client — Api/ClientController ────────────────────────────────────

/**
 * PATCH /client/mon-profil — tous les champs en `sometimes`,
 * `name: string|max:255`, les autres `nullable|string|max:255` sauf
 * `phone: nullable|string|max:50`.
 */
export const schemaMonProfil = z.object({
  name: texteRequis(255, 'Le nom'),
  phone: texteFacultatif(50),
  adresse: texteFacultatif(255),
  employer: texteFacultatif(255),
  fonction: texteFacultatif(255),
  project_nom: texteFacultatif(255),
});
export type MonProfil = z.infer<typeof schemaMonProfil>;

/**
 * POST /staff/clients — `name: required|string|max:255`,
 * `email: nullable|email|max:255`, le reste `nullable|string|max:255`
 * (`phone` en `max:50`), `date_inscription: nullable|date`.
 */
export const schemaClientAdmin = z.object({
  name: texteRequis(255, 'Le nom'),
  email: z.string().trim().max(255).email("Cette adresse e-mail n'est pas valide.").optional().or(z.literal('')),
  phone: texteFacultatif(50),
  adresse: texteFacultatif(255),
  project_nom: texteFacultatif(255),
  employer: texteFacultatif(255),
  fonction: texteFacultatif(255),
  conseiller: texteFacultatif(255),
  banque: texteFacultatif(255),
  statut: texteFacultatif(255),
});
export type ClientAdmin = z.infer<typeof schemaClientAdmin>;

// ─── Utilitaire ──────────────────────────────────────────────────────────────

/**
 * Valide et renvoie les erreurs par champ, pour les formulaires qui ne sont pas
 * pilotés par react-hook-form.
 */
export function erreursDe<T extends z.ZodTypeAny>(
  schema: T,
  valeurs: unknown,
): Record<string, string> {
  const r = schema.safeParse(valeurs);
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const champ = issue.path.join('.') || '_';
    // Premier message seulement : empiler trois reproches sur un champ est
    // décourageant et n'aide pas à le corriger.
    if (!(champ in out)) out[champ] = issue.message;
  }
  return out;
}
