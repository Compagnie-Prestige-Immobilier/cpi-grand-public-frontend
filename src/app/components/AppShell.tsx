import { useState } from 'react';
import {
  Building2, LayoutDashboard, FileText, Bell, UserCircle,
  LogOut, ChevronRight, Menu, X, Users,
  BarChart3, ShieldCheck, CreditCard, BookOpen, FolderOpen, LifeBuoy,
  Phone, Mail, Banknote, ScrollText, History, Settings, MessageSquare, HardHat,
} from 'lucide-react';
import cpiLogo from '../../imports/image.png';
import type { AuthUser, UserRole } from '../App';
import { ClientProvider } from '../contexts/ClientContext';
import { NavigationProvider, useNavigate } from '../contexts/NavigationContext';
import type { ClientSummary } from '../data/demoStore';
import { useClientsQuery, useMyProfileQuery, toClientSummary } from '../data/clientRegistry';
import { useClientData } from '../data/useClientData';
import { useBankRegistrySync } from '../data/bankRegistry';
import { DocStateProvider, useMesDocumentsQuery } from '../data/docStateContext';
import { CpiDocsProvider, useMesDocumentsCpiQuery, useCpiDocsQuery } from '../data/cpiDocsContext';
import { ChantierStateProvider, useChantierState, useMonChantierQuery } from '../data/chantierStateContext';
import { useDossierJourneyQuery } from '../data/dossierJourney';
import { apiErrorMessage } from '../api/client';
import ClientDashboardHome from './ClientDashboardHome';
import AgentDashboard from './AgentDashboard';
import AdminDashboard from './AdminDashboard';
import StatisticsDashboard from './StatisticsDashboard';
import ConventionBancairePage from './ConventionBancairePage';
import MonDossierPage from './MonDossierPage';
import MonChantierPage from './MonChantierPage';
import MaDemandePage from './MaDemandePage';
import MonProfilPage from './MonProfilPage';
import SimulateurPage from './SimulateurPage';
import NotificationsPage from './NotificationsPage';

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
  'client-fonctionnaire': { bg: 'rgba(200,146,26,0.15)', text: '#C8921A' },
  'client-public': { bg: 'var(--secondary)', text: 'var(--primary)' },
  'agent-cpi': { bg: 'var(--secondary)', text: 'var(--primary)' },
  'admin': { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
};

type NavItem = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };

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

function SupportPage() {
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSent, setTicketSent] = useState(false);

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketSent(true);
    setTimeout(() => { setTicketOpen(false); setTicketSent(false); setTicketSubject(''); setTicketMessage(''); }, 2200);
  };

  const CHANNELS = [
    {
      id: 'phone',
      icon: Phone,
      label: 'Téléphone',
      value: '+221 33 XXX XX XX',
      sub: 'Lun – Ven · 08h00 – 18h00',
      action: 'Appeler maintenant',
      href: 'tel:+221337XXXXXX',
      color: 'var(--success)',
      bg: 'rgba(26,107,68,0.07)',
      border: 'rgba(26,107,68,0.15)',
    },
    {
      id: 'whatsapp',
      icon: MessageSquare,
      label: 'WhatsApp',
      value: '+221 77 XXX XX XX',
      sub: 'Réponse sous 1h en heures ouvrées',
      action: 'Ouvrir WhatsApp',
      href: 'https://wa.me/221XXXXXXXXX',
      color: '#25D366',
      bg: 'rgba(37,211,102,0.07)',
      border: 'rgba(37,211,102,0.18)',
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Email',
      value: 'support@cpi.sn',
      sub: 'Réponse sous 24h ouvrées',
      action: 'Envoyer un email',
      href: 'mailto:support@cpi.sn',
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
          <a
            key={ch.id}
            href={ch.href}
            target={ch.id === 'whatsapp' ? '_blank' : undefined}
            rel={ch.id === 'whatsapp' ? 'noopener noreferrer' : undefined}
            style={{ textDecoration: 'none' }}
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
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>
                    Sujet
                  </label>
                  <select
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
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>
                    Message
                  </label>
                  <textarea
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    Réponse sous 24h ouvrées · par email ou notification
                  </span>
                  <button
                    type="submit"
                    style={{
                      padding: '9px 22px', borderRadius: 'var(--r-sm)', border: 'none',
                      background: 'var(--primary)', color: '#fff',
                      fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700,
                      cursor: 'pointer', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Envoyer le ticket
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
          <Bell size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    if (user.role === 'agent-cpi') return <AgentDashboard user={user} activeNav={activeNav} />;
    if (user.role === 'admin') return <AdminDashboard user={user} activeNav={activeNav} />;
    return null;
  };

  // Active nav label for the top bar
  // Libellés des entrées hors liste principale (bas de menu) pour le titre du bandeau.
  const EXTRA_NAV_LABELS: Record<string, string> = { support: 'Support', 'mon-profil': 'Mon profil' };
  const navLabel = navItems.find(n => n.id === activeNav)?.label ?? EXTRA_NAV_LABELS[activeNav] ?? 'Tableau de bord';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>
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
            <button className="lg:hidden" style={{ color: 'var(--muted-foreground)' }} onClick={() => setSidebarOpen(true)}>
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
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#C8921A] rounded-full" />
            </button>
            <div
              onClick={() => navigate('mon-profil')}
              className="w-8 h-8 flex items-center justify-center text-white cursor-pointer"
              style={{ background: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700 }}
            >
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          </div>
        </header>

        {/* Content — animation d'entrée rejouée à chaque changement de page */}
        <main id="cpi-main" tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden p-5 lg:p-7" style={{ outline: 'none' }}>
          <div key={activeNav} className="cpi-page-enter">
            {renderDashboard()}
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col overflow-hidden" style={{ background: 'var(--sidebar)' }}>
            <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--sidebar-border)' }}>
              <img src={cpiLogo} alt="CPI" style={{ height: '32px', width: 'auto', maxWidth: '110px' }} />
              <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
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

  const defaultPage = isClientRole ? 'simulateur' : 'dashboard';
  return (
    <NavigationProvider defaultPage={defaultPage}>
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
  );
}
