/**
 * Demande de financement du client connecté (`/client/ma-demande`).
 *
 * Extrait de MaDemandePage pour être partagé : « Mon dossier » a besoin des
 * mêmes données. La clé de cache étant commune, les deux écrans lisent la même
 * requête — un seul appel réseau, et aucun risque de les voir diverger.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { clientApi, type DemandeData } from '../api/endpoints';

export const MA_DEMANDE_QUERY_KEY = ['client', 'ma-demande'] as const;

export function useMaDemandeQuery(enabled: boolean): UseQueryResult<DemandeData | null> {
  return useQuery({
    queryKey: MA_DEMANDE_QUERY_KEY,
    queryFn: () => clientApi.maDemande(),
    enabled,
  });
}

/**
 * Libellé du projet à afficher.
 *
 * `client.project_nom` n'est rempli que par le personnel : un client qui
 * remplit lui-même sa demande laissait « Projet immobilier — — — » à l'écran.
 * On retombe donc sur ce qu'il a réellement saisi.
 */
export function libelleProjet(projectNom: string | undefined, demande: DemandeData | null): string {
  if (projectNom && projectNom !== '—') return projectNom;
  return demande?.natureProjet || demande?.typeProjet || '—';
}

/** Localisation à afficher : celle du dossier, sinon celle de la demande. */
export function libelleLocalisation(adresse: string | undefined, demande: DemandeData | null): string {
  if (adresse && adresse !== '—') return adresse;
  return [demande?.adresseProjet, demande?.commune].filter(Boolean).join(', ') || '—';
}
