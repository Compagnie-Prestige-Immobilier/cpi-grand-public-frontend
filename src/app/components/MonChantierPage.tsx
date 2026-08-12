import { useState, useMemo } from 'react';
import {
  CheckCircle2, Clock, AlertCircle,
  Phone, Mail, MapPin, Calendar, HardHat, Building2,
  Camera, FileText, Layers, Bell, ArrowRight,
  Banknote, Wrench, Key, ChevronDown, ChevronUp,
  Download, MessageSquare, Eye, TrendingUp,
  CalendarDays, BarChart3, Image, Video,
  Ruler, Star, ArrowUpRight, Zap, User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '../App';
import { useChantierState } from '../data/chantierStateContext';
import { useClientData } from '../data/useClientData';
import { useNavigate } from '../contexts/NavigationContext';
import { Modal } from './ui/overlays';
import { DS, type StatusVariant } from './ui/index';
import { STATUT_CHANTIER } from '../lib/statuts';
import { fondPhoto } from '../lib/images';

const HERO_PHOTO = 'https://images.unsplash.com/photo-1783260606348-bb2deaa215a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080';

type TrancheEtat = 'terminee' | 'en-cours' | 'en-attente';

interface Tranche {
  id: string; num: string; label: string; detail: string;
  pct: number; montant: string; montantDec: string; date: string;
  etat: TrancheEtat; cpiOk: boolean; banqueOk: boolean;
  commentaire: string; photos: number;
}


// Base vide : aucun contenu de chantier fictif. Ces collections restent vides et
// ne sont utilisées qu'en repli si le contexte chantier réel est vide.
const FEED_STATIC: { date: string; entries: { icon: typeof Camera; text: string; type: string }[] }[] = [];

const GALLERY_ITEMS: { url: string | null; bg: string; label: string; tranche: string; date: string }[] = [];

const CALENDAR_EVENTS: { id: string; titre: string; type: string; date: string; statut: string; color: string }[] = [];

// Feuille de route standard de la construction (labels/roadmap uniquement).
/**
 * Phases de construction, dans l'ordre réel du chantier.
 *
 * Les libellés sont **exactement** ceux que le personnel choisit dans
 * `ChantierModule` (`ETAPES`) et que l'API renvoie dans
 * `chantierInfo.etapeActuelle`. C'était tout le problème de la version
 * précédente : elle listait sept phases inventées (« Études », « Élévation »,
 * « Toiture », « Réception ») dont aucune ne correspondait à une valeur
 * existante. Le tableau était figé — `status: 'pending'`, `pct: 0`, `date: '—'`
 * en dur — et rien ne l'alimentait jamais. La frise restait donc grise du
 * premier au dernier jour du chantier, y compris une fois la maison livrée.
 */
const PHASES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'preparation',  label: 'Préparation',  icon: Ruler     },
  { id: 'fondations',   label: 'Fondations',   icon: Layers    },
  { id: 'gros-oeuvre',  label: 'Gros œuvre',   icon: Building2 },
  { id: 'second-oeuvre',label: 'Second œuvre', icon: Wrench    },
  { id: 'finitions',    label: 'Finitions',    icon: Star      },
  { id: 'livraison',    label: 'Livraison',    icon: Key       },
];

/**
 * Rang de l'étape courante dans `PHASES`, ou −1 si elle est inconnue (chantier
 * non démarré, ou libellé serveur inattendu). Comparaison insensible à la casse
 * et aux accents : « Gros œuvre » ne doit pas rater « gros oeuvre ».
 */
function rangEtape(etapeActuelle: string): number {
  const norm = (v: string) =>
    v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').replace(/[^a-z]/g, '');
  const cible = norm(etapeActuelle);
  if (!cible) return -1;
  return PHASES.findIndex(p => norm(p.label) === cible);
}

// ─── Micro components ─────────────────────────────────────────────────────────

/**
 * Pastille de statut. Les couples couleur/fond viennent de `DS.status` — le
 * même registre que le reste de l'application —, et le jeu de variantes couvre
 * `StatusVariant` en entier : sans cela, un statut réel (« En retard », en
 * danger) n'avait aucune variante correspondante et retombait sur le neutre.
 */
function Badge({ children, variant = 'default' }: {
  children: React.ReactNode;
  variant?: 'default' | StatusVariant;
}) {
  const styles: Record<'default' | StatusVariant, { background: string; color: string }> = {
    default: { background: 'var(--secondary)', color: 'var(--primary)' },
    success: { background: DS.status.success.bg, color: DS.status.success.color },
    warning: { background: DS.status.warning.bg, color: DS.status.warning.color },
    danger:  { background: DS.status.danger.bg,  color: DS.status.danger.color  },
    info:    { background: DS.status.info.bg,    color: DS.status.info.color    },
    muted:   { background: DS.status.muted.bg,   color: DS.status.muted.color   },
    primary: { background: DS.status.primary.bg, color: DS.status.primary.color },
  };
  return (
    <span style={{
      ...styles[variant],
      fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 'var(--r-full)',
      display: 'inline-flex', alignItems: 'center', gap: '4px',
    }}>{children}</span>
  );
}

