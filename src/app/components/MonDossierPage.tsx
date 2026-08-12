import { useState, useEffect, useMemo } from 'react';
import { useDocState, type SharedDoc } from '../data/docStateContext';
import { useCpiDocs, type CpiDoc } from '../data/cpiDocsContext';
import {
  ChevronDown, ChevronUp, Download, Eye,
  CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle,
  FileText, Send, UserCheck, Banknote, CreditCard,
  History, MessageSquare, ArrowRight, Info,
  User, CalendarDays, Building, PenSquare,
  FileSignature, ScrollText, Handshake, Mail as MailIcon,
  ClipboardList, Archive, X, ShieldCheck, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '../App';
import { useClientData } from '../data/useClientData';
import { libelleProjet, libelleLocalisation, useMaDemandeQuery } from '../data/maDemande';
import { usePermission } from '../auth/PermissionContext';
import { useMesBanquesQuery, toBankAssignment, type BankStatus } from '../data/bankRegistry';
import { apiErrorMessage } from '../api/client';
import { useDossierJourney, TIMELINE_STEPS } from '../data/dossierJourney';
import { useNavigate } from '../contexts/NavigationContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type DossierStatus = 'en-attente' | 'depose' | 'verification' | 'accepte' | 'refuse' | 'a-remplacer';

interface RequisDossier {
  id: string;
  num: number;
  label: string;
  requirement: string;
  accent: string;
  accentBg: string;
  icon: LucideIcon;
  status: DossierStatus;
  date?: string;
  agent?: string;
  commentaire?: string;
}

// ─── 3 Dossiers requis — visual config, live status overlaid from context ─────

const REQUIS_DOSSIERS: RequisDossier[] = [
  {
    id: 'identite', num: 1,
    label: "Pièce d'identité valide",
    requirement: 'CNI ou passeport en cours de validité',
    accent: 'var(--primary)', accentBg: 'var(--secondary)',
    icon: UserCheck, status: 'accepte',
  },
  {
    id: 'revenus', num: 2,
    label: 'Justificatifs de revenus',
    requirement: '3 derniers bulletins de salaire',
    accent: 'var(--success)', accentBg: 'rgba(26,107,68,0.08)',
    icon: Banknote, status: 'accepte',
  },
  {
    id: 'bancaires', num: 3,
    label: 'Relevés bancaires',
    requirement: '3 derniers relevés de compte',
    accent: 'var(--chart-4)', accentBg: 'rgba(176,80,112,0.08)',
    icon: CreditCard, status: 'accepte',
  },
];

// ─── Documents CPI ────────────────────────────────────────────────────────────

interface CpiFolder {
  id: string;
  label: string;
  icon: LucideIcon;
  docs: Array<{ id: string; nom: string; date: string; statut: string; canSign: boolean; version: string; format?: string; taille?: string; categorie: string }>;
}

const CPI_STATUS_LABEL: Record<string, string> = {
  brouillon:  'À venir',
  publie:     'Disponible',
  disponible: 'Disponible',
  'a-signer': 'À signer',
  signe:      'Signé',
  refuse:     'Refusé',
  archive:    'Archivé',
};

const CPI_CATEGORY_CFG: Record<string, { label: string; icon: LucideIcon }> = {
  contrats:     { label: 'Contrats',           icon: ScrollText    },
  conventions:  { label: 'Conventions',         icon: Handshake     },
  bancaires:    { label: 'Documents bancaires', icon: CreditCard    },
  courriers:    { label: 'Courriers',           icon: MailIcon      },
  pv:           { label: 'Procès-verbaux',       icon: ClipboardList },
  autorisations:{ label: 'Autorisations',        icon: FileSignature },
};

// Flat list of every CPI document visible to the client — "to sign" first.
function computeCpiDocs(docs: CpiDoc[]): CpiFolder['docs'] {
  const visible = docs.filter(d => d.visibleClient && d.status !== 'brouillon' && d.status !== 'archive');
  const mapped = visible.map(d => ({
    id: d.id,
    nom: d.nom,
    date: d.datePublication || d.dateCreation || '—',
    statut: (d.signatureRequise && d.status === 'a-signer') ? 'À signer' : (CPI_STATUS_LABEL[d.status] || d.status),
    canSign: d.signatureRequise && d.status === 'a-signer',
    version: d.version,
    format: d.format,
    taille: d.taille,
    categorie: d.categorie,
  }));
  return mapped.sort((a, b) => Number(b.canSign) - Number(a.canSign));
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DossierStatus, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  'accepte':      { label: 'Validé',          color: 'var(--success)',          bg: 'rgba(26,107,68,0.10)',  icon: CheckCircle2 },
  'refuse':       { label: 'Refusé',          color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.08)', icon: XCircle },
  'a-remplacer':  { label: 'À corriger',      color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.08)', icon: RefreshCw },
  'verification': { label: 'En vérification', color: 'var(--accent-text)',           bg: 'rgba(200,146,26,0.10)', icon: Clock },
  'en-attente':   { label: 'À déposer',       color: 'var(--muted-foreground)', bg: 'var(--muted)',          icon: Clock },
  'depose':       { label: 'Déposé — analyse', color: 'var(--chart-4)',         bg: 'rgba(176,80,112,0.08)', icon: Send },
};

const CPI_STATUS_MAP: Record<string, { color: string; bg: string }> = {
  'Signé':      { color: 'var(--success)',          bg: 'rgba(26,107,68,0.10)'    },
  'À signer':   { color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.08)'    },
  'À venir':    { color: 'var(--muted-foreground)', bg: 'var(--muted)'            },
  'Disponible': { color: 'var(--primary)',          bg: 'var(--secondary)'        },
  'Refusé':     { color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.08)'    },
};

// ─── Progress — counts dossiers, not individual files ─────────────────────────

function computeProgress(dossiers: Array<{ status: DossierStatus }>) {
  const total = dossiers.length;
  const validated = dossiers.filter(d => d.status === 'accepte').length;
  const inReview  = dossiers.filter(d => d.status === 'verification' || d.status === 'depose').length;
  const missing   = dossiers.filter(d => ['en-attente', 'refuse', 'a-remplacer'].includes(d.status)).length;
  return { total, validated, inReview, missing, pct: total ? Math.round((validated / total) * 100) : 0 };
}

// Merge static visual config with live status/comment from context.
function mergeDossiers(live: SharedDoc[]): RequisDossier[] {
  return REQUIS_DOSSIERS.map(rd => {
    const ld = live.find(d => d.id === rd.id);
    if (!ld) return rd;
    return {
      ...rd,
      status: ld.status as DossierStatus,
      commentaire: ld.commentaire ?? rd.commentaire,
      agent: ld.agentName ?? rd.agent,
      date: ld.dateValidation ?? ld.date ?? rd.date,
    };
  });
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function DossierStatusBadge({ status }: { status: DossierStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: 'var(--r-full)', background: cfg.bg, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap' }}>
      <Icon size={11} style={{ flexShrink: 0 }} />{cfg.label}
    </span>
  );
}

function ActionBtn({ icon: Icon, label, variant = 'ghost', disabled, onClick }: {
  icon: LucideIcon;
  label: string; variant?: 'ghost' | 'primary' | 'sign';
  disabled?: boolean; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const styles: Record<string, React.CSSProperties> = {
    ghost:   { border: '1px solid var(--border)',   color: hov ? 'var(--foreground)' : 'var(--muted-foreground)', background: hov ? 'var(--input-background)' : 'transparent' },
    primary: { border: 'none',                      color: 'var(--primary-foreground)', background: hov && !disabled ? 'var(--primary-hover)' : 'var(--primary)', boxShadow: hov && !disabled ? 'var(--shadow-hover)' : 'var(--elev-xs)' },
    sign:    { border: '1px solid var(--primary)',  color: 'var(--primary)',            background: hov && !disabled ? 'var(--secondary)' : 'transparent' },
  };
  return (
    <button
      disabled={disabled}
      title={disabled ? 'Interface de signature à venir' : undefined}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'all var(--dur-1) var(--ease-out)', whiteSpace: 'nowrap', ...styles[variant] }}>
      <Icon size={12} />{label}
    </button>
  );
}

// Section shell — a titled card the whole page is built from.
function Section({ icon: Icon, iconBg, iconColor, title, subtitle, right, children }: {
  icon: LucideIcon;
  iconBg: string; iconColor: string; title: string; subtitle?: string;
  right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

// ─── Full-width Journey Banner ────────────────────────────────────────────────

function DossierJourneyBanner() {
  // L'étape est calculée par le serveur (GET /client/mon-dossier-journey).
  const { activeStep, nextEtape, total, loading, error, retry } = useDossierJourney();
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 100); return () => clearTimeout(t); }, []);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="cpi-skeleton" style={{ height: 148, borderRadius: 'var(--r-lg)', marginBottom: '16px' }} />
    );
  }

  if (error) {
    return (
      <div role="alert" style={{ background: 'var(--card)', border: '1px solid rgba(192,57,43,0.22)', borderRadius: 'var(--r-lg)', marginBottom: '16px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <AlertCircle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>Parcours indisponible</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{error}</div>
        </div>
        <button onClick={retry} style={{ padding: '8px 18px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--primary)', borderRadius: 'var(--r-lg)', overflow: 'hidden',
      position: 'relative', marginBottom: '16px', boxShadow: '0 8px 32px rgba(99,2,16,0.18)',
    }}>
      <style>{`
        .dj-rail-mobile { display: none; }
        @media (max-width: 620px) {
          .dj-rail-desktop { display: none !important; }
          .dj-rail-mobile { display: flex !important; }
        }
      `}</style>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(200,146,26,0.07)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px 14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            Parcours de votre dossier
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', paddingLeft: '10px', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
            Étape {activeStep + 1} sur {total}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--r-full)', background: 'rgba(200,146,26,0.18)', color: 'var(--accent-text)', border: '1px solid rgba(200,146,26,0.25)', whiteSpace: 'nowrap' }}>
          {nextEtape}
        </span>
      </div>

      <div className="dj-rail-desktop" style={{ position: 'relative', zIndex: 1, padding: '0 28px 22px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
          {TIMELINE_STEPS.map((step, i) => {
            const past   = i < activeStep;
            const active = i === activeStep;
            const dotBg     = past ? 'var(--success)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.08)';
            const dotBorder = past ? 'var(--success)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.18)';
            const dotSize   = active ? 36 : 30;
            const connW = 'clamp(28px, 4vw, 56px)';

            return (
              <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: anim ? 1 : 0, transform: anim ? 'translateY(0)' : 'translateY(6px)', transition: `opacity 0.4s ease ${i * 55}ms, transform 0.4s ease ${i * 55}ms` }}>
                  <div style={{
                    width: dotSize, height: dotSize, borderRadius: '50%', background: dotBg,
                    border: `2px solid ${dotBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: active ? '0 0 0 4px rgba(200,146,26,0.18)' : past ? '0 0 0 3px rgba(26,107,68,0.15)' : 'none',
                    transition: 'all 0.3s', flexShrink: 0,
                  }}>
                    {past ? (
                      <CheckCircle2 size={13} style={{ color: '#fff' }} />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: active ? '0.6875rem' : '0.625rem', fontWeight: 800, color: active ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', maxWidth: '72px', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: active ? '0.75rem' : '0.6875rem', fontWeight: active ? 800 : past ? 600 : 500, color: active ? 'var(--accent)' : past ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)', lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                      {step.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 500, color: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                      {step.sub}
                    </span>
                  </div>
                </div>
                {i < TIMELINE_STEPS.length - 1 && (
                  <div style={{ width: connW, height: '2px', flexShrink: 0, marginTop: `${(dotSize / 2) - 1}px`, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: i < activeStep ? 'var(--success)' : 'transparent', width: anim ? '100%' : '0%', transition: `width 0.7s ease ${i * 80 + 200}ms` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact rail (mobile) — dots + libellé de l'étape active */}
      <div className="dj-rail-mobile" style={{ position: 'relative', zIndex: 1, flexDirection: 'column', gap: '10px', padding: '0 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {TIMELINE_STEPS.map((step, i) => {
            const past   = i < activeStep;
            const active = i === activeStep;
            const dotBg     = past ? 'var(--success)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.08)';
            const dotBorder = past ? 'var(--success)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.18)';
            return (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? 1 : '0 0 auto' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: dotBg, border: `2px solid ${dotBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: active ? '0 0 0 3px rgba(200,146,26,0.18)' : 'none' }}>
                  {past
                    ? <CheckCircle2 size={12} style={{ color: '#fff' }} />
                    : <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 800, color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>}
                </div>
                {i < TIMELINE_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < activeStep ? 'var(--success)' : 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 800, color: 'var(--accent-text)' }}>{TIMELINE_STEPS[activeStep].label}</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}> — {TIMELINE_STEPS[activeStep].sub}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Project header (compact identity + pieces progress) ──────────────────────

function ProjectHeader({ clientName }: { clientName: string }) {
  // Même requête que « Ma demande » (clé de cache commune) : aucun appel réseau
  // supplémentaire, et les deux écrans ne peuvent pas diverger.
  const { role } = usePermission();
  const demande = useMaDemandeQuery(role === 'client').data ?? null;
  const client = useClientData();
  const { requisDocs } = useDocState();
  const liveDossiers = mergeDossiers(requisDocs);
  const { pct, validated, total, missing } = computeProgress(liveDossiers);
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 150); return () => clearTimeout(t); }, []);

  const chips = [
    { Icon: User,         text: clientName },
    { Icon: UserCheck,    text: client.conseiller },
    { Icon: Building,     text: client.banque },
    { Icon: CalendarDays, text: client.dateOuverture },
  ].filter(c => c.text && c.text !== '—' && c.text !== 'Non assigné');

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>Projet immobilier</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>
              {libelleProjet(client.projectNom, demande)} <span style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}>—</span> {libelleLocalisation(client.adresse, demande)}
            </div>
            {client.ref && client.ref !== '—' && (
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--input-background)', padding: '2px 8px', borderRadius: 'var(--r-xs)', marginTop: '6px', display: 'inline-block' }}>Réf. {client.ref}</span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--r-full)', background: 'rgba(200,146,26,0.12)', color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>{client.statut}</span>
        </div>
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {chips.map(m => (
              <span key={m.text} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: 'var(--r-full)', background: 'var(--input-background)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                <m.Icon size={10} style={{ flexShrink: 0 }} />{m.text}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>pièces validées</span>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ height: '8px', borderRadius: 'var(--r-full)', background: 'var(--muted)', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ height: '100%', borderRadius: 'var(--r-full)', background: pct >= 100 ? 'var(--success)' : 'var(--primary)', width: anim ? `${pct}%` : '0%', transition: 'width 1.1s cubic-bezier(0.4,0,0.2,1)' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'rgba(26,107,68,0.10)', fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--success)' }}>
              <CheckCircle2 size={10} />Validées : {validated}/{total}
            </span>
            {missing > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'rgba(192,57,43,0.08)', fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--destructive)' }}>
                <AlertCircle size={10} />À compléter : {missing}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Suivi des pièces (read-only) ────────────────────────────────────

function PiecesSection() {
  const { navigate } = useNavigate();
  const { requisDocs } = useDocState();
  const liveDossiers = mergeDossiers(requisDocs);
  const { validated, total } = computeProgress(liveDossiers);

  return (
    <Section
      icon={FileText} iconBg="var(--secondary)" iconColor="var(--primary)"
      title="Suivi de vos pièces justificatives"
      subtitle={`${validated}/${total} validée${validated > 1 ? 's' : ''} par votre conseiller CPI`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {liveDossiers.map(d => {
          const Icon = d.icon;
          const needsAction = d.status === 'en-attente' || d.status === 'refuse' || d.status === 'a-remplacer';
          return (
            <div key={d.id} style={{ border: `1px solid ${d.status === 'accepte' ? 'rgba(26,107,68,0.2)' : needsAction ? 'rgba(192,57,43,0.16)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', flexWrap: 'wrap' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--r-sm)', background: d.status === 'accepte' ? 'rgba(26,107,68,0.1)' : d.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {d.status === 'accepte' ? <CheckCircle2 size={19} style={{ color: 'var(--success)' }} /> : <Icon size={18} style={{ color: d.accent }} />}
                </div>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)' }}>{d.label}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '1px' }}>{d.requirement}</div>
                </div>
                <DossierStatusBadge status={d.status} />
              </div>

              {/* Commentaire CPI (validé ou à corriger) */}
              {d.commentaire && (
                <div style={{ padding: '0 15px 13px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ borderLeft: `3px solid ${d.status === 'accepte' ? 'var(--success)' : 'var(--destructive)'}`, paddingLeft: '12px', flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '3px' }}>
                      {d.agent ? `Commentaire — ${d.agent}` : 'Commentaire CPI'}{d.date ? ` · ${d.date}` : ''}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', fontStyle: 'italic' }}>"{d.commentaire}"</div>
                  </div>
                </div>
              )}

              {/* Renvoi vers Ma demande pour déposer/corriger */}
              {needsAction && (
                <div style={{ padding: '11px 15px', background: 'rgba(192,57,43,0.04)', borderTop: '1px solid rgba(192,57,43,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                    <AlertCircle size={14} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                    {d.status === 'en-attente' ? 'Cette pièce reste à déposer.' : 'Cette pièce doit être corrigée.'}
                  </span>
                  <button onClick={() => navigate('ma-demande')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {d.status === 'en-attente' ? 'Déposer dans Ma demande' : 'Corriger dans Ma demande'} <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Signature électronique (modale) ──────────────────────────────────────────

interface SignDocTarget { id: string; nom: string; categorie: string; date: string; version: string }

// Contenu d'aperçu généré selon la catégorie du document (démo — texte représentatif).
function buildDocPreview(doc: SignDocTarget, client: ReturnType<typeof useClientData>) {
  const nom     = client.name;
  const projet  = client.projectNom;
  const adresse = client.adresse;
  const banque  = client.banque && client.banque !== '—' ? client.banque : 'la banque partenaire';
  const montant = client.finance?.montantFinance ? client.finance.montantFinance.toLocaleString('fr-FR') + ' FCFA' : 'le montant convenu';

  switch (doc.categorie) {
    case 'conventions':
      return {
        intro: `La présente convention définit les modalités de financement du projet immobilier du Client avec le concours de ${banque}.`,
        articles: [
          { h: 'Article 1 — Objet du financement', p: `Le financement porte sur le projet « ${projet} » pour un montant de ${montant}, destiné à l'acquisition et/ou la construction du bien situé à ${adresse}.` },
          { h: 'Article 2 — Durée et remboursement', p: `Le prêt est remboursable par mensualités constantes, prélevées automatiquement, selon l'échéancier annexé à l'offre de prêt.` },
          { h: 'Article 3 — Garanties', p: `Le Client s'engage à fournir les garanties requises par ${banque} (assurance emprunteur notamment) préalablement au déblocage des fonds.` },
          { h: 'Article 4 — Engagements du Client', p: `Le Client certifie l'exactitude des informations et pièces transmises, et s'engage à signaler tout changement de situation.` },
        ],
        closing: `Fait à Dakar. La signature électronique de la présente convention vaut acceptation sans réserve de l'ensemble de ses clauses.`,
      };
    case 'autorisations':
      return {
        intro: `Je soussigné(e) ${nom}, autorise par la présente le prélèvement des sommes dues au titre du financement de mon projet « ${projet} ».`,
        articles: [
          { h: 'Article 1 — Objet', p: `La présente autorisation porte sur le prélèvement automatique des mensualités de remboursement, au bénéfice de ${banque}.` },
          { h: 'Article 2 — Montant et périodicité', p: `Les prélèvements sont effectués mensuellement, pour un montant conforme à l'échéancier de remboursement communiqué.` },
          { h: 'Article 3 — Durée et révocation', p: `Cette autorisation reste valable pendant toute la durée du prêt et peut être révoquée par courrier, sous réserve du respect des obligations contractuelles.` },
        ],
        closing: `La signature électronique de la présente autorisation vaut consentement au prélèvement dans les conditions décrites ci-dessus.`,
      };
    case 'contrats':
      return {
        intro: `Entre CPI Immobilier (le « Promoteur ») et ${nom} (le « Client »), pour le projet « ${projet} » situé à ${adresse}.`,
        articles: [
          { h: 'Article 1 — Désignation du bien', p: `Le présent contrat porte sur le bien objet du projet « ${projet} », situé à ${adresse}.` },
          { h: 'Article 2 — Prix et conditions', p: `Le prix et les conditions de règlement sont ceux figurant à l'offre et au plan de financement annexés.` },
          { h: 'Article 3 — Obligations des parties', p: `Le Promoteur s'engage à livrer un bien conforme ; le Client s'engage à respecter l'échéancier de paiement.` },
        ],
        closing: `La signature électronique du présent contrat engage les parties dans les termes ci-dessus.`,
      };
    default:
      return {
        intro: `Document établi par CPI Immobilier dans le cadre du dossier ${client.ref} — projet « ${projet} ».`,
        articles: [
          { h: 'Objet', p: `Le présent document formalise une étape du traitement de votre dossier immobilier.` },
          { h: 'Portée', p: `Votre signature électronique atteste que vous avez pris connaissance de son contenu et en acceptez les termes.` },
        ],
        closing: `Fait à Dakar. La signature électronique vaut acceptation.`,
      };
  }
}

// Page « papier » rendue dans l'aperçu.
function DocumentPreview({ doc, client }: { doc: SignDocTarget; client: ReturnType<typeof useClientData> }) {
  const content = buildDocPreview(doc, client);
  return (
    <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '22px 22px 18px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)', color: 'var(--foreground)' }}>
      {/* En-tête officiel */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', paddingBottom: '12px', borderBottom: '2px solid var(--primary)', marginBottom: '16px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, color: 'var(--primary)' }}>CPI Immobilier</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: '#666' }}>Dakar, Sénégal · contact@cpi-immobilier.sn</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: '#666' }}>Réf. dossier</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>{client.ref}</div>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '4px' }}>{doc.nom}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: '#666', marginBottom: '16px' }}>Version {doc.version} · établi le {doc.date}</div>

      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: '#333', lineHeight: 1.7, margin: '0 0 16px' }}>{content.intro}</p>

      {content.articles.map((a, i) => (
        <div key={i} style={{ marginBottom: '14px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '3px' }}>{a.h}</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: '#333', lineHeight: 1.7, margin: 0 }}>{a.p}</p>
        </div>
      ))}

      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: '#333', lineHeight: 1.7, margin: '16px 0 20px', fontStyle: 'italic' }}>{content.closing}</p>

      {/* Blocs signatures */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px dashed #ccc', paddingTop: '14px' }}>
        {['Le Promoteur — CPI Immobilier', `Le Client — ${client.name}`].map(label => (
          <div key={label} style={{ flex: 1, minWidth: '140px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: '#666', marginBottom: '24px' }}>{label}</div>
            <div style={{ borderTop: '1px solid #999', fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: '#999', paddingTop: '3px' }}>Signature</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Construit le texte téléchargeable du document depuis l'aperçu.
function buildDocText(doc: SignDocTarget, client: ReturnType<typeof useClientData>): string {
  const c = buildDocPreview(doc, client);
  const lines: string[] = [
    'CPI IMMOBILIER — Dakar, Sénégal', `Réf. dossier : ${client.ref}`, '',
    doc.nom.toUpperCase(), `Version ${doc.version} · établi le ${doc.date}`, '',
    c.intro, '',
  ];
  c.articles.forEach(a => { lines.push(a.h, a.p, ''); });
  lines.push(c.closing, '', `Le Promoteur — CPI Immobilier          Le Client — ${client.name}`);
  return lines.join('\n');
}

function downloadDocText(doc: SignDocTarget, client: ReturnType<typeof useClientData>) {
  const blob = new Blob([buildDocText(doc, client)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.nom.replace(/[^\w\-]+/g, '_') + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Modale d'aperçu (bouton « Voir »).
function PreviewModal({ doc, onClose }: { doc: SignDocTarget; onClose: () => void }) {
  const client = useClientData();
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,8,16,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div className="cpi-scale-in" style={{ background: 'var(--card)', borderRadius: 'var(--r-md)', width: '100%', maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(28,8,16,0.28)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Eye size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>Aperçu du document</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--muted-foreground)', flexShrink: 0 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 22px', overflowY: 'auto', background: 'var(--muted)' }}>
          <DocumentPreview doc={doc} client={client} />
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={() => downloadDocText(doc, client)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--primary)', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
            <Download size={14} /> Télécharger
          </button>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

function SignatureModal({ doc, onClose }: { doc: SignDocTarget; onClose: () => void }) {
  const { signDocByClient } = useCpiDocs();
  const client = useClientData();
  const [signature, setSignature] = useState(client.name || '');
  const [accepted, setAccepted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [phase, setPhase] = useState<'form' | 'processing' | 'done'>('form');
  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const canSign = accepted && signature.trim().length >= 3;

  const handleSign = () => {
    if (!canSign) return;
    setPhase('processing');
    setTimeout(() => { signDocByClient(doc.id); setPhase('done'); }, 1100);
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && phase !== 'processing') onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,8,16,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <style>{`@keyframes cpiSpin { to { transform: rotate(360deg); } }`}</style>
      <div className="cpi-scale-in" style={{ background: 'var(--card)', borderRadius: 'var(--r-md)', width: '100%', maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(28,8,16,0.28)' }}>

        {phase === 'done' ? (
          <div style={{ padding: '36px 28px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(26,107,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={30} style={{ color: 'var(--success)' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '6px' }}>Document signé</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: '0 0 20px', lineHeight: 1.6 }}>
              « {doc.nom} » a été signé électroniquement le {now}. Une copie est disponible dans votre dossier.
            </p>
            <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PenSquare size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)' }}>Signature électronique</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '1px' }}>{doc.nom}</div>
                </div>
              </div>
              {phase !== 'processing' && (
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--muted-foreground)', flexShrink: 0 }}><X size={18} /></button>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px', opacity: phase === 'processing' ? 0.55 : 1, pointerEvents: phase === 'processing' ? 'none' : 'auto' }}>
              {/* Aperçu document — déroulant */}
              <div>
                <button
                  onClick={() => setShowPreview(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', background: 'var(--input-background)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                  <FileText size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{doc.nom}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{showPreview ? 'Masquer l\'aperçu' : 'Cliquez pour afficher le document'}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                    {showPreview ? <ChevronUp size={13} /> : <Eye size={13} />} {showPreview ? 'Masquer' : 'Aperçu'}
                  </span>
                </button>
                {showPreview && (
                  <div style={{ marginTop: '10px', maxHeight: '320px', overflowY: 'auto', background: 'var(--muted)', borderRadius: 'var(--r-sm)', padding: '10px' }}>
                    <DocumentPreview doc={doc} client={client} />
                  </div>
                )}
              </div>

              {/* Engagement légal */}
              <div style={{ display: 'flex', gap: '10px', padding: '12px 14px', background: 'rgba(99,2,16,0.04)', border: '1px solid rgba(99,2,16,0.12)', borderRadius: 'var(--r-sm)' }}>
                <ShieldCheck size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.6 }}>
                  Votre signature électronique a la même valeur juridique qu'une signature manuscrite. Elle est horodatée et associée à votre dossier de façon sécurisée.
                </p>
              </div>

              {/* Champ signature */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '7px' }}>Votre signature</label>
                <input
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  placeholder="Saisissez votre nom complet"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--input-background)', fontFamily: 'Segoe Script, "Brush Script MT", cursive', fontSize: '1.375rem', fontStyle: 'italic', color: 'var(--foreground)', boxSizing: 'border-box' }}
                />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '6px' }}>Fait le {now}</div>
              </div>

              {/* Consentement */}
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} style={{ width: 18, height: 18, marginTop: '1px', accentColor: 'var(--primary)', flexShrink: 0, cursor: 'pointer' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                  Je certifie avoir lu l'intégralité de ce document et j'en accepte les termes. Je reconnais que cette signature électronique m'engage.
                </span>
              </label>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
              {phase === 'processing' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginRight: 'auto', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                  <Loader2 size={15} style={{ color: 'var(--primary)', animation: 'cpiSpin 0.8s linear infinite' }} /> Signature en cours…
                </span>
              )}
              <button onClick={onClose} disabled={phase === 'processing'} style={{ padding: '9px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)', cursor: phase === 'processing' ? 'not-allowed' : 'pointer', opacity: phase === 'processing' ? 0.5 : 1 }}>Annuler</button>
              <button onClick={handleSign} disabled={!canSign || phase === 'processing'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 20px', borderRadius: 'var(--radius)', border: 'none', background: canSign && phase !== 'processing' ? 'var(--primary)' : 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: canSign && phase !== 'processing' ? 'var(--primary-foreground)' : 'var(--muted-foreground)', cursor: canSign && phase !== 'processing' ? 'pointer' : 'not-allowed' }}>
                <PenSquare size={14} /> Signer le document
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Documents CPI — helpers partagés ─────────────────────────────────────────

type CpiListDoc = CpiFolder['docs'][number];
const toTarget = (d: CpiListDoc): SignDocTarget => ({ id: d.id, nom: d.nom, categorie: d.categorie, date: d.date, version: d.version });
const CPI_CAT_ORDER = ['contrats', 'conventions', 'autorisations', 'bancaires', 'courriers', 'pv'];

// ─── Bandeau d'action : documents à signer ────────────────────────────────────

function SignatureBanner({ docs, onSign }: { docs: CpiListDoc[]; onSign: (d: CpiListDoc) => void }) {
  const n = docs.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', padding: '14px 18px', background: 'rgba(200,146,26,0.10)', border: '1px solid rgba(200,146,26,0.28)', borderRadius: 'var(--r-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'rgba(200,146,26,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PenSquare size={19} style={{ color: 'var(--accent-text)' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, color: 'var(--foreground)' }}>{n} document{n > 1 ? 's' : ''} à signer</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Votre signature électronique est attendue pour finaliser votre dossier.</div>
        </div>
      </div>
      <button onClick={() => onSign(docs[0])} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <PenSquare size={14} /> Signer maintenant
      </button>
    </div>
  );
}

// ─── Section: Documents de mon dossier (résumé + filtre + groupes) ─────────────

function CpiDocsSection({ docs, onSign, onPreview, onDownload }: {
  docs: CpiListDoc[];
  onSign: (d: CpiListDoc) => void;
  onPreview: (d: CpiListDoc) => void;
  onDownload: (d: CpiListDoc) => void;
}) {
  const [filter, setFilter] = useState<'tous' | 'a-signer'>('tous');
  const total     = docs.length;
  const toSign    = docs.filter(d => d.canSign).length;
  const signed    = docs.filter(d => d.statut === 'Signé').length;
  const available = docs.filter(d => d.statut === 'Disponible').length;

  const shown = filter === 'a-signer' ? docs.filter(d => d.canSign) : docs;
  const groups = CPI_CAT_ORDER
    .map(cat => ({ cat, label: CPI_CATEGORY_CFG[cat]?.label ?? cat, Icon: CPI_CATEGORY_CFG[cat]?.icon ?? FileText, items: shown.filter(d => d.categorie === cat) }))
    .filter(g => g.items.length > 0);

  const renderCard = (doc: CpiListDoc, i: number) => {
    const cfg = CPI_STATUS_MAP[doc.statut] || { color: 'var(--muted-foreground)', bg: 'var(--muted)' };
    return (
      <div key={doc.id + i} style={{ border: `1px solid ${doc.canSign ? 'rgba(192,57,43,0.15)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', overflow: 'hidden', borderLeft: `3px solid ${doc.statut === 'Signé' ? 'var(--success)' : doc.canSign ? 'var(--destructive)' : 'var(--border)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', flexWrap: 'wrap' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: 'var(--r-sm)', background: 'var(--input-background)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={17} style={{ color: doc.statut === 'Signé' ? 'var(--success)' : doc.canSign ? 'var(--destructive)' : 'var(--primary)' }} />
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '3px' }}>{doc.nom}</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {doc.taille && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{doc.taille}</span>}
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>· {doc.version} · {doc.date}</span>
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 'var(--r-full)', background: cfg.bg, fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap' }}>{doc.statut}</span>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {doc.statut !== 'À venir' && <ActionBtn icon={Eye} label="Voir" onClick={() => onPreview(doc)} />}
            {doc.statut !== 'À venir' && <ActionBtn icon={Download} label="Télécharger" onClick={() => onDownload(doc)} />}
            {doc.canSign && <ActionBtn icon={PenSquare} label="Signer" variant="sign" onClick={() => onSign(doc)} />}
          </div>
        </div>
      </div>
    );
  };

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 'var(--r-full)', border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary)' : 'transparent', color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
    fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <Section
      icon={Building} iconBg="var(--secondary)" iconColor="var(--primary)"
      title="Documents de mon dossier"
      subtitle="Contrats, conventions et actes établis par le CPI"
    >
      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 24px' }}>
          <Archive size={26} style={{ color: 'var(--muted-foreground)', margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>Aucun document pour l'instant</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Vos contrats et actes apparaîtront ici dès que le CPI les aura préparés.</div>
        </div>
      ) : (
        <>
          {/* Résumé chiffré */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {[
              { label: 'Total',       value: total,     color: 'var(--primary)',     bg: 'var(--secondary)' },
              { label: 'À signer',    value: toSign,    color: 'var(--destructive)', bg: 'rgba(192,57,43,0.08)' },
              { label: 'Signés',      value: signed,    color: 'var(--success)',     bg: 'rgba(26,107,68,0.10)' },
              { label: 'Disponibles', value: available, color: 'var(--muted-foreground)', bg: 'var(--input-background)' },
            ].map(s => (
              <div key={s.label} style={{ flex: '1 1 auto', minWidth: '84px', padding: '9px 12px', borderRadius: 'var(--r-sm)', background: s.bg }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '3px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filtre */}
          {toSign > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button style={pill(filter === 'tous')} onClick={() => setFilter('tous')}>Tous ({total})</button>
              <button style={pill(filter === 'a-signer')} onClick={() => setFilter('a-signer')}>À signer ({toSign})</button>
            </div>
          )}

          {/* Groupes par catégorie */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {groups.map(g => (
              <div key={g.cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                  <g.Icon size={13} style={{ color: 'var(--muted-foreground)' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--input-background)', padding: '0 6px', borderRadius: 'var(--r-xs)' }}>{g.items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {g.items.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

// ─── Section: Historique ──────────────────────────────────────────────────────

function HistoriqueSection() {
  const { history } = useDocState();
  const { cpiHistory } = useCpiDocs();
  const [open, setOpen] = useState(true);

  const allHistory = useMemo(() => {
    const merged = [...history, ...cpiHistory];
    merged.sort((a, b) => (b.date + ' ' + (b.heure || '')).localeCompare(a.date + ' ' + (a.heure || '')));
    return merged;
  }, [history, cpiHistory]);

  const iconTypeMap: Record<string, string> = {
    validation: 'success', refus: 'warning', commentaire: 'comment',
    document: 'info', notification: 'info', photo: 'info', decaissement: 'info', depot: 'info',
  };
  const iconMap: Record<string, { bg: string; color: string; El: LucideIcon }> = {
    success: { bg: 'rgba(26,107,68,0.12)',  color: 'var(--success)',     El: CheckCircle2 },
    warning: { bg: 'rgba(192,57,43,0.10)',  color: 'var(--destructive)', El: AlertCircle },
    comment: { bg: 'rgba(200,146,26,0.10)', color: 'var(--accent-text)',      El: MessageSquare },
    info:    { bg: 'var(--secondary)',      color: 'var(--primary)',     El: Info },
  };

  const grouped: { date: string; entries: { icon: string; text: string; agent: string }[] }[] = [];
  for (const entry of allHistory) {
    const item = { icon: iconTypeMap[entry.type] ?? 'info', text: entry.action, agent: entry.utilisateur };
    const last = grouped[grouped.length - 1];
    if (last && last.date === entry.date) last.entries.push(item);
    else grouped.push({ date: entry.date, entries: [item] });
  }

  return (
    <Section
      icon={History} iconBg="rgba(200,146,26,0.1)" iconColor="var(--accent-text)"
      title="Historique du dossier"
      subtitle="Suivi des actions de votre conseiller CPI"
      right={
        <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', cursor: 'pointer' }}>
          {open ? 'Réduire' : 'Afficher'} {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      }
    >
      {!open ? (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{allHistory.length} action{allHistory.length > 1 ? 's' : ''} enregistrée{allHistory.length > 1 ? 's' : ''}.</div>
      ) : grouped.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Aucune activité enregistrée pour le moment.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {grouped.map(group => (
            <div key={group.date}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '2px' }}>{group.date}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {group.entries.map((e, i) => {
                  const cfg = iconMap[e.icon] || iconMap.info;
                  const EntryIcon = cfg.El;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: 'var(--input-background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <EntryIcon size={13} style={{ color: cfg.color }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', flex: 1 }}>{e.text}</span>
                      {e.agent && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--card)', padding: '2px 8px', borderRadius: 'var(--r-xs)', whiteSpace: 'nowrap', flexShrink: 0 }}>{e.agent}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const BANK_STATUS_UI: Record<BankStatus, { label: string; color: string; bg: string }> = {
  'en-attente': { label: 'En cours d’étude', color: 'var(--accent-text)',      bg: 'rgba(200,146,26,0.10)' },
  accord:       { label: 'Accord de principe', color: 'var(--success)',    bg: 'rgba(26,107,68,0.10)' },
  refus:        { label: 'Non retenue',        color: 'var(--destructive)', bg: 'rgba(192,57,43,0.08)' },
};

/**
 * Orientations bancaires du dossier connecté — GET /client/mes-banques.
 * L'API n'expose pas le registre complet des banques à un compte client
 * (aucune route /client/banks au STEP 9) : la section ne montre donc que les
 * banques réellement saisies sur le dossier.
 */
function BanksSection() {
  const query = useMesBanquesQuery(true);
  const assigned = (query.data ?? []).map(toBankAssignment);

  const shell = (children: React.ReactNode) => (
    <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <Building size={18} style={{ color: 'var(--primary)' }} />
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Banques partenaires</h3>
      </div>
      {children}
    </section>
  );

  if (query.isPending) {
    return shell(
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: '10px 0 0' }}>
        <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Chargement de vos banques…
      </p>,
    );
  }

  if (query.error) {
    return shell(
      <div style={{ marginTop: 10 }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--destructive)', margin: '0 0 10px' }}>
          <AlertCircle size={14} /> {apiErrorMessage(query.error, 'Impossible de charger vos banques partenaires.')}
        </p>
        <button onClick={() => { void query.refetch(); }} style={{ padding: '7px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>,
    );
  }

  if (assigned.length === 0) return null;

  return shell(
    <>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: '0 0 14px' }}>
        Votre dossier est étudié par {assigned.length > 1 ? 'ces banques partenaires' : 'cette banque partenaire'}, pour maximiser vos chances de financement.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {assigned.map(a => {
          const st = BANK_STATUS_UI[a.status];
          return (
            <div key={a.bankId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '12px 14px', background: 'var(--secondary)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{a.bankName}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 'var(--r-full)' }}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </>,
  );
}

export default function MonDossierPage({ user }: { user: AuthUser }) {
  const { cpiDocs } = useCpiDocs();
  const client = useClientData();
  const cpiList = useMemo(() => computeCpiDocs(cpiDocs), [cpiDocs]);
  const toSignDocs = cpiList.filter(d => d.canSign);
  const [signTarget, setSignTarget] = useState<SignDocTarget | null>(null);
  const [previewTarget, setPreviewTarget] = useState<SignDocTarget | null>(null);

  return (
    <div style={{ fontFamily: 'var(--font-sans)', width: '100%', padding: '0 0 48px' }}>
      <DossierJourneyBanner />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ProjectHeader clientName={user.name} />
        {toSignDocs.length > 0 && <SignatureBanner docs={toSignDocs} onSign={d => setSignTarget(toTarget(d))} />}
        <PiecesSection />
        <BanksSection />
        <CpiDocsSection
          docs={cpiList}
          onSign={d => setSignTarget(toTarget(d))}
          onPreview={d => setPreviewTarget(toTarget(d))}
          onDownload={d => downloadDocText(toTarget(d), client)}
        />
        <HistoriqueSection />
      </div>
      {signTarget && <SignatureModal doc={signTarget} onClose={() => setSignTarget(null)} />}
      {previewTarget && <PreviewModal doc={previewTarget} onClose={() => setPreviewTarget(null)} />}
    </div>
  );
}
