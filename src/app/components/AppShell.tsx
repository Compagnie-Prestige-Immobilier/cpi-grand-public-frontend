import { useEffect, useState, lazy, Suspense } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Building2, LayoutDashboard, FileText, Bell, UserCircle,
  LogOut, ChevronRight, Menu, X, Users,
  BarChart3, ShieldCheck, CreditCard, BookOpen, FolderOpen, LifeBuoy,
  Phone, Mail, Banknote, ScrollText, History, Settings, MessageSquare, HardHat, Eye, MoreHorizontal,
  UserCheck, UserX,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import cpiLogo from '../../assets/image.png';
import type { AuthUser, UserRole } from '../App';
import { ClientProvider } from '../contexts/ClientContext';
import { NavigationProvider, useNavigate } from '../contexts/NavigationContext';
import { Navigate, useLocation } from 'react-router';
import { areaForRole } from '../App';
import { homePath } from '../routes';
import type { ClientSummary } from '../data/demoStore';
import { useClientsQuery, useMyProfileQuery, toClientSummary } from '../data/clientRegistry';
import { useClientData } from '../data/useClientData';
import { useBankRegistrySync } from '../data/bankRegistry';
import { DocStateProvider, useMesDocumentsQuery } from '../data/docStateContext';
import { CpiDocsProvider, useMesDocumentsCpiQuery, useCpiDocsQuery } from '../data/cpiDocsContext';
import { ChantierStateProvider, useChantierState, useMonChantierQuery } from '../data/chantierStateContext';
import { useDossierJourneyQuery } from '../data/dossierJourney';
import { apiErrorMessage, isImpersonating } from '../api/client';
import { auth, clientApi } from '../api/endpoints';

/**
 * Un écran = un morceau de bundle.
 *
 * Ces onze pages étaient importées statiquement : le morceau `AppShell` pesait
 * 1 015 ko (237 ko compressés) et il fallait le charger en entier pour afficher
 * n'importe quel écran — y compris les deux tableaux de bord Recharts qu'un
 * client ne voit jamais. `lazy()` ne charge que l'écran demandé.
 */
const ClientDashboardHome    = lazy(() => import('./ClientDashboardHome'));
const AgentDashboard         = lazy(() => import('./AgentDashboard'));
const AdminDashboard         = lazy(() => import('./AdminDashboard'));
const StatisticsDashboard    = lazy(() => import('./StatisticsDashboard'));
const ConventionBancairePage = lazy(() => import('./ConventionBancairePage'));
const MonDossierPage         = lazy(() => import('./MonDossierPage'));
const MonChantierPage        = lazy(() => import('./MonChantierPage'));
const MaDemandePage          = lazy(() => import('./MaDemandePage'));
const MonProfilPage          = lazy(() => import('./MonProfilPage'));
const SimulateurPage         = lazy(() => import('./SimulateurPage'));
const NotificationsPage      = lazy(() => import('./NotificationsPage'));

interface AppShellProps {
  user: AuthUser;
  onLogout: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  'client-fonctionnaire': 'Fonctionnaire',
  'client-public': 'Client',
  'agent-cpi': 'Agent CPI',
  'admin': 'Administrateur',
};

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  // Sur le bandeau latéral sombre (#3A010A) l'or vif atteint 5,19:1 : conforme.
  'client-fonctionnaire': { bg: 'rgba(200,146,26,0.15)', text: 'var(--accent)' },
  'client-public': { bg: 'var(--secondary)', text: 'var(--primary)' },
  'agent-cpi': { bg: 'var(--secondary)', text: 'var(--primary)' },
  'admin': { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
};

type NavItem = { id: string; label: string; icon: LucideIcon };

type MobileTab = NavItem;

function getMobileTabs(role: UserRole): MobileTab[] {
  if (role === 'client-fonctionnaire' || role === 'client-public') return [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'ma-demande', label: 'Demande', icon: FileText },
    { id: 'mon-dossier', label: 'Dossier', icon: FolderOpen },
    { id: 'notifications', label: 'Alertes', icon: Bell },
  ];
  return [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: role === 'agent-cpi' ? 'dossiers' : 'demandes', label: role === 'agent-cpi' ? 'Dossiers' : 'Demandes', icon: FileText },
    { id: 'notifications-agent', label: 'Alertes', icon: Bell },
  ];
}