function SectionHeader({ icon: Icon, title, sub, action }: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: 'var(--r-sm)',
          background: 'var(--secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{title}</div>
          {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

function ProgressBar({ value, color = 'var(--primary)', thin = false }: { value: number; color?: string; thin?: boolean }) {
  return (
    <div style={{ height: thin ? '4px' : '7px', background: 'var(--muted)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.max(0, Math.min(100, value))}%`,
        background: color, borderRadius: 'var(--r-full)',
        transition: 'width 1s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

// ─── Tranche card (expanded by default if en-cours) ───────────────────────────
function TrancheCard({ t, onVoirPhotos }: { t: Tranche; onVoirPhotos?: (trancheId: string) => void }) {
  const [open, setOpen] = useState(t.etat === 'en-cours');
  const dotColor = t.etat === 'terminee' ? 'var(--success)' : t.etat === 'en-cours' ? 'var(--primary)' : 'var(--muted-foreground)';
  const pctFill = t.etat === 'terminee' ? 100 : t.etat === 'en-cours' ? 65 : 0;

  return (
    <div style={{
      border: `1px solid ${t.etat === 'en-cours' ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 'var(--r-md)', overflow: 'hidden',
      background: 'var(--card)',
      boxShadow: t.etat === 'en-cours' ? '0 4px 20px rgba(99,2,16,0.1)' : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      {/* `<button>` et non `<div onClick>` : la tranche est le seul moyen
          d'ouvrir le détail, et elle n'était atteignable qu'à la souris. */}
      <button
        type="button"
        aria-expanded={open}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', font: 'inherit', color: 'inherit' }}
        onClick={() => setOpen(o => !o)}
      >
        {/* Status dot */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
          background: t.etat === 'terminee' ? 'rgba(26,107,68,0.12)' : t.etat === 'en-cours' ? 'var(--secondary)' : 'var(--input-background)',
          border: `2px solid ${dotColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {t.etat === 'terminee'
            ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            : t.etat === 'en-cours'
            ? <Zap size={14} style={{ color: 'var(--primary)' }} />
            : <Clock size={14} style={{ color: 'var(--muted-foreground)' }} />
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {t.num} — {t.label}
            </span>
            <Badge variant={t.etat === 'terminee' ? 'success' : t.etat === 'en-cours' ? 'warning' : 'muted'}>
              {t.etat === 'terminee' ? 'Terminée' : t.etat === 'en-cours' ? 'En cours' : 'En attente'}
            </Badge>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
            {t.detail}
          </div>
          <ProgressBar value={pctFill} color={t.etat === 'terminee' ? 'var(--success)' : 'var(--primary)'} thin />
        </div>

        <div style={{ display: 'flex', flex: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
            {t.pct}%
          </div>
          <div style={{ color: 'var(--muted-foreground)' }}>
            {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </div>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--input-background)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px 20px', marginBottom: '14px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Montant</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>{t.montant} FCFA</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Décaissé</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: t.montantDec !== '—' ? 'var(--success)' : 'var(--muted-foreground)' }}>
                {t.montantDec !== '—' ? `${t.montantDec} FCFA` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Date</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{t.date}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '6px' }}>Validations</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 'var(--r-full)',
                  fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700,
                  color: t.cpiOk ? 'var(--success)' : 'var(--muted-foreground)',
                  background: t.cpiOk ? 'rgba(26,107,68,0.12)' : 'var(--muted)',
                }}>CPI {t.cpiOk ? '✓' : '···'}</span>
                <span style={{
                  padding: '3px 10px', borderRadius: 'var(--r-full)',
                  fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700,
                  color: t.banqueOk ? 'var(--success)' : 'var(--muted-foreground)',
                  background: t.banqueOk ? 'rgba(26,107,68,0.12)' : 'var(--muted)',
                }}>Banque {t.banqueOk ? '✓' : '···'}</span>
              </div>
            </div>
          </div>

          {t.commentaire && (
            <div style={{
              display: 'flex', gap: '10px', padding: '12px 14px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              marginBottom: t.photos > 0 ? '12px' : '0',
            }}>
              <AlertCircle size={14} style={{ color: 'var(--accent-text)', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
                {t.commentaire}
              </span>
            </div>
          )}

          {/* Ce bouton n'avait pas de gestionnaire. Il amène désormais à la
              galerie, filtrée sur la tranche concernée. */}
          {t.photos > 0 && (
            <a
              href="#chantier-galerie"
              onClick={() => onVoirPhotos?.(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', background: 'var(--card)',
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--primary)', cursor: 'pointer', marginTop: '4px', textDecoration: 'none',
              }}>
              <Camera size={13} aria-hidden="true" />
              Voir les {t.photos} photos de cette tranche
              <ArrowRight size={12} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// Libellés descriptifs des tranches (structure du modèle de construction 35/30/30/5).
// Aucun montant/commentaire/statut fictif : ceux-ci viennent des données réelles du
// chantier lorsqu'elles existent.
const TRANCHE_DETAILS: Record<number, { detail: string }> = {
  1: { detail: 'Terrassement, fondations, infrastructure' },
  2: { detail: 'Poteaux, dalle, élévation, toiture' },
  3: { detail: 'Menuiseries, plomberie, électricité, carrelage, peinture' },
  4: { detail: 'Inspection finale, PV de réception, remise des clés' },
};

export default function MonChantierPage({ user: _user }: { user: AuthUser }) {
  // Le filtre était typé `'all' | 'T1' | 'T2'` et sa liste écrite en dur : les
  // photos d'une troisième tranche existaient mais n'étaient atteignables par
  // aucun onglet. Il suit désormais les tranches réellement présentes.
  const [galleryFilter, setGalleryFilter] = useState<string>('all');
  const [galleryTab, setGalleryTab] = useState('photos');
  const [feedExpanded, setFeedExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const clientData = useClientData();
  const { navigate } = useNavigate();
  const {
    chantierInfo, tranches: ctxTranches, publications, medias, events, chantierHistory,
    loading, error, retry,
  } = useChantierState();
  const heroProgress = chantierInfo.progression;

  // Équipe réelle uniquement : renseignée par le CPI au fil du chantier. Aucun
  // membre fictif tant que les vraies informations ne sont pas saisies.
  const TEAM = useMemo(() => {
    const members: { initials: string; nom: string; role: string; tel: string; email: string; color: string }[] = [];
    // Le chef de chantier vient désormais de l'API (fiche du chantier).
    const chef = chantierInfo.chefChantier;
    if (chef && chef !== '—') {
      members.push({ initials: chef.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(), nom: chef, role: 'Chef de chantier', tel: '—', email: '—', color: 'var(--primary)' });
    }
    if (clientData.conseiller && clientData.conseiller !== 'Non assigné' && clientData.conseiller !== '—') {
      members.push({ initials: clientData.conseiller.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(), nom: clientData.conseiller, role: 'Conseiller CPI', tel: '—', email: '—', color: 'var(--primary)' });
    }
    return members;
  }, [chantierInfo.chefChantier, clientData]);

  // Les quatre tranches viennent de l'API (chantier du dossier) ; les montants,
  // eux, restent portés par le suivi financier quand il est renseigné.
  const TRANCHES_LIVE: Tranche[] = useMemo(() =>
    ctxTranches.map(t => {
      const base = clientData.tranches.find(b => b.num === t.num);
      const extra = TRANCHE_DETAILS[t.num] ?? {};
      const montant = base?.montant ?? '—';
      return {
        id: `t${t.num}`,
        num: `T${t.num}`,
        label: t.label,
        detail: extra.detail ?? t.description ?? '',
        pct: t.pct,
        montant,
        montantDec: t.etat === 'terminee' ? montant : '—',
        date: t.date ?? base?.date ?? '—',
        etat: t.etat as TrancheEtat,
        cpiOk: t.etat === 'terminee',
        banqueOk: t.etat === 'terminee',
        commentaire: t.comment || '',
        photos: 0,
      } as Tranche;
    })
  , [clientData.tranches, ctxTranches]);

  // DISBURSEMENTS derived from store
  const DISBURSEMENTS = useMemo(() =>
    clientData.disbursements.map(d => ({
      tranche: `T${d.tranche} — ${d.label}`,
      pct: `${clientData.tranches.find(t => t.num === d.tranche)?.pct ?? 0}%`,
      montant: `${d.montant} FCFA`,
      date: d.date,
      etat: d.status === 'Effectué' ? 'payee' : d.status === 'En cours' ? 'attente' : 'a-venir',
    }))
  , [clientData.disbursements, clientData.tranches]);

  const FEED_LIVE = useMemo(() => {
    const visible = publications.filter(p => p.visibleClient);
    if (visible.length === 0) return FEED_STATIC;
    const byDate: Record<string, Array<{ icon: typeof Camera; text: string; type: string }>> = {};
    visible.forEach(p => {
      if (!byDate[p.date]) byDate[p.date] = [];
      const icon = p.type === 'photo' || p.type === 'video' ? Camera : p.type === 'document' ? FileText : p.type === 'etape-validee' ? CheckCircle2 : p.type === 'retard' ? AlertCircle : HardHat;
      byDate[p.date].push({ icon, text: p.titre + (p.description ? ` — ${p.description}` : ''), type: p.type });
    });
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, entries]) => ({ date, entries }));
  }, [publications]);

  // `m.url` est le lien signé de courte durée renvoyé par l'API (bucket privé) :
  // on l'utilise comme vignette, avec le dégradé en repli le temps du chargement.
  const GALLERY_LIVE = useMemo(() =>
    medias.filter(m => m.type === 'photo' && m.visibleClient).map(m => ({
      // L'URL est exposée telle quelle, et non enfouie dans un `background`
      // CSS : une photo rendue en fond n'a pas de texte alternatif possible,
      // et un lecteur d'écran ne rencontrait donc *aucune* des photos du
      // chantier — la moitié de l'intérêt de cette page.
      url: m.url ?? null,
      bg: m.bg || 'linear-gradient(135deg,var(--primary),#B05070)',
      label: m.titre, tranche: m.phase ? `T${m.phase}` : 'T1', date: m.date,
    })), [medias]);
  const rawGallery = GALLERY_LIVE.length > 0 ? GALLERY_LIVE : GALLERY_ITEMS;
  const galleryItems = galleryFilter === 'all' ? rawGallery : rawGallery.filter(g => g.tranche === galleryFilter);
  const photoCount = rawGallery.length;
  // Un onglet par tranche effectivement photographiée, dans l'ordre.
  const galleryFiltres = useMemo(() => {
    const tranches = [...new Set(rawGallery.map(g => g.tranche))].sort();
    return [{ id: 'all', label: 'Tout' }, ...tranches.map(t => ({ id: t, label: t }))];
  }, [rawGallery]);

  const CALENDAR_LIVE = useMemo(() => {
    const clientEvents = events.filter(e => e.visibleClient);
    return clientEvents.length > 0 ? clientEvents.map(e => ({
      id: e.id, titre: e.titre, type: e.type, date: e.date,
      statut: e.statut,
      color: e.type === 'inspection' ? 'var(--primary)' : e.type === 'rdv-client' ? '#630210' : e.type === 'livraison-materiaux' ? 'var(--accent-text)' : 'var(--success)',
    })) : CALENDAR_EVENTS;
  }, [events]);

  const HISTORY_LIVE = useMemo(() => {
    if (chantierHistory.length > 0) return chantierHistory.map(h => ({
      date: h.date, heure: h.heure, auteur: h.auteur, role: h.role, action: h.action,
      icon: h.action.includes('photo') ? Camera : h.action.includes('décaiss') ? Banknote : h.action.includes('validée') ? CheckCircle2 : HardHat,
    }));
    // Base vide : aucun historique fictif.
    return [] as { date: string; heure: string; auteur: string; role: string; action: string; icon: typeof Camera }[];
  }, [chantierHistory]);

  const statut = chantierInfo.statut;
  const etapeIndex = rangEtape(chantierInfo.etapeActuelle);
  const [photoOuverte, setPhotoOuverte] = useState<{ url: string | null; label: string; tranche: string; date: string } | null>(null);
  // Registre unique (src/app/lib/statuts.ts) plutôt qu'une chaîne de ternaires :
  // celle-ci retombait sur « Non démarré » pour tout statut non prévu, donc un
  // chantier suspendu s'affichait comme jamais commencé.
  const { label: statutLabel, variant: statutVariant } = STATUT_CHANTIER[statut];

  const tranchesDone = TRANCHES_LIVE.filter(t => t.etat === 'terminee').length;
  const totalDec = DISBURSEMENTS.filter(d => d.etat === 'payee').length;
  const totalDecMontant = clientData.disbursements.find(d => d.status === 'Effectué')?.montant ?? '—';

  // Le chantier vient de l'API : ni écran blanc pendant le chargement, ni échec
  // silencieux si le serveur ne répond pas.
  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: '50vh', fontFamily: 'var(--font-sans)' }}>
        <div className="cpi-skeleton" style={{ width: 220, height: 14, borderRadius: 'var(--r-full)' }} />
        <div className="cpi-skeleton" style={{ width: 160, height: 14, borderRadius: 'var(--r-full)' }} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Chargement de votre chantier…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: '50vh', padding: 24, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <AlertCircle size={22} style={{ color: 'var(--destructive)' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 800, color: 'var(--foreground)' }}>
          Impossible d'afficher votre chantier
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0, maxWidth: 420, lineHeight: 1.6 }}>{error}</p>
        <button onClick={retry} style={{ padding: '10px 22px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-sans)', maxWidth: '960px' }}>

      {/* ═══ 1. HERO ═══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden',
        // Dégradé de repli sous la photo (voir lib/images.ts) : sans lui, un
        // Unsplash injoignable laissait un bandeau transparent, texte blanc
        // compris.
        backgroundImage: fondPhoto(HERO_PHOTO), backgroundSize: 'cover', backgroundPosition: 'center',
        minHeight: '280px',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, rgba(28,8,16,0.96) 0%, rgba(56,8,15,0.88) 45%, rgba(99,2,16,0.6) 100%)' }} />

        {/* Decorative arc */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(200,146,26,0.06)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '32px 36px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', justifyContent: 'space-between' }}>

            {/* Left: Project info */}
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                  Mon chantier · CPI
                </span>
                <Badge variant={statutVariant}>{statutLabel}</Badge>
              </div>

              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '8px' }}>
                {chantierInfo.projet}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <MapPin size={13} style={{ color: 'rgba(255,255,255,0.45)' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)' }}>
                  {chantierInfo.localisation} · Réf. {chantierInfo.reference}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
                <Building2 size={13} style={{ color: 'rgba(255,255,255,0.45)' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)' }}>
                  {chantierInfo.entreprise} · {chantierInfo.etapeActuelle}
                </span>
              </div>

              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avancement global
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-on-dark)' }}>
                    {heroProgress}%
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${heroProgress}%`,
                    background: 'linear-gradient(90deg, var(--accent), #FFC65A)',
                    borderRadius: 'var(--r-full)', transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                  }} />
                </div>
              </div>
            </div>

            {/* Right: Info chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', minWidth: '220px' }}>
              {[
                { icon: Calendar,  label: 'Démarrage',          value: chantierInfo.dateDebut     },
                { icon: Calendar,  label: 'Livraison estimée',  value: chantierInfo.dateLivraison  },
                { icon: HardHat,   label: 'Chef de chantier',   value: chantierInfo.chefChantier   },
                { icon: Building2, label: 'Entreprise',         value: chantierInfo.entreprise     },
              ].map(info => (
                <div key={info.label} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 14px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--r-sm)',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                >
                  <info.icon size={13} style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'rgba(255,255,255,0.45)', flex: 1 }}>{info.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{info.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom stat bar */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '0 36px',
        }}>
          {[
            { label: 'Dernière MAJ', value: chantierInfo.derniereMAJ },
            { label: 'Tranches terminées', value: `${tranchesDone} / 4` },
            { label: 'Photos publiées', value: `${photoCount}` },
            { label: 'Décaissé', value: `${totalDecMontant} FCFA` },
          ].map((s, i, arr) => (
            <div key={s.label} style={{
              padding: '14px 0',
              borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              paddingRight: i < arr.length - 1 ? '20px' : '0',
              paddingLeft: i > 0 ? '20px' : '0',
            }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 2. KPI ROW ════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
        {[
          { icon: TrendingUp,   label: 'Progression',          value: `${heroProgress}%`,        color: 'var(--primary)',   bg: 'var(--secondary)'              },
          { icon: Camera,       label: 'Photos publiées',       value: `${photoCount}`,            color: '#630210',         bg: 'rgba(99,2,16,0.08)'          },
          { icon: CheckCircle2, label: 'Étapes terminées',      value: `${tranchesDone}`,          color: 'var(--success)',  bg: 'rgba(26,107,68,0.08)'          },
          { icon: Clock,        label: 'Étapes restantes',      value: `${4 - tranchesDone}`,      color: 'var(--accent-text)',   bg: 'rgba(200,146,26,0.08)'         },
          { icon: Banknote,     label: 'Décaissements réalisés',value: `${totalDec}`,              color: 'var(--success)',  bg: 'rgba(26,107,68,0.08)'          },
          { icon: CalendarDays, label: 'Livraison estimée',     value: chantierInfo.dateLivraison, color: 'var(--primary)',   bg: 'var(--secondary)'              },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: kpi.bg,
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: '8px',
            transition: 'box-shadow 0.15s, transform 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <kpi.icon size={15} style={{ color: kpi.color }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ 3. PHASES TIMELINE ════════════════════════════════════════════════ */}
      <Card>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <SectionHeader icon={BarChart3} title="Phases de construction" sub={etapeIndex >= 0 ? `Étape en cours : ${chantierInfo.etapeActuelle}` : "Le chantier n'a pas encore démarré."} />
        </div>
        <div style={{ padding: '20px 24px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: '0', minWidth: '560px', position: 'relative' }}>
            {/* Connector line */}
            <div style={{ position: 'absolute', top: '20px', left: '24px', right: '24px', height: '2px', background: 'var(--border)', zIndex: 0 }} />

            {PHASES.map((phase, i) => {
              const Icon = phase.icon;
              // Étape courante déduite de l'API, phases précédentes terminées.
              const done = etapeIndex >= 0 && i < etapeIndex;
              const active = i === etapeIndex;
              return (
                <div key={phase.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1 }}>
                  {/* Icon circle */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--card)',
                    border: `2px solid ${done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--border)'}`,
                    boxShadow: active ? '0 0 0 4px rgba(99,2,16,0.12)' : 'none',
                    transition: 'all 0.2s',
                  }}>
                    {done
                      ? <CheckCircle2 size={18} style={{ color: '#fff' }} />
                      : <Icon size={16} style={{ color: active ? '#fff' : 'var(--muted-foreground)' }} />
                    }
                  </div>

                  {/* Label */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: done || active ? 700 : 500,
                      color: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--muted-foreground)',
                      marginBottom: '2px', whiteSpace: 'nowrap',
                    }}>{phase.label}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                      {done ? 'Terminée' : active ? 'En cours' : 'À venir'}
                    </div>
                    {active && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{
                          background: 'rgba(99,2,16,0.1)', color: 'var(--primary)',
                          fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700,
                          padding: '2px 6px', borderRadius: 'var(--r-full)',
                        }}>{chantierInfo.progression}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ═══ 4. TRANCHES ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={Layers} title="Tranches de travaux" sub="Avancement et décaissements par tranche"
          action={
            <Badge variant="default">4 tranches · {TRANCHES_LIVE.filter(t => t.etat === 'terminee').length} terminées</Badge>
          }
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TRANCHES_LIVE.map(t => <TrancheCard key={t.id} t={t} onVoirPhotos={id => { setGalleryTab('photos'); setGalleryFilter(id.replace(/^t/, 'T')); }} />)}
        </div>
      </div>

      {/* ═══ 5. GALLERY ═══════════════════════════════════════════════════════ */}
      <div id="chantier-galerie">
        <SectionHeader icon={Camera} title="Galerie du chantier" sub={`${photoCount} photos · Plans · Documents`}
          // « Tout télécharger » n'avait aucun gestionnaire : le bouton
          // paraissait actif et ne faisait rien. Il n'existe pas d'archive
          // côté API ; on ouvre donc chaque photo dans un onglet, ce que le
          // navigateur sait enregistrer, et le bouton disparaît s'il n'y a
          // rien à télécharger.
          action={photoCount > 0 ? (
            <button
              type="button"
              onClick={() => rawGallery.forEach(g => { if (g.url) window.open(g.url, '_blank', 'noopener'); })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', background: 'transparent',
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--foreground)', cursor: 'pointer',
              }}>
              <Download size={13} aria-hidden="true" />
              Ouvrir toutes les photos
            </button>
          ) : undefined}
        />

        {/* Tab + filter row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'photos', label: 'Photos', icon: Image, count: photoCount },
              { id: 'plans', label: 'Plans', icon: Layers, count: 0 },
              { id: 'documents', label: 'Documents', icon: FileText, count: 0 },
              { id: 'drone', label: 'Drone', icon: Video, count: 0 },
            ].map(tab => {
              const active = galleryTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setGalleryTab(tab.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: active ? 700 : 400,
                  color: active ? 'var(--primary)' : 'var(--muted-foreground)', marginBottom: '-1px',
                  transition: 'color 0.15s',
                }}>
                  <tab.icon size={13} />
                  {tab.label}
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700,
                    background: active ? 'var(--secondary)' : 'var(--input-background)',
                    color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                    padding: '1px 6px', borderRadius: 'var(--r-full)',
                  }}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          {galleryTab === 'photos' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {galleryFiltres.map(f => (
                <button key={f.id} onClick={() => setGalleryFilter(f.id)} style={{
                  padding: '5px 12px', borderRadius: 'var(--r-sm)',
                  border: `1px solid ${galleryFilter === f.id ? 'var(--primary)' : 'var(--border)'}`,
                  background: galleryFilter === f.id ? 'var(--secondary)' : 'transparent',
                  fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600,
                  color: galleryFilter === f.id ? 'var(--primary)' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                }}>{f.label}</button>
              ))}
            </div>
          )}
        </div>

        {galleryTab === 'photos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
            {galleryItems.map((item, i) => (
              // Vignette cliquable : c'était un `<div>` qui grossissait au
              // survol et affichait une icône « œil », sans aucun `onClick`.
              // Elle promettait un agrandissement qui n'existait pas.
              <button
                key={i}
                type="button"
                onClick={() => setPhotoOuverte(item)}
                aria-label={`Agrandir la photo « ${item.label} » — ${item.tranche}${item.date ? `, ${item.date}` : ''}`}
                style={{
                  display: 'block', width: '100%', padding: 0, border: 'none', font: 'inherit',
                  aspectRatio: '4/3', borderRadius: 'var(--r-sm)', overflow: 'hidden',
                  background: item.bg, position: 'relative', cursor: 'pointer',
                  transition: 'transform 0.18s, box-shadow 0.18s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(0,0,0,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                {item.url ? (
                  <img
                    src={item.url}
                    alt={`${item.label} — chantier, ${item.tranche}${item.date ? `, ${item.date}` : ''}`}
                    loading="lazy"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={24} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.25)' }} />
                  </span>
                )}
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', transition: 'background 0.18s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                >
                  <Eye size={20} aria-hidden="true" style={{ color: 'rgba(255,255,255,0)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0)')} />
                </span>
                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'block', padding: '8px 10px', textAlign: 'left', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: '#fff' }}>{item.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 'var(--r-xs)' }}>{item.tranche}</span>
                    {item.date && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', color: 'rgba(255,255,255,0.5)' }}>{item.date}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {galleryTab !== 'photos' && (
          <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--r-md)', background: 'var(--input-background)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
              Aucun contenu disponible pour cet onglet pour le moment.
            </div>
          </div>
        )}
      </div>

      {/* ═══ 6. PUBLICATIONS + DÉCAISSEMENTS ═══════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

        {/* Publications / Feed */}
        <div>
          <SectionHeader icon={Bell} title="Journal de chantier" sub="Actualités et événements publiés"
            action={
              <button onClick={() => setFeedExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600 }}>
                {feedExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {feedExpanded ? 'Réduire' : 'Voir tout'}
              </button>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(feedExpanded ? FEED_LIVE : FEED_LIVE.slice(0, 1)).map(group => (
              <Card key={group.date}>
                <div style={{ padding: '10px 16px', background: 'var(--input-background)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                    {group.date}
                  </div>
                </div>
                {group.entries.map((entry, ei) => {
                  const Icon = entry.icon;
                  const typeColor = (entry as { type?: string }).type === 'photo' ? '#630210' : (entry as { type?: string }).type === 'finance' ? 'var(--success)' : (entry as { type?: string }).type === 'validation' ? 'var(--success)' : 'var(--primary)';
                  return (
                    <div key={ei} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '13px 16px',
                      borderBottom: ei < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.12s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--input-background)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: '30px', height: '30px', borderRadius: 'var(--r-sm)', flexShrink: 0, background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={14} style={{ color: typeColor }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: 1.55, flex: 1 }}>{entry.text}</span>
                      <ArrowRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0, marginTop: '3px' }} />
                    </div>
                  );
                })}
              </Card>
            ))}
          </div>
        </div>

        {/* Décaissements */}
        <div>
          <SectionHeader icon={Banknote} title="Décaissements" sub="Versements bancaires par tranche" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DISBURSEMENTS.map((d, i) => {
              const done = d.etat === 'payee';
              const waiting = d.etat === 'attente';
              return (
                <Card key={i}>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Status indicator */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                      background: done ? 'rgba(26,107,68,0.1)' : waiting ? 'rgba(200,146,26,0.1)' : 'var(--input-background)',
                      border: `2px solid ${done ? 'var(--success)' : waiting ? 'var(--accent)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {done
                        ? <CheckCircle2 size={17} style={{ color: 'var(--success)' }} />
                        : waiting
                        ? <Clock size={16} style={{ color: 'var(--accent-text)' }} />
                        : <Clock size={16} style={{ color: 'var(--muted-foreground)' }} />
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>{d.tranche}</span>
                        <Badge variant={done ? 'success' : waiting ? 'warning' : 'muted'}>
                          {done ? 'Payée' : waiting ? 'En attente' : 'À venir'}
                        </Badge>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, color: done ? 'var(--success)' : 'var(--foreground)' }}>{d.montant}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{d.pct} · {d.date}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ 7. CALENDRIER ════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={CalendarDays} title="Calendrier" sub="Prochains événements et échéances" />
        <Card>
          <div style={{ padding: '8px 0' }}>
            {CALENDAR_LIVE.map((evt, i) => {
              const typeIcon = evt.type === 'inspection' ? CheckCircle2 : evt.type === 'livraison-materiaux' ? HardHat : evt.type === 'fin-etape' ? Star : CalendarDays;
              const TypeIcon = typeIcon;
              const statutBadge = evt.statut === 'confirme' ? 'success' : evt.statut === 'realise' ? 'success' : evt.statut === 'reporte' ? 'warning' : 'default';
              return (
                <div key={evt.id} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '13px 20px',
                  borderBottom: i < CALENDAR_LIVE.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--input-background)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', flexShrink: 0, background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TypeIcon size={15} style={{ color: (evt as { color: string }).color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '2px' }}>{evt.titre}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} /> {evt.date}
                    </div>
                  </div>
                  <Badge variant={statutBadge}>
                    {evt.statut === 'confirme' ? 'Confirmé' : evt.statut === 'realise' ? 'Réalisé' : evt.statut === 'reporte' ? 'Reporté' : 'Prévu'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ═══ 8. HISTORIQUE ════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={Clock} title="Historique" sub="Chronologie complète du chantier"
          action={
            <button onClick={() => setHistoryExpanded(v => !v)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--muted-foreground)', cursor: 'pointer',
            }}>
              {historyExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {historyExpanded ? 'Réduire' : 'Voir tout'}
            </button>
          }
        />
        <Card>
          <div style={{ padding: '8px 24px' }}>
            {(historyExpanded ? HISTORY_LIVE : HISTORY_LIVE.slice(0, 5)).map((entry, i, arr) => {
              const Icon = (entry as { icon: typeof Camera }).icon;
              return (
                <div key={i} style={{ display: 'flex', gap: '14px', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {/* Timeline dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: 'var(--r-sm)',
                      background: 'var(--secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={13} style={{ color: 'var(--primary)' }} />
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ width: '1px', flex: 1, background: 'var(--border)', margin: '4px 0', minHeight: '16px' }} />
                    )}
                  </div>

                  <div style={{ flex: 1, paddingBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: 1.5, flex: 1 }}>
                        {entry.action}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {entry.heure}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={9} style={{ color: '#fff' }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        {entry.auteur} · <span style={{ fontStyle: 'italic' }}>{entry.role}</span>
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginLeft: 'auto' }}>{entry.date}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ═══ 9. INTERVENANTS ══════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={User} title="Équipe du chantier" sub="Vos interlocuteurs directs" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {TEAM.map(member => (
            <Card key={member.nom} style={{ transition: 'box-shadow 0.15s, transform 0.15s' }}>
              <div style={{ padding: '18px' }}
                onMouseEnter={e => { (e.currentTarget.parentElement as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; (e.currentTarget.parentElement as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget.parentElement as HTMLElement).style.boxShadow = 'none'; (e.currentTarget.parentElement as HTMLElement).style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, background: member.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, color: '#fff' }}>
                    {member.initials}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>{member.nom}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '1px' }}>{member.role}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <a href={`tel:${member.tel}`} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', textDecoration: 'none', transition: 'color 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}>
                    <Phone size={12} style={{ flexShrink: 0 }} /> {member.tel}
                  </a>
                  <a href={`mailto:${member.email}`} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, transition: 'opacity 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    <Mail size={12} style={{ flexShrink: 0 }} /> {member.email}
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ═══ 10. ACTIONS ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={ArrowUpRight} title="Actions rapides" sub="Téléchargements, rendez-vous et demandes" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {[
            { icon: Download,      label: 'Télécharger le rapport',  primary: true  },
            { icon: CalendarDays,  label: 'Prendre rendez-vous',      primary: false },
            { icon: MessageSquare, label: 'Contacter le chef projet',  primary: false, onClick: () => navigate('support') },
            { icon: Eye,           label: 'Demander une visite',       primary: false },
            { icon: FileText,      label: 'Télécharger les plans',     primary: false },
            { icon: Camera,        label: 'Télécharger les photos',    primary: false },
            { icon: ArrowUpRight,  label: "Partager l'avancement",     primary: false },
          ].map(action => (
            <button key={action.label} onClick={'onClick' in action ? action.onClick : undefined} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '13px 16px', borderRadius: 'var(--r-md)',
              background: action.primary ? 'var(--primary)' : 'var(--card)',
              border: `1px solid ${action.primary ? 'var(--primary)' : 'var(--border)'}`,
              fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600,
              color: action.primary ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'all var(--dur-1) var(--ease-out)',
            }}
              onMouseEnter={e => {
                if (action.primary) { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }
                else { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; }
              }}
              onMouseLeave={e => {
                if (action.primary) { (e.currentTarget as HTMLElement).style.opacity = '1'; }
                else { (e.currentTarget as HTMLElement).style.background = 'var(--card)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }
              }}
            >
              <action.icon size={16} style={{ flexShrink: 0 }} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {photoOuverte && (
        <Modal
          open
          onClose={() => setPhotoOuverte(null)}
          titre={`Photo du chantier — ${photoOuverte.label}`}
          largeur={880}
          style={{ padding: 0, background: 'var(--foreground)' }}
        >
          <figure style={{ margin: 0 }}>
            {photoOuverte.url ? (
              <img
                src={photoOuverte.url}
                alt={`${photoOuverte.label} — chantier, ${photoOuverte.tranche}${photoOuverte.date ? `, ${photoOuverte.date}` : ''}`}
                style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '76vh', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--background)' }}>
                Cette photo n'est plus disponible.
              </div>
            )}
            <figcaption style={{ padding: '14px 20px', background: 'var(--card)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)' }}>
              <strong>{photoOuverte.label}</strong>
              <span style={{ color: 'var(--muted-foreground)' }}>
                {' · '}{photoOuverte.tranche}{photoOuverte.date ? ` · ${photoOuverte.date}` : ''}
              </span>
            </figcaption>
          </figure>
        </Modal>
      )}

    </div>
  );
}
