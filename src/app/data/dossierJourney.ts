/**
 * dossierJourney — « Parcours du dossier ».
 *
 * Le parcours compte 6 étapes, toutes validées par l'Agent CPI. Pour le client
 * connecté, l'étape active est calculée PAR LE SERVEUR
 * (`GET /client/mon-dossier-journey`) : le backend est la source unique de
 * vérité (cf. ClientController::computeJourneyStep).
 *
 * Flux :
 *   1. Inscription       — le client crée son compte (demande pas encore envoyée)
 *   2. Dossier reçu      — demande envoyée, le CPI vérifie les pièces
 *   3. Documents valides — toutes les pièces sont conformes
 *   4. Analyser          — étude du dossier par le CPI
 *   5. Validation banque — accord de la banque partenaire
 *   6. Signature         — contrats & actes
 *
 * `computeJourneyStep` reste exporté pour les vues d'agrégation du personnel
 * CPI (tableaux de bord multi-dossiers) : c'est le portage exact de la règle
 * serveur, il évite un appel API par dossier affiché.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { clientApi, type DossierJourney as ApiDossierJourney } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { usePermission } from '../auth/PermissionContext';

export interface JourneyStep {
  label: string;
  sub: string;
}

// Parcours du dossier — 6 étapes.
export const TIMELINE_STEPS: JourneyStep[] = [
  { label: 'Inscription',       sub: 'Compte créé'        },
  { label: 'Dossier reçu',      sub: 'CPI a réceptionné'  },
  { label: 'Documents valides', sub: 'Pièces conformes'   },
  { label: 'Analyser',          sub: 'Étude de dossier'   },
  { label: 'Validation banque', sub: 'Banque partenaire'  },
  { label: 'Signature',         sub: 'Contrats & actes'   },
];

// Index des étapes clés.
export const DOCS_VALIDES_INDEX = 2; // « Documents valides »
export const SIGNATURE_INDEX = TIMELINE_STEPS.length - 1; // « Signature »

/** Clé de cache du parcours du client connecté. */
export const JOURNEY_QUERY_KEY = ['client', 'dossier-journey'] as const;

// Index (0-based) de l'étape en cours dans TIMELINE_STEPS.
//
// `etapeCpi` est le signal de progression piloté par l'Agent CPI pour les étapes
// postérieures aux pièces (Analyser → Validation banque → Signature). Il n'est pris
// en compte qu'une fois toutes les pièces conformes : on ne peut pas analyser,
// valider en banque ni signer un dossier dont les pièces ne sont pas complètes.
export function computeJourneyStep(
  submitted: boolean,
  docs: Array<{ status: string }>,
  etapeCpi: number = DOCS_VALIDES_INDEX,
): number {
  if (!submitted) return 0; // Inscription — compte créé, demande pas encore envoyée
  const total    = docs.length;
  const allValid = total > 0 && docs.every(d => d.status === 'accepte');
  // Dossier reçu : le CPI a la demande mais toutes les pièces ne sont pas conformes.
  if (!allValid) return 1;
  // Pièces conformes : au moins « Documents valides », puis avancée pilotée par le CPI.
  return Math.min(SIGNATURE_INDEX, Math.max(DOCS_VALIDES_INDEX, etapeCpi));
}

export interface DossierJourney {
  /** Index (0-based) de l'étape en cours. */
  activeStep: number;
  /** Libellé de l'étape suivante (ou « Dossier finalisé »). */
  nextEtape: string;
  /** La demande a-t-elle été envoyée dans « Ma demande » ? */
  submitted: boolean;
  /** Le dossier a-t-il atteint l'étape « Signature » (contrats & actes) ? */
  reachedSignature: boolean;
  /** Nombre total d'étapes. */
  total: number;
  /** Les 6 étapes du parcours. */
  steps: JourneyStep[];
  /** Parcours en cours de chargement depuis l'API. */
  loading: boolean;
  /** Message d'erreur si le parcours n'a pas pu être chargé. */
  error: string | null;
  /** Relance le chargement du parcours. */
  retry: () => void;
}

/** Requête brute du parcours (partagée avec le chargement initial d'AppShell). */
export function useDossierJourneyQuery(enabled: boolean): UseQueryResult<ApiDossierJourney> {
  return useQuery({
    queryKey: JOURNEY_QUERY_KEY,
    queryFn: () => clientApi.monDossierJourney(),
    enabled,
  });
}

/** Parcours du client connecté — l'étape vient du serveur. */
export function useDossierJourney(): DossierJourney {
  const { role } = usePermission();
  const query = useDossierJourneyQuery(role === 'client');

  const activeStep = query.data?.step ?? 0;
  const nextEtape  = activeStep < TIMELINE_STEPS.length - 1
    ? TIMELINE_STEPS[activeStep + 1].label
    : 'Dossier finalisé';

  return {
    activeStep,
    nextEtape,
    submitted: query.data?.submitted ?? false,
    reachedSignature: activeStep >= SIGNATURE_INDEX,
    total: TIMELINE_STEPS.length,
    steps: TIMELINE_STEPS,
    loading: role === 'client' && query.isPending,
    error: query.error ? apiErrorMessage(query.error, 'Impossible de charger le parcours de votre dossier.') : null,
    retry: () => { void query.refetch(); },
  };
}
