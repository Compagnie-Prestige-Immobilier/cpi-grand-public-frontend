import { useState, useMemo } from 'react';
import {
  Bell, CheckCircle2, AlertTriangle, Banknote, ShieldAlert,
  ShieldCheck, LogIn, Clock, FileX, FileCheck, CreditCard,
  BellOff, Check, ChevronRight, Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from '../contexts/NavigationContext';
import { useClientData } from '../data/useClientData';
import { useDocState } from '../data/docStateContext';
import type { ActivityEntry } from '../data/activityLog';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifCategory = 'toutes' | 'paiements' | 'securite' | 'dossier';

type NotifType =
  | 'paiement-confirme'
  | 'debit-paiement'
  | 'alerte-retard'
  | 'echeance-proche'
  | 'document-valide'
  | 'document-refuse'
  | 'dossier-update'
  | 'securite-appareil'
  | 'securite-inactivite'
  | 'securite-mdp'
  | 'info';

interface Notif {
  id: string;
  type: NotifType;
  titre: string;
  description: string;
  date: string;
  heure: string;
  lu: boolean;
  category: 'paiements' | 'securite' | 'dossier';
  actionLabel?: string;
  actionPage?: string;
}

// ─── Static notification data ─────────────────────────────────────────────────

const INITIAL_NOTIFS: Notif[] = [];

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotifType, {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  'paiement-confirme': {
    icon: CheckCircle2, color: 'var(--success)',
    bg: 'rgba(26,107,68,0.09)', border: 'rgba(26,107,68,0.18)',
    label: 'Paiement confirmé',
  },
  'debit-paiement': {
    icon: CreditCard, color: 'var(--primary)',
    bg: 'rgba(99,2,16,0.07)', border: 'rgba(99,2,16,0.14)',
    label: 'Débit',
  },
  'alerte-retard': {
    icon: AlertTriangle, color: 'var(--destructive)',
    bg: 'rgba(192,57,43,0.08)', border: 'rgba(192,57,43,0.18)',
    label: 'Alerte retard',
  },
  'echeance-proche': {
    icon: Clock, color: 'var(--accent)',
    bg: 'rgba(200,146,26,0.09)', border: 'rgba(200,146,26,0.18)',
    label: 'Rappel',
  },
  'document-valide': {
    icon: FileCheck, color: 'var(--success)',
    bg: 'rgba(26,107,68,0.09)', border: 'rgba(26,107,68,0.18)',
    label: 'Document validé',
  },
  'document-refuse': {
    icon: FileX, color: 'var(--destructive)',
    bg: 'rgba(192,57,43,0.08)', border: 'rgba(192,57,43,0.18)',
    label: 'Document refusé',
  },
  'dossier-update': {
    icon: Banknote, color: 'var(--primary)',
    bg: 'rgba(99,2,16,0.07)', border: 'rgba(99,2,16,0.14)',
    label: 'Dossier',
  },
  'securite-appareil': {
    icon: ShieldAlert, color: 'var(--destructive)',
    bg: 'rgba(192,57,43,0.08)', border: 'rgba(192,57,43,0.2)',
    label: 'Sécurité',
  },
  'securite-inactivite': {
    icon: BellOff, color: 'var(--accent)',
    bg: 'rgba(200,146,26,0.09)', border: 'rgba(200,146,26,0.18)',
    label: 'Inactivité',
  },
  'securite-mdp': {
    icon: ShieldCheck, color: 'var(--success)',
    bg: 'rgba(26,107,68,0.09)', border: 'rgba(26,107,68,0.18)',
    label: 'Sécurité',
  },
  'info': {
    icon: Info, color: 'var(--primary)',
    bg: 'rgba(99,2,16,0.07)', border: 'rgba(99,2,16,0.14)',
    label: 'Info',
  },
};

const CATEGORIES: { id: NotifCategory; label: string }[] = [
  { id: 'toutes',    label: 'Toutes'    },
  { id: 'paiements', label: 'Paiements' },
  { id: 'securite',  label: 'Sécurité'  },
  { id: 'dossier',   label: 'Dossier'   },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

// Convertit une trace d'envoi de l'agent (type 'notification') en notification client.
function agentEntryToNotif(e: ActivityEntry): Notif {
  const m = e.action.match(/«\s*(.*?)\s*»/);
  const message = m ? m[1] : e.action;
  const canal = e.action.split(' envoyé')[0] || 'Notification';
  return {
    id: e.id,
    type: 'dossier-update',
    titre: `${canal} de votre conseiller`,
    description: message,
    date: e.date,
    heure: e.heure,
    lu: false,
    category: 'dossier',
  };
}

export default function NotificationsPage() {
  const { navigate } = useNavigate();
  const client = useClientData();
  const { history } = useDocState();
  // Notifications réelles envoyées par l'agent (contexte partagé) + notifications de démo.
  const [notifs, setNotifs] = useState<Notif[]>(() => {
    const agentNotifs = history.filter(e => e.type === 'notification').map(agentEntryToNotif);
    return [...agentNotifs, ...INITIAL_NOTIFS];
  });
  const [activeCategory, setActiveCategory] = useState<NotifCategory>('toutes');

  const unreadCount = notifs.filter(n => !n.lu).length;

  const filtered = useMemo(() =>
    activeCategory === 'toutes'
      ? notifs
      : notifs.filter(n => n.category === activeCategory),
    [notifs, activeCategory],
  );

  // Group by date label
  const grouped = useMemo(() => {
    const map = new Map<string, Notif[]>();
    filtered.forEach(n => {
      if (!map.has(n.date)) map.set(n.date, []);
      map.get(n.date)!.push(n);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, lu: true })));
  const markRead = (id: string) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));

  const catCount = (cat: NotifCategory) =>
    cat === 'toutes'
      ? notifs.filter(n => !n.lu).length
      : notifs.filter(n => n.category === cat && !n.lu).length;

  return (
    <div style={{ width: '100%', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 800,
                background: 'var(--destructive)', color: '#fff',
                padding: '2px 8px', borderRadius: 'var(--r-full)',
              }}>
                {unreadCount} non lues
              </span>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: 0 }}>
            Paiements · Alertes · Sécurité · Dossier — {client.ref}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--card)',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--foreground)', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--card)'; }}
          >
            <Check size={13} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '6px', overflowX: 'auto',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '5px',
      }}>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.id;
          const count = catCount(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flex: '1 0 auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '8px 10px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                background: active ? 'var(--primary)' : 'transparent',
                color: active ? '#fff' : 'var(--muted-foreground)',
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: active ? 700 : 500,
                transition: 'all var(--dur-1) var(--ease-out)',
              }}
            >
              {cat.label}
              {count > 0 && (
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 800,
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--destructive)',
                  color: '#fff', padding: '1px 6px', borderRadius: 'var(--r-full)',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Notification list ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
          padding: '48px 24px', background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', textAlign: 'center',
        }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={22} style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>Aucune notification</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Vous êtes à jour dans cette catégorie.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {grouped.map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date group header */}
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)',
                marginBottom: '8px', paddingBottom: '6px',
                borderBottom: '1px solid var(--border)',
              }}>
                {dateLabel}
              </div>

              {/* Notifications for this date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map(notif => {
                  const cfg = TYPE_CONFIG[notif.type];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => markRead(notif.id)}
                      style={{
                        display: 'flex', gap: '14px', padding: '14px 16px',
                        background: notif.lu ? 'var(--card)' : `var(--card)`,
                        border: `1px solid ${notif.lu ? 'var(--border)' : cfg.border}`,
                        borderLeft: `3px solid ${notif.lu ? 'var(--border)' : cfg.color}`,
                        borderRadius: 'var(--r-md)', cursor: 'pointer',
                        transition: 'box-shadow 0.15s, transform 0.1s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLElement).style.transform = 'none';
                      }}
                    >
                      {/* Unread dot */}
                      {!notif.lu && (
                        <div style={{
                          position: 'absolute', top: '14px', right: '14px',
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: cfg.color,
                          boxShadow: `0 0 0 2px ${cfg.bg}`,
                        }} />
                      )}

                      {/* Icon */}
                      <div style={{
                        width: '38px', height: '38px', borderRadius: 'var(--r-sm)', flexShrink: 0,
                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: '1px',
                      }}>
                        <Icon size={17} style={{ color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: 'var(--font-sans)', fontSize: '0.875rem',
                              fontWeight: notif.lu ? 600 : 700,
                              color: 'var(--foreground)',
                            }}>
                              {notif.titre}
                            </span>
                            <span style={{
                              fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                              color: cfg.color, background: cfg.bg,
                              padding: '2px 6px', borderRadius: 'var(--r-xs)',
                            }}>
                              {cfg.label}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', flexShrink: 0, marginTop: '2px' }}>
                            {notif.heure}
                          </span>
                        </div>

                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.55 }}>
                          {notif.description}
                        </p>

                        {notif.actionLabel && notif.actionPage && (
                          <button
                            onClick={e => { e.stopPropagation(); markRead(notif.id); navigate(notif.actionPage!); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '5px 12px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                              background: cfg.bg, color: cfg.color,
                              fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700,
                              transition: 'opacity 0.12s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          >
                            {notif.actionLabel} <ChevronRight size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Security notice ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '13px 16px', borderRadius: 'var(--r-md)',
        background: 'rgba(99,2,16,0.05)', border: '1px solid rgba(99,2,16,0.1)',
      }}>
        <LogIn size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
            Sécurité du compte —{' '}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            En cas d'activité suspecte (connexion inconnue, changement non autorisé), contactez immédiatement le support CPI.
          </span>
          <button
            onClick={() => navigate('support')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700,
              color: 'var(--primary)', textDecoration: 'underline',
            }}
          >
            Contacter le support <ChevronRight size={10} />
          </button>
        </div>
      </div>

    </div>
  );
}
