// ─────────────────────────────────────────────────────────────────────────────
// Notifications applicatives — API only (Phase 6).
//
// Le client lit sa boîte (`GET /client/notifications`) et marque ses entrées
// lues ; le personnel CPI lit le flux complet et émet vers un dossier
// (`POST /staff/notifications/send`). Rien n'est stocké dans le navigateur :
// une notification lue sur un poste l'est partout.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useMutation, useQuery, useQueryClient,
  type UseMutationResult, type UseQueryResult,
} from '@tanstack/react-query';
import { SILENCIEUX } from '../api/client';
import {
  clientApi, staffApi,
  type NotificationData, type NotificationSendInput, type NotificationType,
} from '../api/endpoints';

export const NOTIFICATIONS_QUERY_KEY = ['client', 'notifications'] as const;
export const STAFF_NOTIFICATIONS_QUERY_KEY = ['staff', 'notifications'] as const;

/** Boîte du client connecté. Réservée au rôle `client` (403 sinon). */
export function useMesNotificationsQuery(enabled: boolean): UseQueryResult<NotificationData[]> {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => clientApi.notifications(),
    enabled,
  });
}

/** Flux complet des envois. Réservé au personnel CPI (403 sinon). */
export function useStaffNotificationsQuery(enabled: boolean): UseQueryResult<NotificationData[]> {
  return useQuery({
    queryKey: STAFF_NOTIFICATIONS_QUERY_KEY,
    queryFn: () => staffApi.notifications.list(),
    enabled,
  });
}

/** Marque une notification lue et rafraîchit la boîte. */
export function useMarkNotificationRead(): UseMutationResult<NotificationData, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientApi.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

/**
 * Envoi d'une notification vers un dossier. Le journal d'activité est écrit par
 * le serveur : on invalide aussi l'historique pour que l'envoi y apparaisse
 * sans rechargement.
 */
export function useSendNotification(): UseMutationResult<NotificationData, unknown, NotificationSendInput> {
  const queryClient = useQueryClient();

  return useMutation({
    // L'appelant (docStateContext.pushNotification) affiche déjà son message.
    meta: SILENCIEUX,
    mutationFn: (input: NotificationSendInput) => staffApi.notifications.send(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_NOTIFICATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'historique'] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'stats'] });
    },
  });
}

// ─── Mise en forme ───────────────────────────────────────────────────────────

const FR_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * L'API sérialise ses dates en « AAAA-MM-JJ HH:MM:SS ». L'espace n'est pas de
 * l'ISO 8601 : on le normalise avant de construire la Date, sinon l'analyse
 * dépend du moteur JS.
 */
export function parseApiDate(value: string): Date {
  return new Date(value.includes(' ') ? value.replace(' ', 'T') : value);
}

/** Horodatage en millisecondes — la seule clé de tri fiable. */
export function notifTimestamp(n: NotificationData): number {
  const d = parseApiDate(n.date);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Date d'une notification, en français (« 25 juillet 2026 »). */
export function notifDateLabel(n: NotificationData): string {
  const d = parseApiDate(n.date);
  return Number.isNaN(d.getTime()) ? n.date : FR_DATE.format(d);
}

/** Les plus récentes en tête. */
export function sortNotifications(list: NotificationData[] | undefined): NotificationData[] {
  return [...(list ?? [])].sort((a, b) => notifTimestamp(b) - notifTimestamp(a));
}

/** Familles validées par l'API — gardées alignées pour éviter les 422. */
export const NOTIFICATION_TYPES: NotificationType[] = ['info', 'action', 'validation', 'alerte'];
