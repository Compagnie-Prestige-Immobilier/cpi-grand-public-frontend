import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle2, XCircle,
  Clock, Banknote, Users, BarChart3, Download, Eye, MousePointerClick, Repeat, Activity, Percent, UserCheck, UserPlus, Timer, Gauge,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import type { AuthUser } from '../App';
import { useClientContext } from '../contexts/ClientContext';
import { useDocState } from '../data/docStateContext';
import { useCpiDocs } from '../data/cpiDocsContext';
import { computeJourneyStep, SIGNATURE_INDEX, DOCS_VALIDES_INDEX, TIMELINE_STEPS } from '../data/dossierJourney';
import { formatFCFA, parseFrDate } from '../lib/format';
import { staffApi } from '../api/endpoints';
import { SILENCIEUX } from '../api/client';

/** Clé de cache des totaux plateforme (GET /staff/stats/dashboard). */
const STATS_DASHBOARD_QUERY_KEY = ['staff', 'stats', 'dashboard'] as const;

interface Props { user: AuthUser }

// ─── Palette ───────────────────────────────────────────────────────────────
const C = {
  bordeaux: '#630210',
  bordeauxLight: '#F5ECEE',
  bordeauxMid: '#B05070',
  // Or vif : séries de graphiques uniquement (objet non textuel, seuil 3:1).
  gold: '#A87A15',
  // Or foncé : toute valeur textuelle (WCAG AA 4,5:1 sur fond clair).
  goldText: '#856011',
  goldLight: '#F0B840',
  green: '#1A6B44',
  greenLight: 'rgba(26,107,68,0.1)',
  purple: '#6D28D9',
  purpleLight: 'rgba(109,40,217,0.1)',
  muted: '#6B4A52',
  border: 'rgba(99,2,16,0.1)',
  bg: '#FAF7F7',
  text: '#1C0810',
};

// Aucune donnée illustrative : tous les jeux de données sont calculés en temps
// réel dans le composant à partir du portefeuille réel, ou affichés en état vide
// lorsqu'ils requièrent un historique/suivi non encore disponible.

const PERIODS = ['3 mois', '6 mois', '12 mois', 'Tout'];

