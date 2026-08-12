/**
 * bankRegistry — registre des banques partenaires + orientation des dossiers.
 *
 * La source de vérité est désormais l'API Laravel : `/staff/banks` pour le
 * personnel (chaque banque embarque ses orientations) et `/client/mes-banques`
 * pour le client connecté. Plus rien n'est persisté dans le localStorage — les
 * clés `cpi_banks_registry_v1` et `cpi_bank_assign_v1` ont disparu.
 *
 * Comme `clientRegistry`, ce module conserve des lecteurs SYNCHRONES adossés à
 * un cache mémoire alimenté par les hooks TanStack Query exportés plus bas :
 * les consommateurs non-React historiques (useClientData…) continuent de
 * compiler et de fonctionner.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { parseFrDate } from '../lib/format';
import {
  clientApi, staffApi,
  type BankAssignmentData, type BankAssignmentStatus, type BankCreateInput, type BankData,
} from '../api/endpoints';

export interface Bank {
  id: string;
  name: string;
  conventionDate: string;   // date de signature (FR, ex. « 25 juillet 2026 »)
  validity: string;          // valable jusqu'au (FR)
  products: string[];        // ['Fonctionnaire', 'Standard', ...]
  rate: string;              // taux indicatif, ex. « 8,50% »
  contact: string;           // téléphone / e-mail
  color: string;             // couleur d'identité (hex)
}

export type BankStatus = BankAssignmentStatus;

export interface BankAssignment {
  bankId: string;
  bankName: string;
  status: BankStatus;
}

// Palette proposée pour les nouvelles banques.
export const BANK_COLORS = ['#1E4D8C', '#1A6B44', '#630210', '#C8921A', '#6D28D9', '#0E7490'];

// ─── Clés de cache TanStack Query ─────────────────────────────────────────────

export const BANKS_QUERY_KEY       = ['staff', 'banks'] as const;
export const MES_BANQUES_QUERY_KEY = ['client', 'mes-banques'] as const;

// ─── Cache mémoire (pont vers les consommateurs synchrones) ───────────────────

let banksCache: Bank[] = [];
let assignmentsCache: Record<string, BankAssignment[]> = {};

/** Banques partenaires connues (cache mémoire alimenté par l'API). */
export function loadBanks(): Bank[] {
  return banksCache;
}

/** Orientations connues, par identifiant de dossier. */
export function loadAssignments(): Record<string, BankAssignment[]> {
  return assignmentsCache;
}

export function hydrateBanks(list: Bank[]): void {
  banksCache = list;
}

export function hydrateAssignments(map: Record<string, BankAssignment[]>): void {
  assignmentsCache = map;
}

// ─── Conversions DTO → formes attendues par l'UI ──────────────────────────────

/** BankData (API) → Bank. Les champs vides s'affichent « — » comme auparavant. */
export function toBank(d: BankData): Bank {
  return {
    id: d.id,
    name: d.name,
    conventionDate: d.conventionDate ?? '—',
    validity: d.validity ?? '—',
    products: d.products ?? [],
    rate: d.rate ?? '—',
    contact: d.contact ?? '—',
    color: d.color,
  };
}

export function toBankAssignment(d: BankAssignmentData): BankAssignment {
  return { bankId: d.bankId, bankName: d.bankName, status: d.status as BankStatus };
}

/**
 * Carte { clientId: orientations } reconstituée depuis /staff/banks : l'API ne
 * expose pas de route « toutes les orientations », chaque banque porte les
 * siennes.
 */
