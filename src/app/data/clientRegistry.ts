/**
 * clientRegistry — registre des VRAIS clients et du personnel CPI.
 *
 * La source de vérité est désormais l'API Laravel (`/staff/clients` pour le
 * personnel, `/client/profile` pour le client connecté) : plus aucune donnée
 * n'est persistée dans le localStorage (les clés `cpi_clients_registry_v1` et
 * `cpi_staff_registry_v1` ont disparu).
 *
 * Ce module reste du TypeScript pur côté lecture : `loadClients()` /
 * `loadStaff()` renvoient un cache mémoire, synchrone, alimenté par les hooks
 * TanStack Query exportés plus bas. Les consommateurs non-React historiques
 * (chantierStateContext…) continuent donc de compiler et de fonctionner.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { staffApi, clientApi, type ClientData, type StaffCreated, type UserData } from '../api/endpoints';
import type { ClientSummary } from './demoStore';
import { frDate } from './demoStore';

// ─── Clés de cache TanStack Query (partagées entre contextes) ─────────────────

export const CLIENTS_QUERY_KEY   = ['staff', 'clients'] as const;
export const STAFF_QUERY_KEY     = ['staff', 'accounts'] as const;
export const MY_PROFILE_QUERY_KEY = ['client', 'profile'] as const;

// ─── Cache mémoire (pont vers les consommateurs synchrones) ───────────────────

let clientsCache: ClientSummary[] = [];

/** Liste des clients connus (cache mémoire alimenté par l'API). */
export function loadClients(): ClientSummary[] {
  return clientsCache;
}

/** Remplace le cache mémoire à partir de la réponse de l'API. */
export function hydrateClients(list: ClientSummary[]): void {
  clientsCache = list;
}

// ─── Conversions DTO → formes attendues par l'UI ──────────────────────────────

/** ClientData (API) → ClientSummary (forme historique des écrans). */
export function toClientSummary(c: ClientData): ClientSummary {
  return {
    id: c.id,
    name: c.name,
    ref: c.ref,
    statut: c.statut,
    progression: c.progression,
    projectNom: c.projectNom ?? '—',
    adresse: c.adresse ?? '—',
    dateInscription: frDate(c.dateInscription),
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
  };
}

// ─── Lecture : liste des clients (personnel CPI) ──────────────────────────────

/**
 * Charge le registre complet depuis l'API et hydrate le cache mémoire.
 * `enabled` doit être faux pour un compte client (il n'a pas accès à /staff).
 */
export function useClientsQuery(enabled: boolean): UseQueryResult<ClientData[]> {
  const query = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: () => staffApi.clients.listAll(),
    enabled,
  });

  useEffect(() => {
    if (query.data) hydrateClients(query.data.map(toClientSummary));
  }, [query.data]);

  return query;
}

/** Dossier du client connecté (compte `client` uniquement). */
export function useMyProfileQuery(enabled: boolean): UseQueryResult<ClientData> {
  const query = useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: () => clientApi.profile(),
    enabled,
  });

  useEffect(() => {
    if (query.data) hydrateClients([toClientSummary(query.data)]);
  }, [query.data]);

  return query;
}

// ─── Écriture : création d'un dossier client ──────────────────────────────────

/** Création d'un dossier client — la référence est générée par le serveur. */
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email?: string; phone?: string }) =>
      staffApi.clients.create({
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }); },
  });
}

// ─── Comptes professionnels (personnel CPI) ───────────────────────────────────

export interface StaffAccount {
  id: string;
  email: string;
  name: string;
  role: 'agent-cpi' | 'admin';
  /** Mot de passe provisoire — connu uniquement à la création du compte. */
  password?: string;
  createdAt?: string;
}

let staffCache: StaffAccount[] = [];

/** Personnel CPI connu (cache mémoire alimenté par l'API). */
export function loadStaff(): StaffAccount[] {
  return staffCache;
}

/** Remplace le cache mémoire à partir de la réponse de l'API. */
export function hydrateStaff(list: StaffAccount[]): void {
  staffCache = list;
}

/** UserData (API) → StaffAccount (le rôle Spatie `super-admin` s'affiche « admin »). */
export function toStaffAccount(u: UserData): StaffAccount {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role === 'super-admin' ? 'admin' : 'agent-cpi',
  };
}

/** Liste des comptes du personnel (administrateur uniquement). */
export function useStaffQuery(enabled: boolean): UseQueryResult<UserData[]> {
  const query = useQuery({
    queryKey: STAFF_QUERY_KEY,
    queryFn: () => staffApi.staff.list(),
    enabled,
  });

  useEffect(() => {
    if (query.data) hydrateStaff(query.data.map(toStaffAccount));
  }, [query.data]);

  return query;
}

/** Création d'un compte pro — le mot de passe provisoire vient du serveur. */
export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation<StaffCreated, unknown, { name: string; email: string; role: 'agent-cpi' | 'admin' }>({
    mutationFn: input => staffApi.staff.create({
      name: input.name,
      email: input.email,
      role: input.role === 'admin' ? 'super-admin' : 'agent-cpi',
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: STAFF_QUERY_KEY }); },
  });
}
