import {
  Banknote, Calendar, CheckCircle2, CreditCard, Clock,
  AlertTriangle, FileUp, ClipboardList, FolderOpen,
  Phone, Bell, CheckCircle, FileText, MessageSquare,
  ArrowUpRight, TrendingUp, ChevronRight, Sparkles,
  MapPin, User, UserPlus, Calculator, CircleDot, Image as ImageIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '../App';
import type { ActivityType } from '../data/activityLog';
import { useClientData } from '../data/useClientData';
import { useDocState } from '../data/docStateContext';
import { useDossierJourney } from '../data/dossierJourney';
import { useNavigate } from '../contexts/NavigationContext';
import {
  KPICard, SmartCard, CardHeader, CardDivider,
  ActionRow, TimelineItem, SectionHeader, StatusBadge,
  InlineAlert, ProgressBar, EmptyState, useCountUp, Btn, DS,
} from './ui';

interface Props { user: AuthUser; }

// Maps the client's real activity history (useClientData().historique) to an icon + tone
// Le journal serveur porte deux familles de plus que l'ancien journal local
// (« compte » et « banque ») : la table doit les couvrir, sans quoi ces entrées
// s'afficheraient sans icône.
const HISTO_ICON: Record<ActivityType, LucideIcon> = {
  validation: CheckCircle,
  document: FileText,
  notification: Bell,
  photo: ImageIcon,
  decaissement: Banknote,
  commentaire: MessageSquare,
  depot: FileUp,
  refus: AlertTriangle,
  compte: UserPlus,
  banque: CreditCard,
};
const HISTO_TONE: Record<ActivityType, string> = {
  validation: 'success', document: 'primary', notification: 'accent',
  photo: 'primary', decaissement: 'success', commentaire: 'muted',
  depot: 'primary', refus: 'danger',
  compte: 'primary', banque: 'accent',
};

const TONE: Record<string, string> = {
  success: 'var(--success)', primary: 'var(--primary)',
  accent: 'var(--accent)', muted: 'var(--muted-foreground)',
  danger: 'var(--destructive)',
};
const TONE_BG: Record<string, string> = {
  success: 'rgba(26,107,68,0.1)', primary: 'rgba(99,2,16,0.08)',
  accent: 'rgba(200,146,26,0.1)', muted: 'var(--muted)',
  danger: 'rgba(192,57,43,0.1)',
};

const fmt  = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' FCFA';
const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');

export default function ClientDashboardHome({ user }: Props) {
  const client = useClientData();
  const { navigate } = useNavigate();

  const firstName = user.name.split(' ')[0];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1);

  const { montantFinance, echeanceMensuelle, moisPayes, montantPaye, moisRestants, dureeTotal } = client.finance;

  // État live des pièces + activité (même source que « Mon dossier ») pour une cohérence totale.
  const { requisDocs, history } = useDocState();
  const recentActivities = history.slice(0, 5);
  const unreadCount = history.filter(h => h.type === 'notification').length;
  const issueDoc  = requisDocs.find(d => d.status === 'refuse' || d.status === 'a-remplacer');
  const validDocs = requisDocs.filter(d => d.status === 'accepte').length;
  const totalDocs = requisDocs.length;
  // Une pièce refusée ou à remplacer produit un avertissement. Le niveau
  // « danger » était déclaré mais jamais atteint : les branches associées
  // étaient mortes, on s'en tient donc aux deux états réellement possibles.
  const alerteBadge: 'none' | 'warning' = issueDoc ? 'warning' : 'none';

  // Parcours du dossier (6 étapes) — étape active dérivée de l'état réel.
  const { activeStep, nextEtape, steps, submitted, reachedSignature } = useDossierJourney();
  const journey = steps.map((s, i) => ({
    id: i + 1, label: s.label, sub: s.sub,
    done: i < activeStep, active: i === activeStep,
  }));
  const dossierPct = Math.round((activeStep / (steps.length - 1)) * 100);

  // Conseiller — un nouveau client n'en a pas encore ; le genre est déduit de la civilité.
  const hasConseiller     = !!client.conseiller && client.conseiller !== 'Non assigné';
  const conseillerFeminin = /^\s*mme/i.test(client.conseiller ?? '');
  const conseillerTitre   = conseillerFeminin ? 'Votre conseillère' : 'Votre conseiller';
  const conseillerRole    = conseillerFeminin ? 'Conseillère CPI Immobilier' : 'Conseiller CPI Immobilier';

  // Option B : les indicateurs de remboursement ne s'affichent qu'une fois le dossier
  // arrivé à l'étape « Signature » (prêt réellement contractualisé). Avant, on montre
  // l'avancement du dossier.
  const hasFinancement = reachedSignature && montantFinance > 0;

  const animFinance  = useCountUp(montantFinance);
  const animEcheance = useCountUp(echeanceMensuelle, 1000);
  const animPaye     = useCountUp(moisPayes, 900);
  const animMontPaye = useCountUp(montantPaye, 1100);
  const animRestants = useCountUp(moisRestants, 950);
  const progression  = dureeTotal > 0 ? Math.round((moisPayes / dureeTotal) * 100) : 0;

  const endDate = new Date(Date.now() + moisRestants * 30 * 86400000)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const alertColor = alerteBadge === 'warning' ? 'var(--accent)' : 'var(--success)';
  const alertBg    = alerteBadge === 'warning' ? 'rgba(200,146,26,0.1)' : 'rgba(26,107,68,0.1)';

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--foreground)', width: '100%', padding: '0 0 64px' }}>
      <style>{`
        @media (max-width: 760px) {
          .cdh-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── GREETING HEADER ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '24px 0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--chart-4) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.0625rem',
            color: 'white', boxShadow: '0 4px 14px rgba(99,2,16,0.25)',
          }}>
            {user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
              Bonjour, {firstName} 👋
            </h1>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: '3px 0 0' }}>
              {todayCap}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Btn variant="ghost" size="sm" icon={<Bell size={15} />} onClick={() => navigate('notifications')}>
            {unreadCount > 0 && (
              <span style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: -6, right: -8, width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', border: '1.5px solid var(--card)' }} />
              </span>
            )}
          </Btn>
          <Btn variant="secondary" size="sm" icon={<User size={14} />} onClick={() => navigate('mon-profil')}>
            Mon profil
          </Btn>
        </div>
      </div>

      {/* ── HERO PROJECT BANNER ───────────────────────────────────────────────── */}
      <div style={{
        borderRadius: DS.radius.xl, marginBottom: 24, overflow: 'hidden',
        position: 'relative',
        background: 'var(--primary)',
        boxShadow: DS.shadow.xl,
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(200,146,26,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 120, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>

            {/* Left: project identity */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                  Étape {activeStep + 1}/{steps.length} · {steps[activeStep].label}
                </span>
                {!submitted
                  ? <StatusBadge variant="warning" dot>À déposer</StatusBadge>
                  : reachedSignature
                  ? <StatusBadge variant="success" dot>Finalisé</StatusBadge>
                  : issueDoc
                  ? <StatusBadge variant="danger" dot>Action requise</StatusBadge>
                  : <StatusBadge variant="success" dot>En cours</StatusBadge>}
              </div>

              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem,2vw,1.5rem)', fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                {client.projectNom}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)' }}>
                  <MapPin size={12} style={{ flexShrink: 0 }} /> {client.adresse.replace('(', '').replace(')', '')}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)' }}>
                  Prochaine étape : {nextEtape}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {[client.ref, client.conseiller, client.banque]
                  .filter(chip => chip && chip !== '—' && chip !== 'Non assigné')
                  .map(chip => (
                    <span key={chip} style={{
                      fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600,
                      color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      padding: '3px 10px', borderRadius: DS.radius.full,
                    }}>{chip}</span>
                  ))}
              </div>

              {/* Progression : remboursement si prêt accordé, sinon avancement du dossier */}
              <div style={{ maxWidth: 360 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.45)' }}>
                    {hasFinancement ? 'Remboursement prêt' : 'Avancement du dossier'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, color: 'var(--accent)' }}>
                    {hasFinancement ? progression : dossierPct}%{' '}
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}>
                      {hasFinancement ? `· fin ${endDate}` : `· ${steps[activeStep].label}`}
                    </span>
                  </span>
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.12)', borderRadius: DS.radius.full, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${hasFinancement ? progression : dossierPct}%`, background: 'linear-gradient(90deg, var(--accent) 0%, #FFC65A 100%)', borderRadius: DS.radius.full, transition: 'width 1.4s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>
            </div>

            {/* Right: acquisition journey steps + actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              {/* Journey steps mini */}
              <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: DS.radius.lg, minWidth: 220 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                  Parcours du dossier
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {journey.map((step, i) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: step.done ? 'var(--success)' : step.active ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                        border: `2px solid ${step.done ? 'var(--success)' : step.active ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: step.active ? '0 0 0 3px rgba(200,146,26,0.25)' : 'none',
                      }}>
                        {step.done && <CheckCircle2 size={11} style={{ color: '#fff' }} />}
                        {step.active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: step.active ? 700 : 500, color: step.done ? 'rgba(255,255,255,0.7)' : step.active ? '#FFC65A' : 'rgba(255,255,255,0.35)' }}>
                          {step.label}
                        </div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{step.sub}</div>
                      </div>
                      {i < journey.length - 1 && (
                        <div style={{ position: 'absolute', left: 9, width: 2, height: 6, background: 'rgba(255,255,255,0.12)', marginTop: 20 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => navigate('mon-dossier')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: DS.radius.md,
                    background: 'var(--accent)', border: '1px solid transparent',
                    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: '#fff',
                    cursor: 'pointer', transition: DS.transition.fast,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <FolderOpen size={13} /> Mon dossier <ArrowUpRight size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI GRID ──────────────────────────────────────────────────────────── */}
      {/* Prêt accordé → indicateurs de remboursement. Sinon → suivi du dossier. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12, marginBottom: 24 }}>
        {hasFinancement ? (
          <>
            <KPICard icon={<Banknote size={19} />} label="Montant financé"
              value={fmt(animFinance)} sub="Financement accordé"
              accentColor="var(--primary)" accentBg="rgba(99,2,16,0.08)" delay={0}
              onClick={() => navigate('ma-demande')} />
            <KPICard icon={<Calendar size={19} />} label="Échéance mensuelle"
              value={fmt(animEcheance)} sub="Prélèvement automatique"
              accentColor="var(--accent)" accentBg="rgba(200,146,26,0.10)"
              trend="neutral" trendLabel="À jour" delay={80} />
            <KPICard icon={<CheckCircle2 size={19} />} label="Mois payés"
              value={`${fmtN(animPaye)} / ${dureeTotal}`} sub={`Soit ${progression}% du prêt`}
              accentColor="var(--success)" accentBg="rgba(26,107,68,0.10)"
              trend="up" trendLabel={`+${fmtN(animPaye)}`} delay={160} />
            <KPICard icon={<CreditCard size={19} />} label="Montant remboursé"
              value={fmt(animMontPaye)} sub="Depuis le début du prêt"
              accentColor="var(--primary)" accentBg="rgba(99,2,16,0.08)" delay={240} />
            <KPICard icon={<Clock size={19} />} label="Mois restants"
              value={`${fmtN(animRestants)} mois`} sub={`Fin : ${endDate}`}
              accentColor="var(--muted-foreground)" accentBg="var(--muted)" delay={320} />
            <KPICard icon={<AlertTriangle size={19} />} label="Alertes"
              value={alerteBadge === 'none' ? 'Aucune alerte' : '1 alerte'}
              sub={alerteBadge === 'none' ? 'Statut en temps réel' : 'Action requise'}
              accentColor={alertColor} accentBg={alertBg} delay={400} />
          </>
        ) : (
          <>
            <KPICard icon={<CircleDot size={19} />} label="Étape actuelle"
              value={steps[activeStep].label} sub={steps[activeStep].sub}
              accentColor="var(--primary)" accentBg="rgba(99,2,16,0.08)" delay={0}
              onClick={() => navigate('mon-dossier')} />
            <KPICard icon={<CheckCircle2 size={19} />} label="Pièces validées"
              value={`${validDocs} / ${totalDocs}`}
              sub={submitted ? 'Vérifiées par le CPI' : 'À déposer'}
              accentColor="var(--success)" accentBg="rgba(26,107,68,0.10)" delay={80}
              onClick={() => navigate('mon-dossier')} />
            <KPICard icon={<Clock size={19} />} label="Prochaine étape"
              value={nextEtape} sub="Suivi par votre conseiller"
              accentColor="var(--accent)" accentBg="rgba(200,146,26,0.10)" delay={160} />
            <KPICard icon={<AlertTriangle size={19} />} label="Alertes"
              value={alerteBadge === 'none' ? 'Aucune alerte' : '1 alerte'}
              sub={alerteBadge === 'none' ? 'Statut en temps réel' : 'Action requise'}
              accentColor={alertColor} accentBg={alertBg} delay={240} />
          </>
        )}
      </div>

      {/* ── INLINE ALERT ──────────────────────────────────────────────────────── */}
      {alerteBadge !== 'none' && (
        <div style={{ marginBottom: 20 }}>
          <InlineAlert type="warning">
            Action requise : un document a été refusé. Veuillez le remplacer dès que possible.
          </InlineAlert>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div className="cdh-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', gap: 16, alignItems: 'start' }}>

        {/* Quick actions */}
        <SmartCard padding="0">
          <div style={{ padding: '18px 20px 14px' }}>
            <CardHeader icon={<Sparkles size={16} />} title="Actions rapides" subtitle="Vos raccourcis du jour" />
          </div>
          <CardDivider />
          <div style={{ padding: '8px 8px 12px' }}>
            <ActionRow icon={<FileUp size={16} />} label="Transmettre un document"
              description="Déposer ou remplacer un fichier" variant="primary"
              iconBg="var(--secondary)" onClick={() => navigate('mon-dossier')} />
            <ActionRow icon={<ClipboardList size={16} />} label="Consulter ma demande"
              description="Voir l'état de votre dossier" onClick={() => navigate('ma-demande')} />
            <ActionRow icon={<FolderOpen size={16} />} label="Ouvrir mon dossier"
              description="Documents et pièces justificatives" onClick={() => navigate('mon-dossier')} />
            <ActionRow icon={<Calculator size={16} />} label="Simuler mon prêt"
              description="Tableau d'amortissement complet" onClick={() => navigate('simulateur')} />
            <ActionRow icon={<Phone size={16} />} label="Contacter mon conseiller"
              description={hasConseiller ? `${client.conseiller} — CPI Immobilier` : 'Support CPI Immobilier'} onClick={() => navigate('support')} />
          </div>
          <CardDivider />
          <div style={{ padding: '12px 20px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 10 }}>
              {hasFinancement ? 'Avancement du remboursement' : 'Avancement du dossier'}
            </div>
            <ProgressBar value={hasFinancement ? progression : dossierPct} color="var(--primary)" showLabel />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
              {hasFinancement ? (
                <>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Démarré · {client.dateOuverture}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Fin · {endDate}</span>
                </>
              ) : (
                <>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Étape · {steps[activeStep].label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Suivante · {nextEtape}</span>
                </>
              )}
            </div>
          </div>
        </SmartCard>

        {/* Activity feed */}
        <SmartCard padding="0">
          <div style={{ padding: '18px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardHeader icon={<TrendingUp size={16} />} iconBg="rgba(200,146,26,0.10)" iconColor="var(--accent)" title="Dernières activités" />
            <StatusBadge variant="muted" size="sm">{recentActivities.length} récente{recentActivities.length > 1 ? 's' : ''}</StatusBadge>
          </div>
          <CardDivider />
          <div style={{ padding: '20px 22px' }}>
            {recentActivities.length === 0 ? (
              <EmptyState type="empty" title="Aucune activité récente" sub="Les actions sur votre dossier apparaîtront ici." />
            ) : (
              recentActivities.map((item, i) => {
                const Icon = HISTO_ICON[item.type] ?? FileText;
                const tone = HISTO_TONE[item.type] ?? 'muted';
                return (
                  <TimelineItem key={item.id}
                    icon={<Icon size={14} />}
                    iconColor={TONE[tone]} iconBg={TONE_BG[tone]}
                    title={item.action} date={item.date} time={item.heure}
                    last={i === recentActivities.length - 1} delay={200 + i * 80} />
                );
              })
            )}
          </div>
          <CardDivider />
          <div style={{ padding: '14px 22px' }}>
            <button onClick={() => navigate('notifications')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', padding: 0, transition: 'gap 0.18s' }}
              onMouseEnter={e => (e.currentTarget.style.gap = '10px')}
              onMouseLeave={e => (e.currentTarget.style.gap = '6px')}>
              Voir tout l'historique <ArrowUpRight size={14} />
            </button>
          </div>
        </SmartCard>
      </div>

      {/* ── BOTTOM: ACQUISITION PARCOURS + NEXT STEP + CONSEILLER ──────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>

        {/* Acquisition journey detailed */}
        <SmartCard padding="20px 24px">
          <SectionHeader
            icon={<CircleDot size={16} />}
            title="Parcours du dossier"
            subtitle={`Étape ${activeStep + 1} sur ${steps.length} — ${steps[activeStep].label}`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {journey.map((step, i) => (
              <div key={step.id} style={{ display: 'flex', gap: 12, paddingBottom: i < journey.length - 1 ? 14 : 0 }}>
                {/* Connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: step.done ? 'var(--success)' : step.active ? 'var(--accent)' : 'var(--secondary)',
                    border: `2px solid ${step.done ? 'var(--success)' : step.active ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: step.active ? '0 0 0 4px rgba(200,146,26,0.12)' : 'none',
                  }}>
                    {step.done
                      ? <CheckCircle2 size={14} style={{ color: '#fff' }} />
                      : step.active
                      ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                      : <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border)' }} />
                    }
                  </div>
                  {i < journey.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: step.done ? 'rgba(26,107,68,0.2)' : 'var(--border)', marginTop: 4 }} />
                  )}
                </div>
                {/* Content */}
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: step.active ? 700 : 600, color: step.done ? 'var(--success)' : step.active ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                    {step.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{step.sub}</div>
                  {step.active && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '3px 8px', borderRadius: 'var(--r-xs)', background: 'rgba(200,146,26,0.1)', border: '1px solid rgba(200,146,26,0.2)' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)' }}>Étape en cours</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SmartCard>

        {/* Next step */}
        <SmartCard hover onClick={() => navigate('mon-dossier')} padding="20px 24px">
          <SectionHeader icon={<FileText size={16} />} title="Prochaine étape" subtitle="Action recommandée"
            action={<ChevronRight size={15} style={{ color: 'var(--muted-foreground)' }} />} />
          <div style={{ padding: '12px 16px', background: 'var(--secondary)', borderRadius: DS.radius.lg, marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
              {issueDoc
                ? `${issueDoc.label} à remplacer`
                : !submitted
                ? 'Envoyer votre demande'
                : validDocs < totalDocs
                ? 'Compléter vos pièces'
                : `Étape suivante : ${nextEtape}`}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              {issueDoc
                ? (issueDoc.commentaire || 'Ce document a été refusé. Veuillez en déposer un nouveau pour poursuivre votre dossier.')
                : !submitted
                ? 'Complétez et envoyez votre demande dans « Ma demande » pour lancer l’étude de votre dossier.'
                : validDocs < totalDocs
                ? 'Certaines pièces ne sont pas encore validées. Déposez les documents manquants pour poursuivre.'
                : 'Vos pièces sont conformes. Votre conseiller CPI poursuit le traitement de votre dossier.'}
            </div>
          </div>
          <Btn variant="primary" size="sm" icon={<FileUp size={13} />} fullWidth onClick={() => navigate(!submitted ? 'ma-demande' : 'mon-dossier')}>
            {issueDoc ? 'Déposer le document' : !submitted ? 'Compléter ma demande' : validDocs < totalDocs ? 'Compléter mon dossier' : 'Voir mon dossier'}
          </Btn>
        </SmartCard>

        {/* Conseiller */}
        <SmartCard padding="20px 24px">
          <SectionHeader icon={<User size={16} />} title={hasConseiller ? conseillerTitre : 'Votre conseiller'} />
          {hasConseiller ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#fff', flexShrink: 0 }}>
                  {client.conseiller.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>{client.conseiller}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{conseillerRole}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" size="sm" icon={<Phone size={13} />} fullWidth onClick={() => navigate('support')}>Appeler</Btn>
                <Btn variant="outline" size="sm" icon={<MessageSquare size={13} />} fullWidth onClick={() => navigate('support')}>Message</Btn>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserPlus size={20} style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>En cours d’affectation</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Un conseiller CPI vous sera assigné après l’envoi de votre demande.</div>
                </div>
              </div>
              <Btn variant="outline" size="sm" icon={<MessageSquare size={13} />} fullWidth onClick={() => navigate('support')}>Contacter le support</Btn>
            </>
          )}
        </SmartCard>
      </div>

    </div>
  );
}