// ─── Helper components ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, delta, positive, icon: Icon, color }: {
  label: string; value: string; sub: string; delta?: string; positive?: boolean;
  icon: LucideIcon; color: string;
}) {
  return (
    <div className="bg-white p-5" style={{ border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 flex items-center justify-center" style={{ background: `${color}14` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {delta && (
          <div className={`flex items-center gap-1 px-2 py-0.5 ${positive ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}
            style={{ fontSize: '0.6875rem', fontWeight: 700, background: positive ? C.greenLight : 'rgba(192,57,43,0.08)' }}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta}
          </div>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 800, color: C.text }}>{value}</div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text, marginTop: '2px' }}>{label}</div>
      <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: '2px' }}>{sub}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: C.text, marginBottom: '1.25rem' }}>
      {children}
    </h3>
  );
}

// État vide honnête pour les analyses qui nécessitent un historique ou un suivi
// (séries mensuelles, performance par agent…) non encore disponible à petite échelle.
function EmptyChart({ height = 200, label = 'Aucune donnée pour le moment' }: { height?: number; label?: string }) {
  return (
    <div style={{
      height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '6px', border: `1px dashed ${C.border}`, borderRadius: 'var(--r-md)', background: C.bg, padding: '0 24px', textAlign: 'center',
    }}>
      <BarChart3 style={{ width: 22, height: 22, color: C.border }} />
      <span style={{ fontSize: '0.8125rem', color: C.muted, maxWidth: '320px' }}>{label}</span>
    </div>
  );
}

// Tuile de métrique d'audience : valeur réelle (calculée) ou emplacement analytics
// « à connecter » (métrique nécessitant un outil de mesure d'audience / le backend).
function MetricTile({ label, value, hint, source, icon: Icon }: {
  label: string; value?: string; hint: string; source: 'real' | 'analytics';
  icon: LucideIcon;
}) {
  const isReal = source === 'real';
  return (
    <div className="p-3" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 'var(--r-sm)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="w-7 h-7 flex items-center justify-center" style={{ background: isReal ? C.greenLight : 'rgba(107,74,82,0.10)', borderRadius: 'var(--r-sm)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: isReal ? C.green : C.muted }} />
        </div>
        {!isReal && <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: C.muted, background: 'rgba(107,74,82,0.10)', padding: '2px 7px', borderRadius: 'var(--r-full)' }}>à connecter</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: isReal ? C.text : C.muted }}>{isReal ? (value ?? '—') : '—'}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: '0.625rem', color: C.muted, marginTop: 1 }}>{hint}</div>
    </div>
  );
}


const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 shadow-sm" style={{ border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)', fontSize: '0.8125rem' }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: '4px' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2" style={{ background: p.color }} />
          <span style={{ color: C.muted }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: C.text }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────
export default function StatisticsDashboard({ user }: Props) {
  const [period, setPeriod] = useState('6 mois');
  const [activeTab, setActiveTab] = useState<'volume' | 'financier' | 'agents' | 'entonnoir' | 'audience'>('volume');

  const isAdmin = user.role === 'admin';

  // ── Métriques RÉELLES du portefeuille (clients suivis) ─────────────────────
  const { allClients } = useClientContext();
  const { allDocsByClient, dossierEtapes, submittedByClient } = useDocState();
  const { allCpiDocsByClient } = useCpiDocs();

  const realRows = allClients.map(c => {
    const docs = allDocsByClient[c.id] ?? [];
    const submitted = submittedByClient[c.id] ?? false;
    const etape = dossierEtapes[c.id] ?? DOCS_VALIDES_INDEX;
    const activeStep = computeJourneyStep(submitted, docs, etape);
    const toSign = (allCpiDocsByClient[c.id] ?? []).filter(d => d.visibleClient && d.signatureRequise && d.status === 'a-signer').length;
    const aVerifier = docs.filter(d => d.status === 'depose' || d.status === 'verification').length;
    return { activeStep, toSign, aVerifier, submitted };
  });
  const rTotal      = realRows.length;
  const rFinalises  = realRows.filter(r => r.activeStep >= SIGNATURE_INDEX).length;
  const rEnCours    = realRows.filter(r => r.submitted && r.activeStep < SIGNATURE_INDEX).length;
  const rAVerifier  = realRows.reduce((n, r) => n + r.aVerifier, 0);
  const rASigner    = realRows.reduce((n, r) => n + r.toSign, 0);
  const rTaux       = rTotal ? Math.round((rFinalises / rTotal) * 100) : 0;

  // ── Jeux de données RÉELS pour les graphiques snapshot ─────────────────────
  const BY_STATUS = [
    { name: 'Dossier reçu',       value: realRows.filter(r => r.activeStep === 1).length,                                      color: C.bordeauxMid },
    { name: 'Documents valides',  value: realRows.filter(r => r.activeStep === DOCS_VALIDES_INDEX).length,                     color: C.gold },
    { name: 'Analyse / banque',   value: realRows.filter(r => r.activeStep > DOCS_VALIDES_INDEX && r.activeStep < SIGNATURE_INDEX).length, color: C.bordeaux },
    { name: 'Finalisés',          value: realRows.filter(r => r.activeStep >= SIGNATURE_INDEX).length,                         color: C.green },
  ].filter(s => s.value > 0);

  const BY_TYPE = [
    { name: 'En cours',  value: rEnCours,   color: C.gold     },
    { name: 'Finalisés', value: rFinalises, color: C.bordeaux },
  ].filter(s => s.value > 0);

  const BY_BIEN = realRows.length ? [
    { type: 'À vérifier',  count: realRows.filter(r => r.aVerifier > 0).length },
    { type: 'À signer',    count: realRows.filter(r => r.toSign > 0).length },
    { type: 'À jour',      count: realRows.filter(r => r.aVerifier === 0 && r.toSign === 0).length },
  ].filter(b => b.count > 0) : [];

  // Entonnoir réel du parcours : nombre de dossiers ayant atteint chaque étape.
  const FUNNEL_DATA = TIMELINE_STEPS.map((s, i) => ({
    name: s.label,
    value: realRows.filter(r => r.activeStep >= i).length,
    fill: i >= SIGNATURE_INDEX ? C.green : C.bordeaux,
  }));

  const hasData = rTotal > 0;

  // Répartition RÉELLE des dossiers par étape du parcours (remplace l'évolution
  // mensuelle qui nécessiterait un historique horodaté).
  const byStepData = TIMELINE_STEPS.map((s, i) => ({
    etape: s.label,
    dossiers: realRows.filter(r => r.activeStep === i).length,
  }));

  // Taux de conversion global réel : dossiers finalisés / dossiers déposés.
  const funnelFirst = FUNNEL_DATA[0]?.value ?? 0;
  const funnelLast = FUNNEL_DATA[FUNNEL_DATA.length - 1]?.value ?? 0;
  const conversionGlobal = funnelFirst > 0 ? Math.round((funnelLast / funnelFirst) * 100) : 0;

  // ── Totaux de la plateforme — GET /staff/stats/dashboard ───────────────────
  //
  // Ces deux valeurs étaient écrites en dur — `realAgentCount = 1` et
  // `totalMontant = 0` — dans un écran qui affirme par ailleurs n'afficher
  // « aucune donnée fictive ». « Agents actifs : 1 » et « Montant total
  // accordé : 0 M FCFA » se lisaient comme des mesures ; c'étaient des
  // littéraux. Le serveur les connaît : le bloc `admin` porte le décompte des
  // comptes professionnels et les montants réellement décaissés.
  //
  // Un agent CPI reçoit `admin: null` (la route exige `view-stats`) : les
  // tuiles concernées affichent alors « — », jamais un zéro qui se ferait
  // passer pour une mesure.
  const statsQuery = useQuery({
    queryKey: STATS_DASHBOARD_QUERY_KEY,
    queryFn: () => staffApi.stats.dashboard(),
    // L'écran a ses propres tuiles « — » : un toast d'erreur global par-dessus
    // n'apprendrait rien de plus à l'utilisateur.
    meta: SILENCIEUX,
  });
  const adminStats = statsQuery.data?.admin ?? null;

  /** Comptes « agent CPI » enregistrés. `null` si le serveur ne les expose pas. */
  const realAgentCount: number | null = adminStats?.utilisateurs.agents ?? null;

  /** Total décaissé, en FCFA : acquisition foncière + construction. */
  const totalMontant: number | null = adminStats
    ? adminStats.decaissements.montantTerrain + adminStats.decaissements.montantConstruction
    : null;

  /** Une valeur absente s'écrit « — », jamais « 0 ». */
  const ouTiret = (v: number | null, format: (n: number) => string) => (v === null ? '—' : format(v));

  // Séries temporelles / performance par agent : nécessitent un historique et un
  // suivi par agent non disponibles → laissées vides (état honnête).
  const MONTHLY: { mois: string; deposes: number; approuves: number; refuses: number; montant: number; delai: number }[] = [];
  const MONTHLY_AMOUNT: { mois: string; montant: number; cumulé: number }[] = [];
  const BY_AGENT: { nom: string; org: string; deposes: number; approuves: number; taux: number; delai: number }[] = [];
  void MONTHLY; void MONTHLY_AMOUNT; void BY_AGENT;

  // ── Audience & engagement (curation des métriques GA4) ─────────────────────
  //
  // La majorité de ces indicateurs (sessions, vues, taux de rebond, durée
  // d'engagement, utilisateurs actifs DAU/MAU, cohortes de rétention) se mesurent
  // par AGRÉGATION entre tous les visiteurs → ils nécessitent un outil de mesure
  // d'audience (Google Analytics 4) ou le backend, à connecter par vos techniciens.
  //
  // Contrat de données attendu (à brancher) :
  //   GET /api/admin/analytics?period=... → {
  //     activeUsers, newUsers, firstVisits,
  //     sessions, engagedSessions, engagementRate, avgEngagementSec,
  //     views, viewsPerSession, bounceRate, keyEvents,
  //     returningBuyers, dauOverMau
  //   }
  //
  // Ci-dessous, seules les métriques réellement dérivables du registre sont
  // calculées ; le reste reste « à connecter » (jamais de valeur fictive).

  const monthsBack = period === '3 mois' ? 3 : period === '6 mois' ? 6 : period === '12 mois' ? 12 : null;
  const _now = new Date();
  const _threshold = monthsBack ? new Date(_now.getFullYear(), _now.getMonth() - monthsBack, _now.getDate()) : null;
  const nouveauxUtilisateurs = _threshold
    ? allClients.filter(c => { const d = parseFrDate(c.dateInscription); return d ? d >= _threshold : false; }).length
    : allClients.length;
  const totalUtilisateurs = allClients.length;

  type AudienceMetric = { label: string; hint: string; source: 'real' | 'analytics'; value?: string; icon: LucideIcon };
  const audienceFamilies: { title: string; icon: LucideIcon; metrics: AudienceMetric[] }[] = [
    {
      title: 'Acquisition', icon: UserPlus, metrics: [
        { label: 'Nouveaux utilisateurs', hint: `Inscriptions · ${period.toLowerCase()}`, source: 'real', value: String(nouveauxUtilisateurs), icon: UserPlus },
        { label: 'Total utilisateurs', hint: 'Comptes clients enregistrés', source: 'real', value: String(totalUtilisateurs), icon: Users },
        { label: 'Utilisateurs actifs', hint: 'Actifs sur la période (DAU/MAU)', source: 'analytics', icon: UserCheck },
        { label: 'Premières visites', hint: 'Première venue sur la plateforme', source: 'analytics', icon: Eye },
      ],
    },
    {
      title: 'Engagement', icon: Activity, metrics: [
        { label: 'Sessions', hint: 'Visites sur la période', source: 'analytics', icon: Activity },
        { label: 'Sessions avec engagement', hint: '> 10 s ou action clé', source: 'analytics', icon: MousePointerClick },
        { label: "Taux d'engagement", hint: 'Sessions engagées / total', source: 'analytics', icon: Percent },
        { label: 'Durée moy. / session', hint: "Durée d'engagement moyenne", source: 'analytics', icon: Timer },
        { label: 'Vues', hint: 'Pages vues', source: 'analytics', icon: Eye },
        { label: 'Vues / session', hint: 'Profondeur de visite', source: 'analytics', icon: BarChart3 },
        { label: 'Taux de rebond', hint: 'Sessions sans engagement', source: 'analytics', icon: TrendingDown },
        { label: 'Événements clés', hint: 'Actions importantes déclenchées', source: 'analytics', icon: Gauge },
      ],
    },
    {
      title: 'Conversion & fidélité', icon: CheckCircle2, metrics: [
        { label: 'Acheteurs (finalisés)', hint: 'Dossiers arrivés à signature', source: 'real', value: String(rFinalises), icon: CheckCircle2 },
        { label: "Taux d'acheteurs", hint: 'Finalisés / portefeuille', source: 'real', value: `${rTaux}%`, icon: Percent },
        { label: 'Nouveaux acheteurs', hint: 'Finalisés sur la période', source: 'analytics', icon: UserPlus },
        { label: 'Acheteurs récurrents', hint: 'Rétention (cohortes)', source: 'analytics', icon: Repeat },
        { label: 'UAJ / UAM', hint: 'Ratio actifs jour / mois', source: 'analytics', icon: Users },
      ],
    },
  ];

  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div className="bg-white p-5" style={{ border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.goldText, marginBottom: '4px' }}>
              Rapports & Analyses
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: C.text }}>
              Tableau de bord statistique
            </h2>
            <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: '2px' }}>
              {isAdmin ? 'Plateforme CPI — Vue globale' : `Espace ${user.name} · CPI`} · <span style={{ fontStyle: 'italic' }}>Données en temps réel du portefeuille</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1" style={{ background: C.bordeauxLight }}>
              {PERIODS.map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 transition-colors"
                  style={{ fontSize: '0.75rem', fontWeight: 600, background: period === p ? C.bordeaux : 'transparent', color: period === p ? 'white' : C.bordeaux }}>
                  {p}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 px-4 py-2 transition-colors"
              style={{ border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)', color: C.muted, fontSize: '0.8125rem', fontWeight: 600 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bordeauxLight; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <Download className="w-3.5 h-3.5" /> Exporter
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards — portefeuille réel */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 cpi-stagger">
        <KpiCard label="Dossiers suivis" value={String(rTotal)} sub="Portefeuille actuel" icon={FileText} color={C.bordeaux} />
        <KpiCard label="Dossiers finalisés" value={String(rFinalises)} sub={`${rTaux}% du portefeuille`} icon={CheckCircle2} color={C.green} />
        <KpiCard label="En cours" value={String(rEnCours)} sub="Dossiers à traiter" icon={Clock} color={C.goldText} />
        <KpiCard label="Pièces à vérifier" value={String(rAVerifier)} sub="En attente de validation" icon={Banknote} color={C.bordeauxMid} />
        <KpiCard label="Documents à signer" value={String(rASigner)} sub="En attente du client" icon={XCircle} color="var(--destructive)" />
      </div>

      {/* Tab navigation */}
      <div className="bg-white" style={{ border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)' }}>
        <div className="flex border-b overflow-x-auto" style={{ borderColor: C.border }}>
          {([
            ['volume', 'Volume & Activité'],
            ['financier', 'Analyse financière'],
            ['agents', 'Performance agents'],
            ['entonnoir', 'Entonnoir de conversion'],
            ...(isAdmin ? [['audience', 'Audience & engagement']] as const : []),
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="px-5 py-3.5 whitespace-nowrap transition-colors flex-shrink-0"
              style={{
                fontSize: '0.875rem', fontWeight: activeTab === id ? 700 : 500,
                color: activeTab === id ? C.bordeaux : C.muted,
                borderBottom: activeTab === id ? `2px solid ${C.bordeaux}` : '2px solid transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── Tab: Volume ──────────────────────────────────────────────── */}
          {activeTab === 'volume' && (
            <div className="space-y-8">
              {/* Monthly bar + line */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <SectionTitle>Dossiers par étape du parcours</SectionTitle>
                  {hasData ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={byStepData} barSize={26}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,2,16,0.06)" vertical={false} />
                        <XAxis dataKey="etape" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,2,16,0.04)' }} />
                        <Bar dataKey="dossiers" name="Dossiers" fill={C.bordeaux} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart height={240} label="Aucun dossier dans le portefeuille pour le moment. La répartition apparaîtra dès les premières inscriptions." />
                  )}
                </div>

                <div>
                  <SectionTitle>Répartition par type</SectionTitle>
                  {BY_TYPE.length ? (<>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={BY_TYPE} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                        {BY_TYPE.map((e, i) => <Cell key={`type-cell-${i}`} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ border: `1px solid ${C.border}`, borderRadius: 0, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {BY_TYPE.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 flex-shrink-0" style={{ background: d.color }} />
                          <span style={{ fontSize: '0.75rem', color: C.muted }}>{d.name}</span>
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.text }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                  </>) : <EmptyChart height={160} label="Aucun dossier à répartir pour le moment." />}
                </div>
              </div>

              {/* Status + Biens */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <SectionTitle>Répartition par statut</SectionTitle>
                  {BY_STATUS.length ? (
                  <div className="space-y-3">
                    {BY_STATUS.map(s => {
                      const total = BY_STATUS.reduce((a, x) => a + x.value, 0);
                      const pct = Math.round((s.value / total) * 100);
                      return (
                        <div key={s.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 flex-shrink-0" style={{ background: s.color }} />
                              <span style={{ fontSize: '0.8125rem', color: C.text, fontWeight: 500 }}>{s.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.text }}>{s.value}</span>
                              <span style={{ fontSize: '0.75rem', color: C.muted }}>({pct}%)</span>
                            </div>
                          </div>
                          <div className="h-1.5" style={{ background: 'rgba(99,2,16,0.08)' }}>
                            <div className="h-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  ) : <EmptyChart height={160} label="Aucun dossier à répartir pour le moment." />}
                </div>

                <div>
                  <SectionTitle>Pièces & signatures par dossier</SectionTitle>
                  {BY_BIEN.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={BY_BIEN} layout="vertical" barSize={14}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,2,16,0.04)' }} />
                      <Bar dataKey="count" name="Dossiers" fill={C.bordeaux} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  ) : <EmptyChart height={200} label="Aucun dossier à analyser pour le moment." />}
                </div>
              </div>

              {/* Délai moyen — nécessite un historique horodaté (à venir) */}
              <div>
                <SectionTitle>Délai moyen de traitement (jours)</SectionTitle>
                <EmptyChart height={180} label="Le suivi des délais se construira au fil du traitement des dossiers réels." />
              </div>
            </div>
          )}

          {/* ── Tab: Financier ─────────────────────────────────────────── */}
          {activeTab === 'financier' && (
            <div className="space-y-8">
              {/* KPIs financiers */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Montant total décaissé', value: ouTiret(totalMontant, formatFCFA), color: C.bordeaux },
                  { label: 'Montant moyen / dossier financé', value: ouTiret(totalMontant, m => formatFCFA(m / Math.max(1, rFinalises))), color: C.goldText },
                  { label: 'Dossiers financés', value: String(rFinalises), color: C.goldText },
                  { label: 'Reste à financer', value: `${rEnCours} dossier${rEnCours > 1 ? 's' : ''}`, color: C.bordeaux },
                ].map(k => (
                  <div key={k.label} className="p-5 bg-white" style={{ border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: '0.8125rem', color: C.muted, marginTop: '4px' }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Montant mensuel area + cumulé */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <SectionTitle>Montants accordés par mois (M FCFA)</SectionTitle>
                  <EmptyChart height={220} label="Le suivi financier mensuel apparaîtra une fois les montants de financement enregistrés sur des dossiers réels." />
                </div>
                <div>
                  <SectionTitle>Cumul des financements (M FCFA)</SectionTitle>
                  <EmptyChart height={220} label="Le cumul se construira au fil des décaissements réels." />
                </div>
              </div>

              {/* Montant par type de bien — données financières non encore suivies */}
              <div>
                <SectionTitle>Volume financier par type de bien (M FCFA)</SectionTitle>
                <EmptyChart height={220} label="Aucun montant de financement enregistré pour le moment." />
              </div>
            </div>
          )}

          {/* ── Tab: Agents ────────────────────────────────────────────── */}
          {activeTab === 'agents' && (
            <div className="space-y-8">
              {/* Aperçu réel */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: 'Agents actifs', value: ouTiret(realAgentCount, String), sub: 'Comptes professionnels CPI', color: C.bordeaux },
                  { label: 'Dossiers suivis', value: String(rTotal), sub: 'Portefeuille en cours', color: C.green },
                  { label: 'Dossiers finalisés', value: String(rFinalises), sub: `${rTaux}% du portefeuille`, color: C.goldText },
                ].map(k => (
                  <div key={k.label} className="p-5 bg-white" style={{ border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, marginTop: '2px' }}>{k.label}</div>
                    <div style={{ fontSize: '0.75rem', color: C.muted }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Performance par agent — nécessite un suivi par agent (à venir) */}
              <div>
                <SectionTitle>Performance individuelle des agents</SectionTitle>
                <EmptyChart height={180} label="Le suivi de performance par agent sera disponible une fois l'attribution des dossiers aux agents mise en place." />
              </div>
            </div>
          )}

          {/* ── Tab: Entonnoir ─────────────────────────────────────────── */}
          {activeTab === 'entonnoir' && (
            <div className="space-y-8">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Funnel visual */}
                <div>
                  <SectionTitle>Entonnoir de conversion</SectionTitle>
                  <div className="space-y-2">
                    {FUNNEL_DATA.map((step, i) => {
                      const prev = i === 0 ? step.value : FUNNEL_DATA[i - 1].value;
                      const convRate = funnelFirst === 0 ? 0 : (i === 0 ? 100 : Math.round((step.value / funnelFirst) * 100));
                      const stepRate = prev === 0 ? 0 : (i === 0 ? 100 : Math.round((step.value / prev) * 100));
                      const width = funnelFirst === 0 ? 0 : Math.round((step.value / funnelFirst) * 100);
                      return (
                        <div key={step.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>{step.name}</span>
                            <div className="flex items-center gap-3">
                              {i > 0 && (
                                <span style={{ fontSize: '0.6875rem', color: C.muted }}>
                                  Étape: {stepRate}%
                                </span>
                              )}
                              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>{step.value}</span>
                            </div>
                          </div>
                          <div className="relative h-8 flex items-center" style={{ background: 'rgba(99,2,16,0.06)' }}>
                            <div className="h-full flex items-center justify-end pr-3 transition-all"
                              style={{ width: `${width}%`, background: step.fill, minWidth: '2rem' }}>
                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'white' }}>{convRate}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 p-4" style={{ background: C.bordeauxLight, border: `1px solid rgba(99,2,16,0.15)` }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.bordeaux }}>Taux de conversion global</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: C.bordeaux }}>{conversionGlobal}%</div>
                    <div style={{ fontSize: '0.75rem', color: C.muted }}>Des dossiers du portefeuille atteignent la signature</div>
                  </div>
                </div>

                {/* Analyse des pertes — nécessite le suivi des motifs de refus/abandon */}
                <div>
                  <SectionTitle>Analyse des pertes</SectionTitle>
                  <EmptyChart height={320} label="L'analyse des pertes (dossiers incomplets, refusés, sans suite) apparaîtra dès que des dossiers auront été traités." />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Audience & engagement (Admin) ─────────────────────── */}
          {activeTab === 'audience' && isAdmin && (
            <div className="space-y-6">
              {/* Bandeau explicatif */}
              <div className="p-4 flex items-start gap-3" style={{ background: C.bordeauxLight, border: `1px solid rgba(99,2,16,0.15)`, borderRadius: 'var(--r-sm)' }}>
                <Activity className="w-4 h-4 flex-shrink-0" style={{ color: C.bordeaux, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.bordeaux }}>Mesure d'audience — à connecter</div>
                  <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
                    Les indicateurs <strong style={{ color: C.green }}>en vert</strong> sont déjà calculés en temps réel depuis le registre. Les autres proviennent d'un outil de mesure d'audience (Google&nbsp;Analytics&nbsp;4) ou du backend&nbsp;: chaque emplacement est prêt à recevoir sa donnée, sans chiffre fictif.
                  </p>
                </div>
              </div>

              {audienceFamilies.map(fam => {
                const FamIcon = fam.icon;
                return (
                  <div key={fam.title}>
                    <div className="flex items-center gap-2 mb-3">
                      <FamIcon className="w-4 h-4" style={{ color: C.bordeaux }} />
                      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', color: C.text }}>{fam.title}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {fam.metrics.map(m => (
                        <MetricTile key={m.label} label={m.label} value={m.value} hint={m.hint} source={m.source} icon={m.icon} />
                      ))}
                    </div>
                  </div>
                );
              })}

              <p style={{ fontSize: '0.6875rem', color: C.muted, lineHeight: 1.6 }}>
                Une fois l'outil de mesure connecté, ces tuiles afficheront les valeurs agrégées sur la période sélectionnée
                (contrat d'API documenté dans le code&nbsp;: <code>GET /api/admin/analytics</code>).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
