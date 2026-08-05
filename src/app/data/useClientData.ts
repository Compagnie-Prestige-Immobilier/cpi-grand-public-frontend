/**
 * useClientData — source unique des données du client sélectionné.
 *
 * Base vide : aucune donnée fictive. Le client courant est reconstitué à partir
 * du registre des vrais clients (ClientContext.allClients). Tout part de zéro et
 * se remplit via les actions réelles (dépôts, validations de l'Agent CPI…).
 *
 * Usage :
 *   const client = useClientData();
 *   // client.name, client.ref, client.projectNom, client.conseiller …
 */

import { useMemo } from 'react';
import { useClientContext } from '../contexts/ClientContext';
import { resolveClientBank } from './bankRegistry';
import type { TrancheData, NotifEntry, HistoEntry } from './demoStore';

// ─── Finances (aucune valeur codée en dur) ────────────────────────────────────

const ZERO_FINANCE = {
  montantFinance:    0,
  echeanceMensuelle: 0,
  moisPayes:         0,
  montantPaye:       0,
  moisRestants:      0,
  dureeTotal:        0,
};

interface Disbursement {
  tranche: number;
  label: string;
  montant: string;
  date: string;
  status: string;
  banque: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useClientData() {
  const { selectedClientId, allClients } = useClientContext();

  return useMemo(() => {
    const summary = allClients.find(c => c.id === selectedClientId);
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    return {
      id: selectedClientId,
      name: summary?.name ?? 'Nouveau client',
      projectNom: summary?.projectNom ?? '—',
      adresse: summary?.adresse ?? '—',
      ref: summary?.ref ?? selectedClientId,
      dateOuverture: summary?.dateInscription ?? today,
      conseiller: summary?.conseiller ?? 'Non assigné',
      banque: resolveClientBank(selectedClientId),
      statut: summary?.statut ?? 'Dossier en préparation',
      nextEtape: 'Dépôt du dossier',
      progression: summary?.progression ?? 0,
      // Ces champs viennent de l'API (ClientData → ClientSummary). Ils ont
      // longtemps été figés à « — » ici : le profil affichait un tiret alors que
      // le serveur renvoyait la vraie valeur. Ne jamais remettre de littéral.
      phone: summary?.phone ?? '—',
      email: summary?.email ?? '—',
      address: summary?.adresse ?? '—',
      employer: summary?.employer ?? '—',
      fonction: summary?.fonction ?? '—',
      adhesionDate: summary?.dateInscription ?? today,
      chantier: null,
      tranches: [] as TrancheData[],
      disbursements: [] as Disbursement[],
      notifications: [] as NotifEntry[],
      historique: [] as HistoEntry[],
      requisDocs: [] as { id: string; label: string; status: string; version: number }[],
      finance: ZERO_FINANCE,
    };
  }, [selectedClientId, allClients]);
}

export type ClientData = ReturnType<typeof useClientData>;