function getMobileMoreItems(role: UserRole, hasChantier: boolean): NavItem[] {
  const all = getNavItems(role, hasChantier);
  const tabs = new Set(getMobileTabs(role).map(item => item.id));
  const extras = all.filter(item => !tabs.has(item.id));
  if (role === 'client-fonctionnaire' || role === 'client-public') {
    extras.push({ id: 'mon-profil', label: 'Mon profil', icon: UserCircle }, { id: 'support', label: 'Support', icon: LifeBuoy });
  }
  return extras;
}

function getNavItems(role: UserRole, hasChantier = false): NavItem[] {
  if (role === 'client-fonctionnaire' || role === 'client-public') return [
    { id: 'simulateur',   label: 'Simulateur',       icon: CreditCard      },
    { id: 'dashboard',    label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'ma-demande',   label: 'Ma demande',       icon: FileText        },
    { id: 'mon-dossier',  label: 'Mon dossier',      icon: FolderOpen      },
    // « Mon chantier » n'apparaît que lorsque la construction a été lancée.
    ...(hasChantier ? [{ id: 'mon-chantier', label: 'Mon chantier', icon: HardHat } as NavItem] : []),
    { id: 'notifications', label: 'Notifications',  icon: Bell            },
  ];
  if (role === 'agent-cpi') return [
    { id: 'dashboard',          label: 'Tableau de bord',    icon: LayoutDashboard },
    { id: 'dossiers',           label: 'Dossiers en cours',  icon: FileText        },
    { id: 'traites',            label: 'Dossiers traités',   icon: ShieldCheck     },
    { id: 'clients',            label: 'Clients',            icon: Users           },
    { id: 'documents-clients',  label: 'Documents clients',  icon: FolderOpen      },
    { id: 'documents-admin',    label: 'Documents admin',    icon: ScrollText      },
    { id: 'convention',         label: 'Produits financiers',icon: BookOpen        },
    { id: 'decaissements',      label: 'Décaissements bancaires', icon: Banknote   },
    { id: 'notifications-agent',label: 'Notifications',      icon: Bell            },
    { id: 'historique',         label: 'Historique',         icon: History         },
    { id: 'statistiques',       label: 'Statistiques',       icon: BarChart3       },
  ];
  if (role === 'admin') return [
    { id: 'dashboard',          label: 'Vue globale',        icon: LayoutDashboard },
    { id: 'demandes',           label: 'Toutes les demandes',icon: FileText        },
    // Réservé au super-admin côté serveur (`validate-accounts`) : le seul
    // rôle qui atteint cette entrée de toute façon.
    { id: 'comptes-a-valider',  label: 'Comptes à valider',  icon: UserCheck       },
    // Cloisonnement strict (STEP 4) : un dossier sans conseiller n'est plus
    // visible d'aucun agent — cette entrée est le seul endroit d'où il reste
    // atteignable.
    { id: 'dossiers-non-attribues', label: 'Dossiers non attribués', icon: UserX },
    { id: 'utilisateurs',       label: 'Utilisateurs',       icon: Users           },
    { id: 'partenaires',        label: 'Partenaires',        icon: Building2       },
    { id: 'documents-clients',  label: 'Documents clients',  icon: FolderOpen      },
    { id: 'documents-admin',    label: 'Documents admin',    icon: ScrollText      },
    { id: 'decaissements',      label: 'Décaissements bancaires', icon: Banknote   },
    // AdminDashboard route déjà « chantier » (MODULE_NAVS) : seule l'entrée de
    // menu manquait, le module de suivi était donc inatteignable.
    { id: 'chantier',           label: 'Suivi chantier',     icon: HardHat         },
    { id: 'notifications-agent',label: 'Notifications',      icon: Bell            },
    { id: 'historique',         label: 'Historique',         icon: History         },
    { id: 'statistiques',       label: 'Rapports & Stats',   icon: BarChart3       },
    { id: 'systeme',            label: 'Système',            icon: Settings        },
  ];
  return [];
}

// ─── Support Page ─────────────────────────────────────────────────────────────

/**
 * Coordonnées du support — pilotées par l'environnement.
 *
 * Elles étaient codées en dur avec des valeurs de maquette
 * (« +221 33 XXX XX XX », « wa.me/221XXXXXXXXX ») affichées telles quelles aux
 * vrais clients en production. Les vraies valeurs se renseignent désormais dans
 * `.env.production`, sans toucher au code.
 *
 * Le numéro WhatsApp part en chiffres seuls (format exigé par wa.me) ; le
 * numéro d'appel garde ses espaces pour l'affichage et s'en voit débarrassé
 * pour le lien `tel:`.
 */