export function toAssignmentMap(banks: BankData[]): Record<string, BankAssignment[]> {
  const map: Record<string, BankAssignment[]> = {};
  for (const bank of banks) {
    for (const assignment of bank.assignments ?? []) {
      (map[assignment.clientId] ??= []).push(toBankAssignment(assignment));
    }
  }
  return map;
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

/**
 * Registre complet + orientations de tous les dossiers (personnel CPI).
 * `enabled` doit être faux pour un compte client : /staff/* lui est fermé.
 */
export function useBanksQuery(enabled: boolean): UseQueryResult<BankData[]> {
  const query = useQuery({
    queryKey: BANKS_QUERY_KEY,
    queryFn: () => staffApi.banks.list(),
    enabled,
  });

  useEffect(() => {
    if (query.data) {
      hydrateBanks(query.data.map(toBank));
      hydrateAssignments(toAssignmentMap(query.data));
    }
  }, [query.data]);

  return query;
}

/** Orientations du client connecté (compte `client` uniquement). */
export function useMesBanquesQuery(enabled: boolean): UseQueryResult<BankAssignmentData[]> {
  const query = useQuery({
    queryKey: MES_BANQUES_QUERY_KEY,
    queryFn: () => clientApi.mesBanques(),
    enabled,
  });

  useEffect(() => {
    if (query.data) {
      const clientId = query.data[0]?.clientId;
      hydrateAssignments(clientId ? { [clientId]: query.data.map(toBankAssignment) } : {});
    }
  }, [query.data]);

  return query;
}

/**
 * Alimente le cache mémoire selon le rôle connecté — à monter une seule fois,
 * au-dessus de l'application (cf. AppShell), pour que `loadBanks()`,
 * `loadAssignments()` et `resolveClientBank()` répondent partout.
 */
export function useBankRegistrySync(isStaff: boolean, isClient: boolean): void {
  useBanksQuery(isStaff);
  useMesBanquesQuery(isClient);
}

// ─── Écriture : registre (administrateur) ─────────────────────────────────────

/** Invalide tout ce qui dépend des banques après une mutation. */
function useInvalidateBanks() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: BANKS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: MES_BANQUES_QUERY_KEY });
  };
}

export function useCreateBank() {
  const invalidate = useInvalidateBanks();
  return useMutation({
    mutationFn: (input: BankCreateInput) => staffApi.banks.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateBank() {
  const invalidate = useInvalidateBanks();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<BankCreateInput> }) => staffApi.banks.update(v.id, v.input),
    onSuccess: invalidate,
  });
}

export function useDeleteBank() {
  const invalidate = useInvalidateBanks();
  return useMutation({
    mutationFn: (id: string) => staffApi.banks.delete(id),
    onSuccess: invalidate,
  });
}

// ─── Écriture : orientations (agent CPI et administrateur) ────────────────────

export function useAssignBank() {
  const invalidate = useInvalidateBanks();
  return useMutation({
    mutationFn: (v: { clientId: string; bankId: string }) => staffApi.banks.assign(v.clientId, v.bankId),
    onSuccess: invalidate,
  });
}

export function useSetBankStatus() {
  const invalidate = useInvalidateBanks();
  return useMutation({
    mutationFn: (v: { clientId: string; bankId: string; status: BankStatus }) =>
      staffApi.banks.setStatus(v.clientId, v.bankId, v.status),
    onSuccess: invalidate,
  });
}

export function useRemoveBankAssignment() {
  const invalidate = useInvalidateBanks();
  return useMutation({
    mutationFn: (v: { clientId: string; bankId: string }) =>
      staffApi.banks.removeAssignment(v.clientId, v.bankId),
    onSuccess: invalidate,
  });
}

// ─── Dérivations pures ────────────────────────────────────────────────────────

/** Une banque est active si sa date de validité n'est pas dépassée. */
export function isBankActive(bank: Bank, now: Date): boolean {
  const d = parseFrDate(bank.validity, now);
  if (!d) return true; // pas de date renseignée → considérée active
  return d.getTime() >= now.getTime();
}

/** Banque retenue pour un client : accord en priorité, sinon la première orientation. */
export function resolveClientBank(clientId: string): string {
  const list = assignmentsCache[clientId] ?? [];
  const accord = list.find(a => a.status === 'accord');
  if (accord) return accord.bankName;
  return list[0]?.bankName ?? '—';
}