const SUPPORT_TEL = import.meta.env.VITE_SUPPORT_PHONE ?? '';
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP ?? '';
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@cpi.sn';

/** Libellé affiché quand la coordonnée n'est pas encore renseignée. */
const NON_RENSEIGNE = 'Bientôt disponible';

/** Libellés lisibles des sujets — le <select> ne porte que des identifiants,
 *  et c'est le libellé qui doit arriver dans la boîte du support. */
const SUJETS_SUPPORT: Record<string, string> = {
  dossier: 'Problème avec mon dossier',
  document: 'Dépôt ou validation de document',
  chantier: 'Question sur mon chantier',
  paiement: 'Question sur un paiement',
  technique: 'Problème technique (connexion, accès)',
  autre: 'Autre demande',
};

function SupportPage() {
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSent, setTicketSent] = useState(false);

  // Envoi RÉEL de la demande. Auparavant ce formulaire n'appelait rien : il
  // affichait « Ticket envoyé ! » puis se fermait, et le message du client était
  // perdu sans que personne ne le sache — ni lui, ni le support.
  const envoi = useMutation({
    mutationFn: () => clientApi.envoyerDemandeSupport({
      sujet: SUJETS_SUPPORT[ticketSubject] ?? ticketSubject,
      message: ticketMessage,
    }),
    onSuccess: () => {
      setTicketSent(true);
      setTimeout(() => { setTicketOpen(false); setTicketSent(false); setTicketSubject(''); setTicketMessage(''); }, 2200);
    },
  });

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi.isPending) return;
    envoi.mutate();
  };

  const CHANNELS = [
    {
      id: 'phone',
      icon: Phone,
      label: 'Téléphone',
      value: SUPPORT_TEL || NON_RENSEIGNE,
      sub: 'Lun – Ven · 08h00 – 18h00',
      action: 'Appeler maintenant',
      href: SUPPORT_TEL ? `tel:${SUPPORT_TEL.replace(/\s+/g, '')}` : null,
      color: 'var(--success)',
      bg: 'rgba(26,107,68,0.07)',
      border: 'rgba(26,107,68,0.15)',
    },
    {
      id: 'whatsapp',
      icon: MessageSquare,
      label: 'WhatsApp',
      value: SUPPORT_WHATSAPP || NON_RENSEIGNE,
      sub: 'Réponse sous 1h en heures ouvrées',
      action: 'Ouvrir WhatsApp',
      href: SUPPORT_WHATSAPP ? `https://wa.me/${SUPPORT_WHATSAPP.replace(/[^0-9]/g, '')}` : null,
      color: '#25D366',
      bg: 'rgba(37,211,102,0.07)',
      border: 'rgba(37,211,102,0.18)',
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Email',
      value: SUPPORT_EMAIL,
      sub: 'Réponse sous 24h ouvrées',
      action: 'Envoyer un email',
      href: `mailto:${SUPPORT_EMAIL}`,
      color: 'var(--primary)',
      bg: 'var(--secondary)',
      border: 'rgba(99,2,16,0.15)',
    },
  ];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '22px', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(120deg, var(--primary) 0%, #8E1526 100%)',
        borderRadius: 'var(--r-md)', padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <LifeBuoy size={22} style={{ color: '#fff' }} />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
            Contactez-nous
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>
            Service client & support technique CPI — choisissez votre canal préféré
          </p>
        </div>
      </div>

      {/* Contact channels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {CHANNELS.map(ch => (
          // Coordonnée non renseignée ⇒ pas de lien : une carte cliquable qui
          // n'ouvre rien vaut moins qu'une carte visiblement inactive.
          <a
            key={ch.id}
            href={ch.href ?? undefined}
            target={ch.href && ch.id === 'whatsapp' ? '_blank' : undefined}
            rel={ch.href && ch.id === 'whatsapp' ? 'noopener noreferrer' : undefined}
            aria-disabled={ch.href ? undefined : true}
            style={{ textDecoration: 'none', pointerEvents: ch.href ? undefined : 'none', opacity: ch.href ? 1 : 0.55 }}
          >
            <div style={{
              background: ch.bg,
              border: `1px solid ${ch.border}`,
              borderRadius: 'var(--r-md)', padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
              cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.12s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
            >
              {/* Icon */}
              <div style={{ width: '44px', height: '44px', borderRadius: 'var(--r-md)', background: 'var(--card)', border: `1px solid ${ch.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ch.icon size={20} style={{ color: ch.color }} />
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: '2px' }}>{ch.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>{ch.value}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>{ch.sub}</div>
              </div>
              {/* CTA */}
              <div style={{
                padding: '8px 16px', borderRadius: 'var(--r-sm)',
                background: ch.color, color: '#fff',
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {ch.action}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>ou</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      {/* Ticket section */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: ticketOpen ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ScrollText size={17} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>Créer un ticket de support</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Décrivez votre problème — notre équipe vous répond sous 24h</div>
            </div>
          </div>
          <button
            onClick={() => setTicketOpen(o => !o)}
            style={{
              padding: '8px 18px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
              background: ticketOpen ? 'var(--secondary)' : 'var(--primary)',
              color: ticketOpen ? 'var(--foreground)' : '#fff',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700,
              cursor: 'pointer', flexShrink: 0, transition: 'all var(--dur-1) var(--ease-out)',
            }}
          >
            {ticketOpen ? 'Annuler' : 'Nouveau ticket'}
          </button>
        </div>

        {ticketOpen && (
          <div style={{ padding: '22px' }}>
            {ticketSent ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px 0', textAlign: 'center' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(26,107,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={22} style={{ color: 'var(--success)' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>Ticket envoyé !</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Notre équipe vous répondra sous 24h ouvrées.</div>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="champ-support-sujet" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>
                    Sujet
                  </label>
                  <select id="champ-support-sujet"
                    value={ticketSubject}
                    onChange={e => setTicketSubject(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border)', background: 'var(--input-background)',
                      fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: ticketSubject ? 'var(--foreground)' : 'var(--muted-foreground)',
                      outline: 'none', cursor: 'pointer', appearance: 'none', boxSizing: 'border-box',
                    }}
                  >
                    <option value="" disabled>Choisir le sujet de votre demande…</option>
                    <option value="dossier">Problème avec mon dossier</option>
                    <option value="document">Dépôt ou validation de document</option>
                    <option value="chantier">Question sur mon chantier</option>
                    <option value="paiement">Question sur un paiement</option>
                    <option value="technique">Problème technique (connexion, accès)</option>
                    <option value="autre">Autre demande</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="champ-support-message" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>
                    Message
                  </label>
                  <textarea id="champ-support-message"
                    value={ticketMessage}
                    onChange={e => setTicketMessage(e.target.value)}
                    required
                    rows={4}
                    placeholder="Décrivez votre problème ou votre question en détail…"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border)', background: 'var(--input-background)',
                      fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)',
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                {envoi.isError && (
                  <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 'var(--r-sm)', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--destructive)', fontWeight: 600 }}>
                    {apiErrorMessage(envoi.error, "Votre demande n'a pas pu être envoyée. Réessayez ou écrivez-nous directement.")}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    Réponse sous 24h ouvrées · par email ou notification
                  </span>
                  <button
                    type="submit"
                    disabled={envoi.isPending}
                    aria-busy={envoi.isPending || undefined}
                    style={{
                      padding: '9px 22px', borderRadius: 'var(--r-sm)', border: 'none',
                      background: 'var(--primary)', color: '#fff',
                      fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700,
                      cursor: envoi.isPending ? 'wait' : 'pointer', transition: 'opacity 0.15s',
                      opacity: envoi.isPending ? 0.85 : 1,
                    }}
                    onMouseEnter={e => { if (!envoi.isPending) e.currentTarget.style.opacity = '0.88'; }}
                    onMouseLeave={e => { if (!envoi.isPending) e.currentTarget.style.opacity = '1'; }}
                  >
                    {envoi.isPending ? 'Envoi en cours…' : 'Envoyer le ticket'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Horaires */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 20px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-foreground)' }}>
          <Bell size={14} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>Horaires d'ouverture</span>
        </div>
        {[
          { label: 'Lundi – Vendredi', value: '08h00 – 18h00' },
          { label: 'Samedi', value: '09h00 – 13h00' },
          { label: 'Dimanche & jours fériés', value: 'Fermé' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>{value}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

// ─── Inner shell — reads navigation from context ───────────────────────────────

function AppShellInner({ user, onLogout }: AppShellProps) {
  const { activeNav, navigate } = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const roleLabel = ROLE_LABELS[user.role];
  const roleColor = ROLE_COLORS[user.role];

  // Numéro de dossier affiché sous le nom (clients uniquement, si un dossier existe).
  const client = useClientData();
  const isClientRole = user.role === 'client-public' || user.role === 'client-fonctionnaire';
  const dossierRef = isClientRole && client.ref && client.ref !== '—' ? client.ref : null;

  // « Mon chantier » n'est proposé au client que si sa construction a été
  // lancée. Le signal vient de GET /client/mon-chantier (statut du chantier),
  // la seule source que le client possède : le cache des décaissements n'est
  // alimenté que côté personnel et laissait l'entrée invisible pour tout client.
  const { hasChantier } = useChantierState();
  const navItems = getNavItems(user.role, isClientRole && hasChantier);
  const mobileTabs = getMobileTabs(user.role);
  const mobileMoreItems = getMobileMoreItems(user.role, isClientRole && hasChantier);

  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [moreOpen]);

  /**
   * Écrans que le rôle courant a le droit d'ouvrir.
   *
   * Le menu ne proposait déjà que ceux-là, mais rien n'empêchait d'atteindre
   * les autres — hier c'était impossible faute d'URL, ce ne l'est plus. Un
   * client qui saisit /admin/decaissements doit obtenir une 404, pas le module
   * de décaissement.
   */
  const allowedNavs = new Set<string>([
    ...navItems.map(n => n.id),
    'mon-profil',
    ...(isClientRole ? ['support'] : []),
  ]);

  const renderDashboard = () => {
    if (activeNav === 'statistiques')  return <StatisticsDashboard user={user} />;
    if (activeNav === 'convention')    return <ConventionBancairePage />;
    if (activeNav === 'ma-demande')    return <MaDemandePage user={user} />;
    if (activeNav === 'mon-dossier')   return <MonDossierPage  user={user} />;
    if (activeNav === 'mon-chantier')  return <MonChantierPage user={user} />;
    if (activeNav === 'simulateur')    return <SimulateurPage user={user} />;
    if (activeNav === 'support')       return <SupportPage />;
    if (activeNav === 'notifications') return <NotificationsPage />;
    if (activeNav === 'mon-profil')    return <MonProfilPage user={user} onLogout={onLogout} />;

    if (user.role === 'client-fonctionnaire' || user.role === 'client-public') {
      return <ClientDashboardHome user={user} />;
    }
    if (user.role === 'agent-cpi') return <AgentDashboard user={user} activeNav={activeNav ?? 'dashboard'} />;
    if (user.role === 'admin') return <AdminDashboard user={user} activeNav={activeNav ?? 'dashboard'} />;
    return null;
  };

  // Active nav label for the top bar
  // Libellés des entrées hors liste principale (bas de menu) pour le titre du bandeau.
  const EXTRA_NAV_LABELS: Record<string, string> = { support: 'Support', 'mon-profil': 'Mon profil' };
  const introuvable = activeNav === null || !allowedNavs.has(activeNav);
  const navLabel = introuvable
    ? 'Page introuvable'
    : navItems.find(n => n.id === activeNav)?.label ?? EXTRA_NAV_LABELS[activeNav] ?? 'Tableau de bord';

  // La racine « / » n'appartient pas à l'espace du personnel : on l'y emmène
  // chez lui plutôt que de lui présenter une 404 après connexion.
  if (activeNav === null && location.pathname === '/') {
    return <Navigate to={homePath(areaForRole(user.role))} replace />;
  }

  return (
    <div className="cpi-app-shell flex h-screen overflow-hidden" style={{ background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>
      {/* Lien d'évitement clavier (accessibilité) */}
      <a href="#cpi-main" className="cpi-skip">Aller au contenu</a>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-64 flex-shrink-0">
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--sidebar)' }}>
          {/* Logo */}
          <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
            <img src={cpiLogo} alt="CPI" className="h-9 w-auto" style={{ maxWidth: '120px' }} />
          </div>

          {/* User info */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: 'white' }}>
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-white truncate" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.name}</div>
                {dossierRef && (
                  <div className="truncate" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginTop: '2px', fontFamily: 'var(--font-sans)' }}>
                    Dossier {dossierRef}
                  </div>
                )}
                <div className="inline-flex items-center px-2 py-0.5 mt-0.5" style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', backgroundColor: roleColor.bg, color: roleColor.text }}>
                  {roleLabel}
                </div>
              </div>
            </div>
            {user.memberNumber && (
              <div className="mt-2 font-mono" style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{user.memberNumber}</div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${active ? '' : 'hover:text-white hover:bg-white/5'}`}
                    style={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400, ...(active ? { background: 'var(--sidebar-accent)', color: 'var(--sidebar-accent-foreground)' } : { color: 'var(--sidebar-foreground)' }) }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Bottom */}
          <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
            <button
              onClick={() => navigate('mon-profil')}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:text-white hover:bg-white/5 transition-all"
              style={{ fontSize: '0.875rem', color: activeNav === 'mon-profil' ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)', background: activeNav === 'mon-profil' ? 'var(--sidebar-accent)' : 'transparent' }}
            >
              <UserCircle className="w-4 h-4" />
              Mon profil
            </button>
            {isClientRole && (
              <button
                onClick={() => navigate('support')}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:text-white hover:bg-white/5 transition-all"
                style={{ fontSize: '0.875rem', color: activeNav === 'support' ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)', background: activeNav === 'support' ? 'var(--sidebar-accent)' : 'transparent' }}
              >
                <LifeBuoy className="w-4 h-4" />
                Support
              </button>
            )}
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:text-red-400 hover:bg-white/5 transition-all"
              style={{ fontSize: '0.875rem', color: 'var(--sidebar-foreground)' }}
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b px-5 py-3.5 flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            <button className="lg:hidden cpi-mobile-menu-trigger" aria-label="Ouvrir le menu" style={{ color: 'var(--muted-foreground)' }} onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
                {navLabel}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bell navigates directly to Notifications */}
            <button
              onClick={() => navigate('notifications')}
              className="relative p-2 transition-colors"
              style={{ color: 'var(--muted-foreground)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 'var(--r-xs)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--input-background)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            </button>
            {/* `<div onClick>` : ni focusable, ni actionnable au clavier. C'était
                le seul accès au profil depuis la barre supérieure. */}
            <button
              type="button"
              onClick={() => navigate('mon-profil')}
              aria-label={`Mon profil — ${user.name}`}
              className="w-8 h-8 flex items-center justify-center text-white cursor-pointer"
              style={{ background: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, border: 'none' }}
            >
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </button>
          </div>
        </header>

        {/* Content — animation d'entrée rejouée à chaque changement de page */}
        <main id="cpi-main" tabIndex={-1} className="cpi-shell-main flex-1 overflow-y-auto overflow-x-hidden p-5 lg:p-7" style={{ outline: 'none' }}>
          {/*
            Pas de `key={activeNav}` ici.

            Il forçait React à démonter puis remonter tout l'écran à chaque clic
            de menu, pour rejouer l'animation d'entrée. Toute saisie en cours et
            non enregistrée — un formulaire de demande à moitié rempli, un
            commentaire d'agent — disparaissait alors sans avertissement. Le
            gain était une animation ; le coût, du travail perdu.
          */}
          <div className="cpi-page-enter">
            <Suspense fallback={<PageLoading />}>
              {introuvable ? <PageIntrouvable onRetour={() => navigate('dashboard')} /> : renderDashboard()}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile first-level navigation. Secondary destinations live in Plus. */}
      <nav className="cpi-mobile-bottom-nav" aria-label="Navigation principale">
        {mobileTabs.map(item => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button key={item.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => { setMoreOpen(false); navigate(item.id); }} className={active ? 'is-active' : ''}>
              <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(open => !open)} className={moreOpen || mobileMoreItems.some(item => item.id === activeNav) ? 'is-active' : ''}>
          <MoreHorizontal size={20} strokeWidth={2} />
          <span>Plus</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button type="button" aria-label="Fermer le menu Plus" className="cpi-mobile-more-backdrop" onClick={() => setMoreOpen(false)} />
          <section className="cpi-mobile-more-sheet" aria-label="Autres sections" role="dialog" aria-modal="true">
            <div className="cpi-mobile-more-handle" />
            <div className="cpi-mobile-more-heading">
              <div>
                <strong>Autres sections</strong>
                <span>{roleLabel}</span>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Fermer"><X size={19} /></button>
            </div>
            <div className="cpi-mobile-more-grid">
              {mobileMoreItems.map(item => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button key={item.id} type="button" className={active ? 'is-active' : ''} onClick={() => { setMoreOpen(false); navigate(item.id); }}>
                    <span><Icon size={19} /></span>
                    <strong>{item.label}</strong>
                    {active && <span className="cpi-mobile-more-check">●</span>}
                  </button>
                );
              })}
              <button type="button" onClick={() => { setMoreOpen(false); onLogout(); }}>
                <span><LogOut size={19} /></span>
                <strong>Se déconnecter</strong>
              </button>
            </div>
          </section>
        </>
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <button type="button" aria-label="Fermer le menu" className="lg:hidden fixed inset-0 z-40 bg-black/50" style={{ border: 'none' }} onClick={() => setSidebarOpen(false)} />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col overflow-hidden" style={{ background: 'var(--sidebar)' }}>
            <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--sidebar-border)' }}>
              <img src={cpiLogo} alt="CPI" style={{ height: '32px', width: 'auto', maxWidth: '110px' }} />
              <button onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu" className="text-white/60 hover:text-white">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'var(--primary)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: 'white' }}>
                  {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-white truncate" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.name}</div>
                  {dossierRef && (
                    <div className="truncate" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginTop: '2px', fontFamily: 'var(--font-sans)' }}>
                      Dossier {dossierRef}
                    </div>
                  )}
                  <div className="inline-flex items-center px-2 py-0.5 mt-0.5" style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', backgroundColor: roleColor.bg, color: roleColor.text }}>
                    {roleLabel}
                  </div>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <div className="space-y-0.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { navigate(item.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${active ? '' : 'hover:text-white hover:bg-white/5'}`}
                      style={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400, ...(active ? { background: 'var(--sidebar-accent)', color: 'var(--sidebar-accent-foreground)' } : { color: 'var(--sidebar-foreground)' }) }}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
            <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
              <button
                onClick={() => { navigate('mon-profil'); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:text-white hover:bg-white/5 transition-all"
                style={{ fontSize: '0.875rem', color: activeNav === 'mon-profil' ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)', background: activeNav === 'mon-profil' ? 'var(--sidebar-accent)' : 'transparent' }}
              >
                <UserCircle className="w-4 h-4" />
                Mon profil
              </button>
              {isClientRole && (
                <button
                  onClick={() => { navigate('support'); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:text-white hover:bg-white/5 transition-all"
                  style={{ fontSize: '0.875rem', color: activeNav === 'support' ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)', background: activeNav === 'support' ? 'var(--sidebar-accent)' : 'transparent' }}
                >
                  <LifeBuoy className="w-4 h-4" />
                  Support
                </button>
              )}
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 hover:text-red-400 transition-all" style={{ fontSize: '0.875rem', color: 'var(--sidebar-foreground)' }}>
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Attente du chargement d'un morceau de bundle (une page lazy). */
function PageLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
      <div className="cpi-skeleton" style={{ width: 220, height: 26, borderRadius: 'var(--r-sm)' }} />
      <div className="cpi-skeleton" style={{ width: 320, height: 14, borderRadius: 'var(--r-sm)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 10 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="cpi-skeleton" style={{ height: 120, borderRadius: 'var(--r-md)' }} />
        ))}
      </div>
      <span role="status" aria-live="polite" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Chargement de la page…
      </span>
    </div>
  );
}

/**
 * Page introuvable.
 *
 * Elle n'existait pas : une adresse inconnue affichait silencieusement le
 * tableau de bord, et l'utilisateur croyait que son lien avait fonctionné.
 */
function PageIntrouvable({ onRetour }: { onRetour: () => void }) {
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: '55vh', textAlign: 'center', padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 900, color: 'var(--muted)', lineHeight: 1 }}>404</div>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)' }}>
        Cette page n'existe pas
      </h1>
      <p style={{ margin: 0, maxWidth: 420, fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
        L'adresse demandée ne correspond à aucun écran de votre espace. Elle a
        peut-être changé, ou vous n'y avez pas accès avec ce compte.
      </p>
      <button
        type="button"
        onClick={onRetour}
        style={{ marginTop: 6, padding: '11px 22px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
      >
        Revenir au tableau de bord
      </button>
    </div>
  );
}

// ─── Exported shell — wraps all providers ────────────────────────────────────

// ─── Écrans d'attente / d'erreur du chargement initial ───────────────────────

function ShellLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>
      <div className="cpi-skeleton" style={{ width: 220, height: 14, borderRadius: 'var(--r-full)' }} />
      <div className="cpi-skeleton" style={{ width: 160, height: 14, borderRadius: 'var(--r-full)' }} />
      <span role="status" aria-live="polite" style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
        Chargement de vos dossiers…
      </span>
    </div>
  );
}

function ShellError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, background: 'var(--background)', fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--foreground)' }}>
        Impossible de charger vos données
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0, maxWidth: 420, lineHeight: 1.6 }}>{message}</p>
      <button onClick={onRetry} style={{ padding: '10px 22px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
        Réessayer
      </button>
    </div>
  );
}

export default function AppShell({ user, onLogout }: AppShellProps) {
  const isClientRole = user.role === 'client-public' || user.role === 'client-fonctionnaire';

  // Chargement initial — mêmes clés de cache que les contextes : une seule
  // requête par ressource, mais les erreurs sont traitées ici, en un point.
  const clientsQuery = useClientsQuery(!isClientRole);
  const profileQuery = useMyProfileQuery(isClientRole);
  const mesDocsQuery = useMesDocumentsQuery(isClientRole);
  const mesCpiQuery  = useMesDocumentsCpiQuery(isClientRole);
  const journeyQuery = useDossierJourneyQuery(isClientRole);
  const cpiDocsQuery = useCpiDocsQuery(!isClientRole);
  // Même clé que ChantierStateProvider : un seul appel, mais l'entrée de menu
  // « Mon chantier » est déjà correcte au premier rendu (pas d'apparition tardive).
  const chantierQuery = useMonChantierQuery(isClientRole);
  // Alimente le cache mémoire des banques (loadBanks / loadAssignments /
  // resolveClientBank) pour tout l'arbre — non bloquant.
  useBankRegistrySync(!isClientRole, isClientRole);

  // Forme minimale commune aux requêtes surveillées (types de données différents).
  type GateQuery = { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  const gating: GateQuery[] = isClientRole
    ? [profileQuery, mesDocsQuery, mesCpiQuery, journeyQuery, chantierQuery]
    : [clientsQuery, cpiDocsQuery];
  const retryAll = () => gating.forEach(q => { void q.refetch(); });

  if (gating.some(q => q.isPending)) return <ShellLoading />;
  const failed = gating.find(q => q.isError);
  if (failed) {
    return <ShellError message={apiErrorMessage(failed.error, 'Le serveur CPI est injoignable pour le moment.')} onRetry={retryAll} />;
  }

  // Clients connus : le registre complet pour le personnel, son seul dossier
  // pour un client connecté.
  const allClients: ClientSummary[] = isClientRole
    ? (profileQuery.data ? [toClientSummary(profileQuery.data)] : [])
    : (clientsQuery.data ?? []).map(toClientSummary);

  const initialId = isClientRole
    ? (profileQuery.data?.id ?? user.clientId ?? 'c-none')
    : (allClients[0]?.id ?? 'c-none');

  return (
    <>
    <BandeauPriseEnMain nom={user.name} />
    <NavigationProvider area={areaForRole(user.role)}>
    <ClientProvider allClients={allClients} initialId={initialId} locked={isClientRole}>
    <DocStateProvider>
    <CpiDocsProvider>
    <ChantierStateProvider>
      <AppShellInner user={user} onLogout={onLogout} />
    </ChantierStateProvider>
    </CpiDocsProvider>
    </DocStateProvider>
    </ClientProvider>
    </NavigationProvider>
    </>
  );
}

/**
 * Bandeau permanent pendant une prise en main.
 *
 * Sans lui, rien à l'écran ne distinguerait le compte consulté d'une session
 * ordinaire : le membre du personnel croirait agir en son nom, et se
 * retrouverait sans moyen évident de revenir au sien.
 *
 * `position: sticky` et non `fixed` : l'application place son propre conteneur
 * de défilement, et un élément fixe s'ancrerait au mauvais bloc.
 */
function BandeauPriseEnMain({ nom }: { nom: string }) {
  const [sortie, setSortie] = useState(false);
  if (!isImpersonating()) return null;

  const rendreLaMain = () => {
    setSortie(true);
    // Le rechargement intervient dans tous les cas : `leaveImpersonation`
    // restitue le jeton du personnel même si la révocation serveur échoue.
    void auth.leaveImpersonation().finally(() => window.location.reload());
  };

  return (
    <div role="status" style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '9px 20px', background: '#C8921A', color: '#2A1A05',
      fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
    }}>
      <Eye size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 200 }}>
        Vous consultez l'espace de <strong>{nom}</strong>. Vos actions sont enregistrées à votre nom.
      </span>
      <button onClick={rendreLaMain} disabled={sortie} style={{
        padding: '6px 14px', borderRadius: 'var(--r-full)', border: 'none',
        background: '#2A1A05', color: '#fff', cursor: sortie ? 'wait' : 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        {sortie ? 'Sortie…' : 'Revenir à mon compte'}
      </button>
    </div>
  );
}
