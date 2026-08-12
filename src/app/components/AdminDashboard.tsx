import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, Users, FileText, CheckCircle2,
  Clock, AlertCircle, XCircle, Shield, Banknote, ChevronRight, Server, Bell, Upload,
  Search, Download, Activity, X, ArrowRight, RefreshCw, PenLine,
  UserPlus, Copy, Mail, Plus, Trash2, Building2, Landmark,
  Gauge, Zap, Database, Timer, Wifi, HardDrive, Key, Smartphone, Eye, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { AuthUser } from '../App';
import { useNavigate } from '../contexts/NavigationContext';
import { useClientContext } from '../contexts/ClientContext';
import { usePermission } from '../auth/PermissionContext';
import { useDocState } from '../data/docStateContext';
import { useCpiDocs } from '../data/cpiDocsContext';
import { computeJourneyStep, TIMELINE_STEPS, SIGNATURE_INDEX, DOCS_VALIDES_INDEX } from '../data/dossierJourney';
import {
  useStaffQuery, useCreateStaff, useCreateClient, toStaffAccount,
  CLIENTS_QUERY_KEY,
  type StaffAccount,
} from '../data/clientRegistry';
import { apiErrorMessage, SILENCIEUX, TOKEN_KEY } from '../api/client';
// Aliasé : `toast` est déjà le nom d'un état local de confirmation.
import { toast as notifier } from 'sonner';
import {
  staffApi, DEMO_REF_PREFIX,
  type DemoSeedResult, type DemoClearResult,
  type DemandeInput,
} from '../api/endpoints';
import {
  useBanksQuery, useCreateBank, useDeleteBank, isBankActive, BANK_COLORS,
  useAssignBank, useSetBankStatus, useRemoveBankAssignment,
  toBank, toAssignmentMap,
  type Bank, type BankStatus,
} from '../data/bankRegistry';
import type { ClientSummary } from '../data/demoStore';
import DocumentsClientsModule from './DocumentsClientsModule';
import DocumentsAdminModule from './DocumentsAdminModule';
import ChantierModule from './ChantierModule';
import DecaissementsModule from './DecaissementsModule';
import NotificationsModule from './NotificationsModule';
import HistoriqueModule from './HistoriqueModule';
import { MONTHS_ABBR, frDateSortKey, parseFrDate } from '../lib/format';
import { ConfirmDialog, Modal } from './ui/overlays';
import { STATUT_BANQUE, STATUT_DOC_CPI, STATUT_PIECE } from '../lib/statuts';

interface Props { user: AuthUser; activeNav?: string }

const A = { bordeaux: '#630210', gold: '#C8921A', green: '#1A6B44', text: '#1C0810', muted: '#6B4A52', border: 'rgba(99,2,16,0.1)', red: 'var(--destructive)' };


const ACT_ICON: Record<string, { El: LucideIcon; color: string }> = {
  validation:   { El: CheckCircle2, color: A.green },
  refus:        { El: XCircle,      color: A.red },
  document:     { El: FileText,     color: A.bordeaux },
  notification: { El: Bell,         color: A.gold },
  depot:        { El: Upload,       color: A.bordeaux },
  decaissement: { El: Banknote,     color: A.green },
  commentaire:  { El: AlertCircle,  color: A.gold },
  photo:        { El: FileText,     color: A.gold },
};

const MODULE_NAVS = ['documents-clients', 'documents-admin', 'chantier', 'decaissements', 'notifications-agent', 'historique'];

export default function AdminDashboard({ user, activeNav }: Props) {
  if (MODULE_NAVS.includes(activeNav ?? '')) {
    return <AdminModuleView activeNav={activeNav!} agentName={user.name} />;
  }

  const { navigate } = useNavigate();
  const { allClients } = useClientContext();
  const { allDocsByClient, dossierEtapes, submittedByClient, allHistoryByClient } = useDocState();
  const { allCpiDocsByClient, allCpiHistoryByClient } = useCpiDocs();
  // Comptes du personnel CPI (API) — sert au calcul de la charge par technicien.
  const staffQuery = useStaffQuery(true);
  const staffAccounts: StaffAccount[] = (staffQuery.data ?? []).map(toStaffAccount);

  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<'tout' | 'jour' | '7j' | '30j'>('tout');
  const [granularity, setGranularity] = useState<'mensuel' | 'semestriel' | 'annuel'>('mensuel');

  // ── Dérivation de l'état réel de chaque dossier ─────────────────────────────
  const rows = allClients.map(c => {
    const docs = allDocsByClient[c.id] ?? [];
    const submitted = submittedByClient[c.id] ?? false;
    const etape = dossierEtapes[c.id] ?? DOCS_VALIDES_INDEX;
    const activeStep = computeJourneyStep(submitted, docs, etape);
    const validated = docs.filter(d => d.status === 'accepte').length;
    const toVerify = docs.filter(d => d.status === 'depose' || d.status === 'verification').length;
    const hasIssue = docs.some(d => d.status === 'refuse' || d.status === 'a-remplacer');
    const toSign = (allCpiDocsByClient[c.id] ?? []).filter(d => d.visibleClient && d.signatureRequise && d.status === 'a-signer').length;
    return { c, docs, activeStep, validated, total: docs.length, toVerify, hasIssue, toSign, submitted };
  }).sort((a, b) => a.c.ref.localeCompare(b.c.ref));

  const rTotal = rows.length;
  const rFinalises = rows.filter(r => r.activeStep >= SIGNATURE_INDEX).length;
  const rEnCours = rows.filter(r => r.activeStep < SIGNATURE_INDEX).length;
  const rAVerifier = rows.reduce((n, r) => n + r.toVerify, 0);
  const rASigner = rows.reduce((n, r) => n + r.toSign, 0);
  const rTaux = rTotal ? Math.round((rFinalises / rTotal) * 100) : 0;
  const rIssues = rows.filter(r => r.hasIssue).length;
  const rATraiter = rows.filter(r => r.submitted && r.activeStep < SIGNATURE_INDEX).length;
  const rActionsTotal = rAVerifier + rASigner + rIssues;

  // Activité fusionnée, triée (liste complète — filtrée par période à l'affichage).
  const activityAll = useMemo(() => {
    const all = [...Object.values(allHistoryByClient).flat(), ...Object.values(allCpiHistoryByClient).flat()];
    const seen = new Set<string>();
    const uniq = all.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    return uniq.sort((a, b) => frDateSortKey(b.date, b.heure).localeCompare(frDateSortKey(a.date, a.heure)));
  }, [allHistoryByClient, allCpiHistoryByClient]);

  const now = new Date();
  const recentActivity = activityAll.filter(a => {
    if (period === 'tout') return true;
    const d = parseFrDate(a.date, now);
    if (!d) return true;
    const days = (now.getTime() - d.getTime()) / 86_400_000;
    return period === 'jour' ? days < 1 : period === '7j' ? days <= 7 : days <= 30;
  }).slice(0, 8);

  const lastActivityDate = activityAll[0]?.date ?? '—';

  // Diagramme d'évolution RÉEL : inscriptions + activité + validations par période.
  const evolutionData = useMemo(() => {
    const now2 = new Date();
    // flatMap plutôt qu'un map suivi d'un prédicat : les entrées dont la date
    // est illisible disparaissent, et `d` reste une vraie Date pour la suite.
    const events = activityAll.flatMap(e => {
      const d = parseFrDate(e.date, now2);
      return d ? [{ d, type: e.type }] : [];
    });
    const inscriptions = allClients.flatMap(c => {
      const d = c.dateInscription ? parseFrDate(c.dateInscription, now2) : null;
      return d ? [d] : [];
    });
    type Bucket = { label: string; test: (d: Date) => boolean };
    const buckets: Bucket[] = [];
    if (granularity === 'mensuel') {
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
        const y = dt.getFullYear(), m = dt.getMonth();
        buckets.push({ label: MONTHS_ABBR[m], test: d => d.getFullYear() === y && d.getMonth() === m });
      }
    } else if (granularity === 'semestriel') {
      const seq: { y: number; s: 1 | 2 }[] = [];
      let y = now2.getFullYear(); let s: 1 | 2 = now2.getMonth() < 6 ? 1 : 2;
      for (let i = 0; i < 4; i++) { seq.push({ y, s }); if (s === 1) { s = 2; y--; } else { s = 1; } }
      seq.reverse().forEach(({ y, s }) => buckets.push({ label: `S${s} ${String(y).slice(2)}`, test: d => d.getFullYear() === y && (s === 1 ? d.getMonth() < 6 : d.getMonth() >= 6) }));
    } else {
      for (let i = 3; i >= 0; i--) { const y = now2.getFullYear() - i; buckets.push({ label: String(y), test: d => d.getFullYear() === y }); }
    }
    return buckets.map(b => ({
      label: b.label,
      Inscriptions: inscriptions.filter(d => b.test(d)).length,
      Activité: events.filter(e => b.test(e.d)).length,
      Validations: events.filter(e => b.test(e.d) && e.type === 'validation').length,
    }));
  }, [activityAll, allClients, granularity]);
  const hasEvolution = evolutionData.some(b => b.Inscriptions > 0 || b.Activité > 0 || b.Validations > 0);

  // Résultats de la recherche rapide (nom ou n° de dossier).
  const q = query.trim().toLowerCase();
  const searchResults = q ? rows.filter(r => r.c.name.toLowerCase().includes(q) || r.c.ref.toLowerCase().includes(q)).slice(0, 6) : [];

  // Actions prioritaires : ce qui attend un traitement, avec navigation directe.
  const priorityActions = [
    { key: 'verif',   label: 'Pièces à vérifier',            count: rAVerifier, hint: 'Documents déposés en attente de validation', icon: FileText,    color: A.gold,     nav: 'documents-clients' },
    { key: 'sign',    label: 'Documents en attente de signature', count: rASigner, hint: 'Envoyés au client, non encore signés',    icon: Shield,      color: A.bordeaux, nav: 'documents-admin' },
    { key: 'corrige', label: 'Dossiers à corriger',          count: rIssues,    hint: 'Pièces refusées ou à remplacer',            icon: AlertCircle, color: A.red,      nav: 'demandes' },
    { key: 'traiter', label: 'Dossiers à faire avancer',     count: rATraiter,  hint: 'Demandes soumises, parcours en cours',      icon: Clock,       color: A.gold,     nav: 'demandes' },
  ].filter(a => a.count > 0);

  // Raccourcis vers tous les espaces de gestion de la plateforme.
  const shortcuts: { label: string; icon: LucideIcon; nav: string }[] = [
    { label: 'Toutes les demandes', icon: FileText,   nav: 'demandes' },
    { label: 'Utilisateurs',        icon: Users,      nav: 'utilisateurs' },
    { label: 'Partenaires',         icon: Shield,     nav: 'partenaires' },
    { label: 'Documents clients',   icon: FileText,   nav: 'documents-clients' },
    { label: 'Documents admin',     icon: Upload,     nav: 'documents-admin' },
    { label: 'Décaissements',       icon: Banknote,   nav: 'decaissements' },
    { label: 'Notifications',       icon: Bell,       nav: 'notifications-agent' },
    { label: 'Historique',          icon: Clock,      nav: 'historique' },
    { label: 'Rapports & Stats',    icon: TrendingUp, nav: 'statistiques' },
    { label: 'Système',             icon: Server,     nav: 'systeme' },
  ];

  const exportCSV = () => {
    const header = ['Dossier', 'Client', 'Projet', 'Étape', 'Pièces validées', 'À vérifier', 'À signer', 'Anomalie'];
    const lines = rows.map(r => [r.c.ref, r.c.name, r.c.projectNom, TIMELINE_STEPS[r.activeStep]?.label ?? '', `${r.validated}/${r.total}`, r.toVerify, r.toSign, r.hasIssue ? 'oui' : 'non']);
    const csv = [header, ...lines].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vue-globale-cpi.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const section = activeNav === 'utilisateurs' ? 'users'
    : activeNav === 'partenaires' ? 'partners'
    : activeNav === 'demandes' ? 'demandes'
    : activeNav === 'systeme' ? 'systeme'
    : 'overview';

  const titles: Record<string, { kick: string; title: string }> = {
    overview: { kick: 'Accès Administrateur', title: 'Vue globale de la plateforme' },
    demandes: { kick: 'Dossiers', title: 'Toutes les demandes' },
    users:    { kick: 'Comptes', title: 'Utilisateurs' },
    partners: { kick: 'Réseau', title: 'Partenaires' },
    systeme:  { kick: 'Configuration', title: 'Système' },
  };

  // ── Répartitions réelles ────────────────────────────────────────────────────
  const BY_STATUS = [
    { name: 'Dossier reçu',      value: rows.filter(r => r.activeStep === 1).length, color: '#6B4A52' },
    { name: 'Documents valides', value: rows.filter(r => r.activeStep === DOCS_VALIDES_INDEX).length, color: A.gold },
    { name: 'Analyse / banque',  value: rows.filter(r => r.activeStep > DOCS_VALIDES_INDEX && r.activeStep < SIGNATURE_INDEX).length, color: A.bordeaux },
    { name: 'Finalisés',         value: rFinalises, color: A.green },
  ].filter(s => s.value > 0);
  const PIE_DATA = [
    { name: 'En cours',  value: rEnCours,   color: A.gold },
    { name: 'Finalisés', value: rFinalises, color: A.bordeaux },
  ].filter(s => s.value > 0);

  // ── Analyse du portefeuille (agrégats réels) ────────────────────────────────
  const allDocs = rows.flatMap(r => r.docs);
  const PIECES_DATA = [
    { name: 'Validées',   value: allDocs.filter(d => d.status === 'accepte').length,                                 color: A.green },
    { name: 'À vérifier', value: allDocs.filter(d => d.status === 'depose' || d.status === 'verification').length,   color: A.gold },
    { name: 'Refusées',   value: allDocs.filter(d => d.status === 'refuse' || d.status === 'a-remplacer').length,    color: A.red },
    // « Non déposée » et non « En attente » : ces pièces attendent le CLIENT,
    // pas CPI. Sous l'ancien libellé, un dossier où le client n'avait encore
    // rien envoyé gonflait la charge de travail apparente du personnel.
    { name: 'Non déposées', value: allDocs.filter(d => d.status === 'en-attente').length,                            color: A.muted },
  ].filter(s => s.value > 0);
  const piecesTotal = PIECES_DATA.reduce((n, s) => n + s.value, 0);

  const allCpi = Object.values(allCpiDocsByClient).flat();
  const CPI_DATA = [
    { name: 'À signer',    value: allCpi.filter(d => d.status === 'a-signer').length,   color: A.bordeaux },
    { name: 'Signés',      value: allCpi.filter(d => d.status === 'signe').length,      color: A.green },
    { name: 'Disponibles', value: allCpi.filter(d => d.status === 'disponible').length, color: A.gold },
    { name: 'Brouillons',  value: allCpi.filter(d => d.status === 'brouillon').length,  color: A.muted },
  ].filter(s => s.value > 0);
  const cpiTotal = CPI_DATA.reduce((n, s) => n + s.value, 0);

  const FUNNEL = TIMELINE_STEPS.map((s, i) => ({ label: s.label, value: rows.filter(r => r.activeStep >= i).length }));
  const funnelMax = FUNNEL[0]?.value ?? 0;

  const completude = rTotal
    ? Math.round((rows.reduce((n, r) => n + (r.total ? r.validated / r.total : 0), 0) / rTotal) * 100)
    : 0;
  const GAUGE_DATA = [{ name: 'Validé', value: completude }, { name: 'Reste', value: 100 - completude }];

  // ═══ Performances opérationnelles (réel + emplacements backend) ══════════════
  //
  // BACKEND À PRÉVOIR (par les techniciens CPI) — deux endpoints alimenteront les
  // valeurs marquées « backend » ci-dessous. Format d'API attendu :
  //
  //   GET /api/admin/system-health  →  {
  //     uptimePct: number,          // ex. 99.98  → « 99,98 % »
  //     apiLatencyMs: number,       // ex. 120    → « 120 ms »
  //     database: 'ok'|'degraded'|'down',
  //     lastBackupAt: string,       // ISO 8601   → date de dernière sauvegarde
  //   }
  //   GET /api/admin/perf  →  {
  //     avgProcessingHours: number, // délai moyen dépôt → validation (heures)
  //     queueAgeHours: number,      // ancienneté moyenne de la file de vérification
  //   }
  //
  // Les autres indicateurs sont déjà calculés côté front sur les vraies données.
  // ─────────────────────────────────────────────────────────────────────────────

  const httpsOk = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Nombre d'agents CPI (comptes réels de l'API) pour la charge par technicien.
  const agentsCount = staffAccounts.filter(s => s.role === 'agent-cpi').length;
  const piecesValidees = allDocs.filter(d => d.status === 'accepte').length;
  const piecesRefusees = allDocs.filter(d => d.status === 'refuse' || d.status === 'a-remplacer').length;
  const piecesTraitees = piecesValidees + piecesRefusees;
  const tauxValidation = piecesTraitees ? Math.round((piecesValidees / piecesTraitees) * 100) : null;
  const tauxRefus = piecesTraitees ? Math.round((piecesRefusees / piecesTraitees) * 100) : null;
  const dossiersSoumis = rows.filter(r => r.activeStep >= 1).length;
  const tauxConversion = rTotal ? Math.round((dossiersSoumis / rTotal) * 100) : null;
  const chargeParTech = agentsCount ? Math.round((rEnCours / agentsCount) * 10) / 10 : 0;

  type PctMetric = { label: string; pct: number | null; hint: string; color: string };
  // Panneau « Performances — Qualité du traitement » (indicateurs en %).
  const qualiteMetrics: PctMetric[] = [
    { label: 'Taux de validation des pièces',   pct: tauxValidation, hint: 'Pièces validées / pièces traitées',       color: A.green },
    { label: 'Taux de refus des pièces',        pct: tauxRefus,      hint: 'Refusées ou à remplacer / traitées',       color: A.red },
    { label: 'Conversion inscription → dossier', pct: tauxConversion, hint: 'Inscrits ayant soumis une demande',        color: A.bordeaux },
    { label: 'Complétude moyenne des dossiers', pct: completude,     hint: 'Part des pièces requises validées',        color: A.gold },
  ];

  type LoadMetric = { label: string; value: number; hint: string; icon: LucideIcon; color: string };
  // Panneau « Charge & file d'attente » (pilotage des techniciens).
  const chargeMetrics: LoadMetric[] = [
    { label: 'Dossiers actifs',        value: rEnCours,   hint: 'Non finalisés, en cours de traitement', icon: FileText,    color: A.gold },
    { label: 'Charge par technicien',  value: chargeParTech, hint: `${rEnCours} actif(s) · ${agentsCount} agent(s) CPI`, icon: Users, color: A.text },
    { label: 'File de vérification',   value: rAVerifier, hint: 'Pièces déposées à contrôler',           icon: Clock,       color: A.gold },
    { label: 'Documents à signer',     value: rASigner,   hint: 'Envoyés au client, non signés',         icon: PenLine,     color: A.bordeaux },
    { label: 'Dossiers en anomalie',   value: rIssues,    hint: 'Pièces refusées ou à corriger',         icon: AlertCircle, color: rIssues > 0 ? A.red : A.green },
  ];

  // Santé technique : front mesurable ; serveur/BDD viendront du backend (prévu).
  const systemHealth: { label: string; value: string; ok: boolean | null; icon: LucideIcon }[] = [
    { label: 'Plateforme',                     value: 'Opérationnelle',        ok: true,    icon: Activity },
    { label: 'Interface (front)',              value: 'À jour · build déployé', ok: true,   icon: Zap },
    { label: 'Connexion sécurisée (HTTPS)',    value: httpsOk ? 'Actif' : 'Non sécurisé', ok: httpsOk, icon: Shield },
    { label: 'Disponibilité serveur (uptime)', value: 'À connecter',           ok: null,    icon: Wifi },
    { label: 'Temps de réponse API',           value: 'À connecter',           ok: null,    icon: Timer },
    { label: 'Base de données',                value: 'À connecter',           ok: null,    icon: Database },
    { label: 'Sauvegardes',                    value: 'À connecter',           ok: null,    icon: Server },
  ];

  const card = 'bg-white p-5 sm:p-6';
  const cardStyle: React.CSSProperties = { border: `1px solid ${A.border}`, borderRadius: 'var(--r-md)' };

  return (
    <div className="space-y-6" style={{ width: '100%' }}>
      {/* Header */}
      <div>
        <div style={{ color: A.gold, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{titles[section].kick}</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: A.text }}>{titles[section].title}</h2>
      </div>

      {/* ── OVERVIEW — Poste de pilotage ─────────────────────────────────────── */}
      {section === 'overview' && (
        <>
          {/* Bandeau état système */}
          <div className="bg-white flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3" style={cardStyle}>
            <div className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: 'var(--r-full)', background: A.green, boxShadow: `0 0 0 3px rgba(26,107,68,0.15)` }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>Plateforme opérationnelle</span>
            </div>
            {[
              { l: 'Clients', v: String(rTotal) },
              { l: 'Comptes pro', v: '2' },
              { l: 'Dossiers actifs', v: String(rEnCours) },
              { l: 'Dernière activité', v: lastActivityDate },
            ].map(s => (
              <div key={s.l} className="flex items-center gap-1.5">
                <span style={{ fontSize: '0.75rem', color: A.muted }}>{s.l}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>{s.v}</span>
              </div>
            ))}
            <button onClick={exportCSV} className="ml-auto flex items-center gap-2 px-3 py-1.5"
              style={{ border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, color: A.bordeaux, background: 'white', cursor: 'pointer' }}>
              <Download className="w-3.5 h-3.5" /> Exporter (CSV)
            </button>
          </div>

          {/* Recherche rapide */}
          <div className={card} style={cardStyle}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', background: '#FAF7F7' }}>
              <Search className="w-4 h-4" style={{ color: A.muted, flexShrink: 0 }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher un dossier ou un client (nom, n° de dossier)…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: A.text }}
              />
              {query && <button onClick={() => setQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: A.muted, fontSize: '0.75rem' }}>Effacer</button>}
            </div>
            {q && (
              <div className="mt-3 space-y-2">
                {searchResults.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucun résultat pour « {query} ».</div>
                ) : searchResults.map(r => (
                  <button key={r.c.id} onClick={() => navigate('demandes')} className="w-full flex items-center gap-3 p-2 text-left" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer' }}>
                    <div className="w-8 h-8 flex items-center justify-center text-white flex-shrink-0" style={{ background: A.bordeaux, fontSize: '0.6875rem', fontWeight: 700, borderRadius: 'var(--r-sm)' }}>
                      {r.c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: A.text }}>{r.c.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: A.muted }}>{r.c.ref} · {TIMELINE_STEPS[r.activeStep]?.label}</div>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: A.muted, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* KPIs réels */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 cpi-stagger">
            {[
              { label: 'Dossiers suivis',      value: String(rTotal),        sub: 'Portefeuille total',                    icon: FileText,   color: A.bordeaux },
              { label: 'En cours',             value: String(rEnCours),      sub: 'Dossiers non finalisés',                icon: Clock,      color: A.gold },
              { label: 'Finalisés',            value: String(rFinalises),    sub: `${rTaux}% du portefeuille`,             icon: CheckCircle2, color: A.green },
              { label: 'Actions requises',     value: String(rActionsTotal), sub: `${rAVerifier} à vérifier · ${rASigner} à signer`, icon: AlertCircle, color: rActionsTotal > 0 ? A.red : A.green },
            ].map(kpi => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className={card} style={cardStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 flex items-center justify-center" style={{ background: `${kpi.color}12`, borderRadius: 'var(--r-sm)' }}>
                      <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: A.text }}>{kpi.value}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: A.muted, marginTop: 2 }}>{kpi.label}</div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: A.muted, marginTop: 2 }}>{kpi.sub}</div>
                </div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Actions prioritaires */}
              <div className={card} style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 16 }}>Actions prioritaires</h3>
                {priorityActions.length === 0 ? (
                  <div className="flex items-center gap-3 p-4" style={{ background: 'rgba(26,107,68,0.06)', borderRadius: 'var(--r-sm)' }}>
                    <CheckCircle2 className="w-5 h-5" style={{ color: A.green }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: A.text }}>Tout est à jour — aucune action requise.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {priorityActions.map(a => {
                      const Icon = a.icon;
                      return (
                        <div key={a.key} className="flex items-center gap-3 p-3 flex-wrap" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}14`, borderRadius: 'var(--r-sm)' }}>
                            <Icon className="w-4 h-4" style={{ color: a.color }} />
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: a.color }}>{a.count}</span>
                          </div>
                          <div className="flex-1" style={{ minWidth: 140 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: A.text }}>{a.label}</div>
                            <div style={{ fontSize: '0.75rem', color: A.muted }}>{a.hint}</div>
                          </div>
                          <button onClick={() => navigate(a.nav)} className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0"
                            style={{ background: a.color, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                            Gérer <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Répartition par étape (réel) */}
              <div className={card} style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 16 }}>Répartition des dossiers par étape</h3>
                {BY_STATUS.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucun dossier dans le portefeuille pour le moment.</div>
                ) : (
                  <div className="space-y-3">
                    {BY_STATUS.map(s => {
                      const pct = rTotal ? Math.round((s.value / rTotal) * 100) : 0;
                      return (
                        <div key={s.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span style={{ fontSize: '0.8125rem', color: A.text, fontWeight: 500 }}>{s.name}</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>{s.value} <span style={{ color: A.muted, fontWeight: 400 }}>({pct}%)</span></span>
                          </div>
                          <div className="h-1.5" style={{ background: '#EDE4E6', borderRadius: 'var(--r-full)' }}>
                            <div className="h-full" style={{ width: `${pct}%`, background: s.color, borderRadius: 'var(--r-full)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Diagramme d'évolution de l'activité (réel) */}
              <div className={card} style={cardStyle}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Évolution de l'activité</h3>
                  <div className="flex items-center gap-1" style={{ background: '#F5ECEE', borderRadius: 'var(--r-sm)', padding: 2 }}>
                    {([['mensuel', 'Mensuel'], ['semestriel', 'Semestriel'], ['annuel', 'Annuel']] as const).map(([val, lbl]) => (
                      <button key={val} onClick={() => setGranularity(val)}
                        style={{ padding: '4px 10px', borderRadius: 'var(--r-xs)', border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700,
                          background: granularity === val ? A.bordeaux : 'transparent', color: granularity === val ? 'white' : A.muted }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                {hasEvolution ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={evolutionData} barGap={3} barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,2,16,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: A.muted }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: A.muted }} axisLine={false} tickLine={false} />
                      {/* Recharts 3 empile selon l'ordre de rendu : la légende
                          d'abord, l'infobulle ensuite, sinon elle passe dessous. */}
                      <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }} />
                      <Tooltip contentStyle={{ border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: 12, background: 'white' }} cursor={{ fill: 'rgba(99,2,16,0.04)' }} />
                      <Bar dataKey="Inscriptions" fill={A.gold} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Activité" fill={A.bordeaux} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Validations" fill={A.green} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height: 220, border: `1px dashed ${A.border}`, borderRadius: 'var(--r-sm)', background: '#FAF7F7' }}>
                    <TrendingUp className="w-6 h-6" style={{ color: A.border }} />
                    <span style={{ fontSize: '0.8125rem', color: A.muted, maxWidth: 320 }}>Aucune activité sur cette période. Le diagramme se remplit au fil des dépôts, validations et publications réels.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Avancement pie */}
              <div className={card} style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 12 }}>Avancement</h3>
                {PIE_DATA.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                          {PIE_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                      {PIE_DATA.map(d => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5" style={{ background: d.color, borderRadius: 2 }} /><span style={{ fontSize: '0.75rem', color: A.muted }}>{d.name}</span></div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucun dossier.</div>}
              </div>

              {/* Activité récente + filtre période */}
              <div className={card} style={cardStyle}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Activité récente</h3>
                  <div className="flex items-center gap-1" style={{ background: '#F5ECEE', borderRadius: 'var(--r-sm)', padding: 2 }}>
                    {([['tout', 'Tout'], ['30j', '30j'], ['7j', '7j'], ['jour', "Auj."]] as const).map(([val, lbl]) => (
                      <button key={val} onClick={() => setPeriod(val)}
                        style={{ padding: '3px 8px', borderRadius: 'var(--r-xs)', border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700,
                          background: period === val ? A.bordeaux : 'transparent', color: period === val ? 'white' : A.muted }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  {recentActivity.length === 0 ? (
                    <div className="flex items-center gap-2 py-2"><Activity className="w-4 h-4" style={{ color: A.muted }} /><span style={{ fontSize: '0.8125rem', color: A.muted }}>Aucune activité sur cette période.</span></div>
                  ) : recentActivity.map((a, i) => {
                    const cfg = ACT_ICON[a.type] ?? ACT_ICON.document;
                    const El = cfg.El;
                    return (
                      <div key={a.id + i} className="flex items-start gap-3 py-2" style={{ borderBottom: i < recentActivity.length - 1 ? `1px solid rgba(99,2,16,0.05)` : 'none' }}>
                        <El className="w-3.5 h-3.5 mt-0.5" style={{ color: cfg.color, flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: A.text }}>{a.action}</div>
                          <div style={{ fontSize: '0.75rem', color: A.muted }}>{a.utilisateur} · {a.cible}</div>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: A.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>{a.date}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Analyse du portefeuille — 4 diagrammes réels */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* 1. Pièces justificatives par statut */}
            <div className={card} style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 12 }}>Pièces justificatives par statut</h3>
              {piecesTotal > 0 ? (
                <div className="flex items-center gap-4 flex-wrap">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={PIECES_DATA} cx="50%" cy="50%" innerRadius={40} outerRadius={64} paddingAngle={3} dataKey="value">
                        {PIECES_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2" style={{ minWidth: 140 }}>
                    {PIECES_DATA.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5" style={{ background: d.color, borderRadius: 2 }} /><span style={{ fontSize: '0.8125rem', color: A.text }}>{d.name}</span></div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>{d.value} <span style={{ color: A.muted, fontWeight: 400 }}>({Math.round((d.value / piecesTotal) * 100)}%)</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucune pièce déposée pour le moment.</div>}
            </div>

            {/* 2. Documents CPI par statut */}
            <div className={card} style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 12 }}>Documents CPI par statut</h3>
              {cpiTotal > 0 ? (
                <div className="flex items-center gap-4 flex-wrap">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={CPI_DATA} cx="50%" cy="50%" innerRadius={40} outerRadius={64} paddingAngle={3} dataKey="value">
                        {CPI_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2" style={{ minWidth: 140 }}>
                    {CPI_DATA.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5" style={{ background: d.color, borderRadius: 2 }} /><span style={{ fontSize: '0.8125rem', color: A.text }}>{d.name}</span></div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucun document CPI créé pour le moment.</div>}
            </div>

            {/* 3. Entonnoir de conversion */}
            <div className={card} style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 16 }}>Entonnoir de conversion</h3>
              {funnelMax > 0 ? (
                <div className="space-y-2">
                  {FUNNEL.map((step, i) => {
                    const width = funnelMax ? Math.round((step.value / funnelMax) * 100) : 0;
                    const isEnd = i >= SIGNATURE_INDEX;
                    return (
                      <div key={step.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: '0.75rem', color: A.text, fontWeight: 500 }}>{step.label}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: A.text }}>{step.value}</span>
                        </div>
                        <div className="h-6 flex items-center" style={{ background: 'rgba(99,2,16,0.06)', borderRadius: 'var(--r-xs)' }}>
                          <div className="h-full flex items-center justify-end pr-2" style={{ width: `${width}%`, background: isEnd ? A.green : A.bordeaux, borderRadius: 'var(--r-xs)', minWidth: 24 }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'white' }}>{width}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucun dossier à analyser pour le moment.</div>}
            </div>

            {/* 4. Taux de complétude moyen */}
            <div className={card} style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 12 }}>Taux de complétude moyen des dossiers</h3>
              {rTotal > 0 ? (
                <div className="flex items-center gap-5 flex-wrap">
                  <div style={{ position: 'relative', width: 150, height: 150 }}>
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie data={GAUGE_DATA} cx="50%" cy="50%" innerRadius={52} outerRadius={70} startAngle={90} endAngle={-270} paddingAngle={0} dataKey="value" stroke="none">
                          <Cell fill={A.green} />
                          <Cell fill="#EDE4E6" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: A.text }}>{completude}%</span>
                      <span style={{ fontSize: '0.625rem', color: A.muted }}>complété</span>
                    </div>
                  </div>
                  <div className="flex-1" style={{ minWidth: 160 }}>
                    <div style={{ fontSize: '0.8125rem', color: A.muted, lineHeight: 1.5 }}>
                      Part moyenne des pièces requises <strong style={{ color: A.text }}>validées</strong> par dossier, sur l'ensemble du portefeuille.
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span style={{ fontSize: '0.75rem', color: A.muted }}>Dossiers concernés</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: A.text }}>{rTotal}</span>
                    </div>
                  </div>
                </div>
              ) : <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucun dossier dans le portefeuille pour le moment.</div>}
            </div>
          </div>

          {/* ── Performances opérationnelles (supervision technique) ─────────── */}
          <div>
            <div style={{ color: A.gold, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Supervision technique</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: A.text }}>Performances opérationnelles</h3>
            <p style={{ fontSize: '0.8125rem', color: A.muted, marginTop: 2 }}>Santé du système, qualité de traitement et charge des techniciens — en temps réel sur les données de la plateforme.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* 1. Vue d'ensemble — Santé système */}
            <div className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4" style={{ color: A.green }} />
                <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Vue d'ensemble</h4>
              </div>
              <div className="space-y-2">
                {systemHealth.map(h => {
                  const Icon = h.icon;
                  const dot = h.ok === true ? A.green : h.ok === false ? A.red : A.muted;
                  return (
                    <div key={h.label} className="flex items-center gap-3 p-2.5" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: `${dot}14`, borderRadius: 'var(--r-sm)' }}>
                        <Icon className="w-4 h-4" style={{ color: dot }} />
                      </div>
                      <span className="flex-1" style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text, minWidth: 90 }}>{h.label}</span>
                      {h.ok === null ? (
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.muted, background: 'rgba(107,74,82,0.10)', padding: '3px 8px', borderRadius: 'var(--r-full)', flexShrink: 0 }}>backend</span>
                      ) : (
                        <span className="flex items-center gap-1.5" style={{ fontSize: '0.6875rem', fontWeight: 700, color: dot, flexShrink: 0, textAlign: 'right' }}>
                          <span style={{ width: 7, height: 7, borderRadius: 'var(--r-full)', background: dot, flexShrink: 0 }} /> {h.value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.6875rem', color: A.muted, marginTop: 12, lineHeight: 1.5 }}>
                Les métriques serveur (uptime, latence API, base de données, sauvegardes) s'afficheront ici une fois le backend connecté par vos techniciens.
              </p>
            </div>

            {/* 2. Performances — Qualité du traitement (réel, en %) */}
            <div className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="w-4 h-4" style={{ color: A.bordeaux }} />
                <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Performances</h4>
              </div>
              <div className="space-y-3.5">
                {qualiteMetrics.map(m => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>{m.label}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, color: m.pct === null ? A.muted : m.color, flexShrink: 0 }}>{m.pct === null ? '—' : `${m.pct}%`}</span>
                    </div>
                    <div className="h-1.5" style={{ background: 'rgba(99,2,16,0.06)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                      <div className="h-full" style={{ width: `${m.pct ?? 0}%`, background: m.color, borderRadius: 'var(--r-full)', transition: 'width .3s' }} />
                    </div>
                    <div style={{ fontSize: '0.625rem', color: A.muted, marginTop: 3 }}>{m.hint}</div>
                  </div>
                ))}
                {/* Délai moyen — mesuré côté serveur */}
                <div className="flex items-center justify-between p-2.5" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                  <div className="flex items-center gap-2">
                    <Timer className="w-3.5 h-3.5" style={{ color: A.muted }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>Délai moyen de traitement</span>
                  </div>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.muted, background: 'rgba(107,74,82,0.10)', padding: '3px 8px', borderRadius: 'var(--r-full)' }}>backend</span>
                </div>
              </div>
            </div>

            {/* 3. Charge & file d'attente (pilotage des techniciens, réel) */}
            <div className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" style={{ color: A.gold }} />
                <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Charge &amp; file d'attente</h4>
              </div>
              <div className="space-y-2">
                {chargeMetrics.map(m => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="flex items-center gap-3 p-2.5" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: `${m.color}14`, borderRadius: 'var(--r-sm)' }}>
                        <Icon className="w-4 h-4" style={{ color: m.color }} />
                      </div>
                      <div className="flex-1" style={{ minWidth: 90 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>{m.label}</div>
                        <div style={{ fontSize: '0.625rem', color: A.muted }}>{m.hint}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: m.color, flexShrink: 0 }}>{m.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Raccourcis de gestion */}
          <div className={card} style={cardStyle}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, marginBottom: 16 }}>Gestion de la plateforme</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {shortcuts.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.nav} onClick={() => navigate(s.nav)} className="flex flex-col items-start gap-2 p-3 text-left"
                    style={{ background: '#FAF7F7', border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5ECEE'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FAF7F7'; }}>
                    <div className="w-8 h-8 flex items-center justify-center" style={{ background: `${A.bordeaux}12`, borderRadius: 'var(--r-sm)' }}>
                      <Icon className="w-4 h-4" style={{ color: A.bordeaux }} />
                    </div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: A.text, lineHeight: 1.2 }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── TOUTES LES DEMANDES (réel) ───────────────────────────────────────── */}
      {section === 'demandes' && <DemandesView agentName={user.name} />}

      {/* ── UTILISATEURS (réel) ──────────────────────────────────────────────── */}
      {section === 'users' && <UsersView agentName={user.name} />}

      {/* ── PARTENAIRES (banques partenaires) ────────────────────────────────── */}
      {section === 'partners' && <PartnersView />}

      {/* ── SYSTÈME (réel) ───────────────────────────────────────────────────── */}
      {section === 'systeme' && <SystemeView />}
    </div>
  );
}

// ─── Système — configuration technique, stockage & intégrations ───────────────

function SystemeView() {
  const { allCpiDocsByClient } = useCpiDocs();
  const { allClients } = useClientContext();
  const staffQuery = useStaffQuery(true);
  const staff: StaffAccount[] = (staffQuery.data ?? []).map(toStaffAccount);
  const banksQuery = useBanksQuery(true);

  // ── Mesures réelles (navigateur) ─────────────────────────────────────────────
  const httpsOk = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const origin = typeof window !== 'undefined' ? window.location.origin : '—';
  const bundle = typeof document !== 'undefined'
    ? ([...document.scripts].map(s => s.src).find(x => /index-.*\.js/.test(x))?.split('/').pop() ?? '—')
    : '—';

  const clientsCount = allClients.length;
  const agentsCount = staff.filter(s => s.role === 'agent-cpi').length;
  const adminsCount = staff.filter(s => s.role === 'admin').length;
  const banksCount = (banksQuery.data ?? []).length;
  const docsPublies = Object.values(allCpiDocsByClient).flat().filter(d => d.visibleClient).length;

  // ── Ce que ce navigateur conserve réellement ────────────────────────────────
  // Une clé, et une seule : le jeton de session (posé par api/client.ts).
  // Tout le reste — dossiers, pièces, chantiers, journal, avatars — vit sur le
  // serveur (les photos de profil passent par POST /auth/avatar → R2).
  const localKeys = typeof localStorage !== 'undefined'
    ? Object.keys(localStorage).filter(k => k.startsWith('cpi_'))
    : [];
  const localRows = [
    {
      k: 'Jeton de session',
      v: localKeys.includes(TOKEN_KEY) ? 'présent' : 'absent',
      note: 'Effacé à la déconnexion et à toute réponse 401.',
    },
  ];

  // ── Intégrations : ce qui est branché, et ce qui reste à brancher ───────────
  const integrations: {
    label: string;
    note: string;
    icon: LucideIcon;
    ok: boolean;
  }[] = [
    { label: 'API / Backend REST', note: 'API Laravel — persistance centralisée', icon: Server, ok: true },
    { label: 'Base de données', note: 'PostgreSQL — source de vérité unique', icon: Database, ok: true },
    { label: 'Stockage des fichiers', note: 'Cloudflare R2 — liens signés de courte durée', icon: HardDrive, ok: true },
    { label: 'Authentification sécurisée', note: 'Sanctum + connexion Google', icon: Key, ok: true },
    { label: 'Envoi e-mail', note: 'Identifiants & notifications par e-mail', icon: Mail, ok: false },
    { label: 'Envoi SMS', note: 'Notifications par SMS', icon: Smartphone, ok: false },
    { label: 'Envoi WhatsApp', note: 'Notifications WhatsApp', icon: Smartphone, ok: false },
    { label: 'API bancaire (décaissements)', note: 'Décaissements terrain & tranches', icon: Landmark, ok: false },
  ];

  const cardCls = 'bg-white p-5 sm:p-6';
  const infoRows: { k: string; v: string; ok?: boolean }[] = [
    { k: 'Environnement', v: 'Production' },
    { k: 'Version applicative', v: 'CPI Immobilier v1.0' },
    { k: 'Build déployé', v: bundle },
    { k: 'URL de la plateforme', v: origin },
    { k: 'Connexion sécurisée', v: httpsOk ? 'HTTPS actif' : 'Non sécurisé', ok: httpsOk },
    { k: 'Mode de stockage', v: 'Serveur — API Laravel, base PostgreSQL, fichiers Cloudflare R2' },
    { k: 'Rôles actifs', v: 'Client · Agent CPI · Administrateur' },
  ];

  return (
    <div className="space-y-6">
      {/* 0. Données de démo / test */}
      <DemoDataCard clients={allClients} />

      {/* 1. Informations plateforme */}
      <div className={cardCls} style={cs}>
        <div className="flex items-center gap-2 mb-4"><Server className="w-4 h-4" style={{ color: A.bordeaux }} /><h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Informations plateforme</h3></div>
        <div className="space-y-1">
          {infoRows.map((row, i, arr) => (
            <div key={row.k} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(99,2,16,0.06)' : 'none' }}>
              <span style={{ fontSize: '0.8125rem', color: A.muted, flexShrink: 0 }}>{row.k}</span>
              <span className="flex items-center gap-1.5" style={{ fontSize: '0.8125rem', fontWeight: 600, color: row.ok === false ? A.red : A.text, textAlign: 'right', wordBreak: 'break-all' }}>
                {row.ok !== undefined && <span style={{ width: 7, height: 7, borderRadius: 'var(--r-full)', background: row.ok ? A.green : A.red, flexShrink: 0 }} />}
                {row.v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/*
        2. Stockage & sauvegarde.

        Cette carte proposait naguère « Vider le cache technique », « Réinitialiser
        la base » et un export / import JSON du localStorage. Les trois n'ont plus
        d'objet depuis que la plateforme est servie par l'API : les préfixes visés
        n'existent plus, la base est côté serveur, et l'export ne ramasserait que
        le jeton de session et une photo de profil. Des boutons qui ne font rien —
        ou pire, qui prétendent toucher la base — valent moins qu'une carte qui dit
        où sont vraiment les données. Aucune route de remise à zéro n'a été
        inventée : purger la base relève de l'exploitation, pas de cet écran.
      */}
      <div className={cardCls} style={cs}>
        <div className="flex items-center gap-2 mb-4"><HardDrive className="w-4 h-4" style={{ color: A.bordeaux }} /><h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Stockage &amp; sauvegarde</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { l: 'Dossiers en base', v: String(clientsCount) },
            { l: 'Banques partenaires', v: String(banksCount) },
            { l: 'Documents CPI publiés', v: String(docsPublies) },
            { l: 'Comptes du personnel', v: String(staff.length) },
          ].map(s => (
            <div key={s.l} className="p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: A.text }}>{s.v}</div>
              <div style={{ fontSize: '0.6875rem', color: A.muted, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.8125rem', color: A.muted, marginBottom: 12, lineHeight: 1.6 }}>
          Toutes les données de la plateforme — dossiers, demandes, pièces justificatives, documents CPI,
          banques, décaissements, chantiers, notifications et journal d'activité — sont conservées
          <strong style={{ color: A.text }}> sur le serveur</strong> (base PostgreSQL, fichiers Cloudflare R2).
          La sauvegarde et la restauration sont donc des opérations d'exploitation, réalisées côté serveur
          par vos techniciens : rien ne peut être sauvegardé ni réinitialisé depuis ce navigateur.
        </p>
        <div style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: A.text, marginBottom: 8 }}>Ce que ce navigateur conserve</div>
          {localRows.map((row, i, arr) => (
            <div key={row.k} className="flex items-start justify-between gap-3 py-2" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(99,2,16,0.06)' : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>{row.k}</div>
                <div style={{ fontSize: '0.6875rem', color: A.muted, lineHeight: 1.5 }}>{row.note}</div>
              </div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: A.muted, flexShrink: 0 }}>{row.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Accès & rôles */}
      <div className={cardCls} style={cs}>
        <div className="flex items-center gap-2 mb-4"><Key className="w-4 h-4" style={{ color: A.bordeaux }} /><h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Accès &amp; rôles</h3></div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { l: 'Clients', v: clientsCount, c: '#0E7490' },
            { l: 'Agents CPI', v: agentsCount, c: A.bordeaux },
            { l: 'Administrateurs', v: adminsCount, c: '#B45309' },
          ].map(s => (
            <div key={s.l} className="p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: '0.6875rem', color: A.muted, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: A.muted, lineHeight: 1.6 }}>
          Comptes professionnels intégrés : <strong style={{ color: A.text }}>agent@cpi.sn</strong> (Agent CPI) · <strong style={{ color: A.text }}>admin@cpi.sn</strong> (Administrateur). Les comptes créés depuis « Utilisateurs » s'ajoutent au registre. {docsPublies} document(s) CPI publié(s).
        </div>
      </div>

      {/* 5. Intégrations */}
      <div className={cardCls} style={cs}>
        <div className="flex items-center gap-2 mb-1"><Zap className="w-4 h-4" style={{ color: A.gold }} /><h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Intégrations</h3></div>
        <p style={{ fontSize: '0.75rem', color: A.muted, marginBottom: 14 }}>
          Services déjà branchés sur la plateforme, et ceux qui restent à connecter par vos techniciens.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {integrations.map(it => {
            const Icon = it.icon;
            return (
              <div key={it.label} className="flex items-center gap-3 p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: it.ok ? 'rgba(26,107,68,0.10)' : 'rgba(107,74,82,0.10)', borderRadius: 'var(--r-sm)' }}><Icon className="w-4 h-4" style={{ color: it.ok ? A.green : A.muted }} /></div>
                <div className="flex-1" style={{ minWidth: 100 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: A.text }}>{it.label}</div>
                  <div style={{ fontSize: '0.625rem', color: A.muted }}>{it.note}</div>
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: it.ok ? A.green : A.muted, background: it.ok ? 'rgba(26,107,68,0.10)' : 'rgba(107,74,82,0.10)', padding: '3px 8px', borderRadius: 'var(--r-full)', flexShrink: 0 }}>
                  {it.ok ? 'connecté' : 'à connecter'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Jeu de démonstration (POST /staff/demo/seed · DELETE /staff/demo/clear) ──
//
// Le générateur local d'antan écrivait dans le navigateur ; les 30 dossiers sont
// désormais créés EN BASE par l'API, avec leurs comptes de connexion, leurs
// pièces, leurs orientations bancaires, leurs décaissements et leurs chantiers.
// Deux garde-fous côté serveur, reflétés ici :
//   · le chargement est refusé (409) tant que des dossiers de démo subsistent —
//     d'où le bouton désactivé et la phrase qui l'explique ;
//   · la purge ne touche que les lignes préfixées « demo- ».

function DemoDataCard({ clients }: { clients: ClientSummary[] }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Toutes les clés de cache de l'application sont enracinées sur l'un de ces
  // deux préfixes : les invalider revient à rafraîchir tout ce que le jeu de
  // démonstration vient de faire apparaître ou disparaître (dossiers, pièces,
  // documents CPI, banques, décaissements, chantiers, notifications, journal).
  const invalidateEverything = () => {
    void queryClient.invalidateQueries({ queryKey: ['staff'] });
    void queryClient.invalidateQueries({ queryKey: ['client'] });
  };

  const seed = useMutation<DemoSeedResult, unknown, void>({
    mutationFn: () => staffApi.demo.seed(),
    onSuccess: invalidateEverything,
  });
  const clear = useMutation<DemoClearResult, unknown, void>({
    mutationFn: () => staffApi.demo.clear(),
    onSuccess: invalidateEverything,
  });

  // Le registre chargé par l'écran fait foi : un dossier de démonstration se
  // reconnaît à sa référence préfixée.
  const demoCount = clients.filter(c => c.ref.startsWith(DEMO_REF_PREFIX)).length;
  const busy = seed.isPending || clear.isPending;
  const error = seed.error ?? clear.error;
  const errorLabel = error
    ? apiErrorMessage(error, seed.error ? 'Chargement des données de démo impossible.' : 'Suppression des données de démo impossible.')
    : null;

  const motDePasse = seed.data?.motDePasse ?? null;

  /**
   * Suppression des données de démonstration — confirmation obligatoire.
   *
   * L'appel efface des dossiers, des comptes de connexion, des banques et des
   * entrées de journal. Il est censé ne toucher que les enregistrements
   * préfixés `DEMO-`, mais rien à l'écran ne rappelait cette portée avant de
   * cliquer, et l'opération est irréversible côté serveur.
   */
  const [confirmerPurge, setConfirmerPurge] = useState(false);
  const copyPassword = () => {
    if (!motDePasse) return;
    void navigator.clipboard.writeText(motDePasse).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => { /* presse-papiers refusé (contexte non sécurisé) : le mot de passe reste lisible à l'écran */ },
    );
  };

  return (
    <div className="bg-white p-5 sm:p-6" style={{ ...cs, borderColor: 'rgba(200,146,26,0.35)', background: 'rgba(200,146,26,0.04)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4" style={{ color: A.gold }} />
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text }}>Données de démo (test)</h3>
      </div>
      <p style={{ fontSize: '0.8125rem', color: A.muted, marginBottom: 14, lineHeight: 1.55 }}>
        Crée <strong>30 dossiers fictifs</strong> dans la base, répartis sur tout le parcours : inscription,
        pièces à vérifier, analyse bancaire, contrat à signer, chantier en cours et logement livré — avec
        leurs comptes de connexion, banques partenaires, décaissements et publications de chantier.
        Toutes ces lignes portent le préfixe <strong>« demo- »</strong> et sont supprimables à tout moment
        <strong> sans jamais toucher aux vrais dossiers</strong>.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { clear.reset(); seed.mutate(); }}
          disabled={busy || demoCount > 0}
          className="flex items-center gap-2 px-4 py-2"
          style={{
            background: busy || demoCount > 0 ? 'rgba(107,74,82,0.25)' : A.bordeaux,
            color: 'white', border: 'none', borderRadius: 'var(--r-sm)',
            fontSize: '0.8125rem', fontWeight: 700,
            cursor: busy || demoCount > 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <Database className="w-3.5 h-3.5" />
          {seed.isPending ? 'Chargement en cours…' : 'Charger 30 dossiers de démo'}
        </button>
        <button
          onClick={() => setConfirmerPurge(true)}
          disabled={busy || demoCount === 0}
          className="flex items-center gap-2 px-4 py-2"
          style={{
            border: `1px solid ${A.red}33`, borderRadius: 'var(--r-sm)',
            fontSize: '0.8125rem', fontWeight: 600,
            color: busy || demoCount === 0 ? A.muted : A.red, background: 'white',
            cursor: busy || demoCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {clear.isPending ? 'Suppression en cours…' : 'Supprimer les données de démo'}
        </button>
      </div>

      <p style={{ fontSize: '0.6875rem', color: A.muted, marginTop: 10, lineHeight: 1.5 }}>
        {demoCount > 0
          ? <><strong style={{ color: A.text }}>{demoCount} dossier(s) de démonstration</strong> sont actuellement en base. Supprimez-les avant d'en charger de nouveaux.</>
          : "Aucune donnée de démonstration en base. Le chargement peut prendre quelques secondes."}
      </p>

      {errorLabel && (
        <div className="flex items-start gap-2 mt-3" style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(192,57,43,0.08)', border: `1px solid ${A.red}33` }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: A.red, marginTop: 1 }} />
          <span style={{ fontSize: '0.8125rem', color: A.text, lineHeight: 1.5 }}>{errorLabel}</span>
        </div>
      )}

      {seed.isSuccess && seed.data && (
        <div className="mt-3" style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(26,107,68,0.08)', border: '1px solid rgba(26,107,68,0.30)' }}>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: A.green, marginTop: 1 }} />
            <span style={{ fontSize: '0.8125rem', color: A.text, lineHeight: 1.5 }}>
              <strong>{seed.data.clients} dossiers</strong> de démonstration créés, avec {seed.data.comptes} comptes
              de connexion et {seed.data.banques} banques partenaires fictives.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span style={{ fontSize: '0.75rem', color: A.muted }}>
              Connexion : l'adresse e-mail affichée sur chaque dossier, mot de passe
            </span>
            <code style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text, background: 'white', padding: '3px 8px', borderRadius: 'var(--r-sm)', border: `1px solid ${A.border}` }}>
              {seed.data.motDePasse}
            </code>
            <button
              onClick={copyPassword}
              className="flex items-center gap-1.5 px-2.5 py-1"
              style={{ border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.6875rem', fontWeight: 600, color: A.bordeaux, background: 'white', cursor: 'pointer' }}
            >
              <Copy className="w-3 h-3" /> {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>
      )}

      {clear.isSuccess && clear.data && (
        <div className="flex items-start gap-2 mt-3" style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(26,107,68,0.08)', border: '1px solid rgba(26,107,68,0.30)' }}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: A.green, marginTop: 1 }} />
          <span style={{ fontSize: '0.8125rem', color: A.text, lineHeight: 1.5 }}>
            {clear.data.clients} dossier(s), {clear.data.comptes} compte(s), {clear.data.banques} banque(s)
            et {clear.data.entreesJournal} entrée(s) de journal supprimés. Les vrais dossiers sont intacts.
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirmerPurge}
        onOpenChange={setConfirmerPurge}
        titre="Supprimer les données de démonstration ?"
        description={
          <>
            <strong style={{ color: 'var(--foreground)' }}>{demoCount} dossier(s)</strong> de démonstration
            seront supprimés, avec leurs comptes de connexion, leurs banques et leurs entrées de journal.
            Seuls les enregistrements dont la référence commence par «&nbsp;{DEMO_REF_PREFIX}&nbsp;» sont
            concernés : les vrais dossiers clients ne sont pas touchés. L'opération est définitive.
          </>
        }
        libelleConfirmer="Supprimer les données de démo"
        enCours={clear.isPending}
        onConfirmer={() => { seed.reset(); clear.mutate(undefined, { onSettled: () => setConfirmerPurge(false) }); }}
      />
    </div>
  );
}

function AdminModuleView({ activeNav, agentName }: { activeNav: string; agentName: string }) {
  // Sélecteur de client global retiré : les modules gèrent tous les clients.
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {activeNav === 'documents-clients'   && <DocumentsClientsModule agentName={agentName} />}
      {activeNav === 'documents-admin'     && <DocumentsAdminModule agentName={agentName} />}
      {activeNav === 'chantier'            && <ChantierModule agentName={agentName} />}
      {activeNav === 'decaissements'       && <DecaissementsModule />}
      {activeNav === 'notifications-agent' && <NotificationsModule agentName={agentName} />}
      {activeNav === 'historique'          && <HistoriqueModule />}
    </div>
  );
}


/**
 * Correction de la demande d'un client par le personnel CPI.
 *
 * Repliée par défaut : c'est un geste d'exception, pas une action courante.
 * Les champs sont pré-remplis à l'ouverture avec la demande réelle, et seuls
 * ceux réellement changés partent au serveur — le journal doit refléter la
 * correction, pas une réécriture complète de la demande.
 */
function CorrigerDemande({ clientId, clientNom }: { clientId: string; clientNom: string }) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const demandeQuery = useQuery({
    queryKey: ['staff', 'clients', clientId, 'demande'],
    queryFn: () => staffApi.clients.listAll().then(cs => cs.find(c => c.id === clientId)?.demande ?? null),
    enabled: ouvert,
  });
  const demande = demandeQuery.data ?? null;

  useEffect(() => {
    if (!ouvert || !demande) return;
    setForm({
      montant: demande.montant != null ? String(demande.montant) : '',
      duree: demande.duree ?? '',
      apport: demande.apport != null ? String(demande.apport) : '',
      commune: demande.commune ?? '',
      adresse_projet: demande.adresseProjet ?? '',
    });
  }, [ouvert, demande]);

  const mutation = useMutation({
    mutationFn: (payload: DemandeInput) => staffApi.clients.updateDemande(clientId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['staff', 'clients', clientId, 'demande'] });
      setOuvert(false);
    },
  });

  const enregistrer = () => {
    if (!demande) return;
    // N'envoyer que ce qui a bougé.
    const payload: DemandeInput = {};
    if (form.montant !== (demande.montant != null ? String(demande.montant) : '')) {
      payload.montant = form.montant.trim() === '' ? null : Number(form.montant);
    }
    if (form.duree !== (demande.duree ?? '')) payload.duree = form.duree;
    if (form.apport !== (demande.apport != null ? String(demande.apport) : '')) payload.apport = Number(form.apport || 0);
    if (form.commune !== (demande.commune ?? '')) payload.commune = form.commune || null;
    if (form.adresse_projet !== (demande.adresseProjet ?? '')) payload.adresse_projet = form.adresse_projet || null;

    if (Object.keys(payload).length === 0) { setOuvert(false); return; }
    mutation.mutate(payload);
  };

  const CHAMPS: Array<[string, string]> = [
    ['montant', 'Montant (FCFA)'],
    ['duree', 'Durée'],
    ['apport', 'Apport (FCFA)'],
    ['commune', 'Commune'],
    ['adresse_projet', 'Adresse du projet'],
  ];

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 16, padding: '9px 12px', borderRadius: 'var(--r-sm)', border: `1px solid ${A.border}`, background: 'white', cursor: 'pointer', textAlign: 'left' }}>
        <PenLine className="w-4 h-4" style={{ color: A.bordeaux }} />
        <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>Corriger la demande</span>
        <span style={{ fontSize: '0.6875rem', color: A.muted }}>journalisé</span>
      </button>
    );
  }

  return (
    <div style={{ marginBottom: 16, padding: 14, borderRadius: 'var(--r-sm)', border: `1px solid ${A.border}`, background: '#FAF7F7' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: A.text, marginBottom: 4 }}>Corriger la demande de {clientNom}</div>
      <div style={{ fontSize: '0.6875rem', color: A.muted, marginBottom: 10 }}>
        La correction est journalisée (ancienne et nouvelle valeur) et le client en est informé.
      </div>

      {demandeQuery.isPending ? (
        <div style={{ fontSize: '0.75rem', color: A.muted }}>Chargement…</div>
      ) : !demande ? (
        <div style={{ fontSize: '0.75rem', color: A.muted }}>Ce dossier n'a pas encore de demande.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {CHAMPS.map(([cle, label]) => (
              <label key={cle} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: A.muted }}>{label}</span>
                <input value={form[cle] ?? ''} onChange={e => setForm(f => ({ ...f, [cle]: e.target.value }))}
                  style={{ padding: '7px 9px', borderRadius: 'var(--r-sm)', border: `1px solid ${A.border}`, fontSize: '0.8125rem', color: A.text }} />
              </label>
            ))}
          </div>

          {mutation.isError && (
            <div role="alert" style={{ marginTop: 10, fontSize: '0.75rem', fontWeight: 600, color: A.red }}>
              {apiErrorMessage(mutation.error, "La correction n'a pas pu être enregistrée.")}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={enregistrer} disabled={mutation.isPending}
              style={{ padding: '7px 16px', borderRadius: 'var(--r-sm)', border: 'none', background: A.bordeaux, color: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: mutation.isPending ? 'wait' : 'pointer' }}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer la correction'}
            </button>
            <button onClick={() => setOuvert(false)} disabled={mutation.isPending}
              style={{ padding: '7px 16px', borderRadius: 'var(--r-sm)', border: `1px solid ${A.border}`, background: 'transparent', color: A.muted, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Toutes les demandes — pilotage + drawer de gestion ───────────────────────

// Libellés et couleurs viennent du registre partagé (src/app/lib/statuts.ts) :
// les tables locales avaient divergé d'un écran à l'autre.
const DOC_STATUS = STATUT_PIECE;
const CPI_STATUS = STATUT_DOC_CPI;
const cs: React.CSSProperties = { border: `1px solid ${A.border}`, borderRadius: 'var(--r-md)' };

function DemandesView({ agentName }: { agentName: string }) {
  const { navigate } = useNavigate();
  const { allClients } = useClientContext();
  const { allDocsByClient, dossierEtapes, submittedByClient, acceptDoc, refuseDoc, requestReplacement, setDossierEtape } = useDocState();
  const { allCpiDocsByClient, requestSignature, markSigned } = useCpiDocs();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'tous' | 'verifier' | 'corriger' | 'signer' | 'finalises'>('tous');
  const [sort, setSort] = useState<'urgence' | 'etape' | 'ref'>('urgence');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<{ docId: string; kind: 'refuse' | 'remplacer' } | null>(null);
  const [commentText, setCommentText] = useState('');

  // Prise en main d'un compte client.
  //
  // Le serveur l'ouvre aussi aux agents ; l'interface la réserve pour l'instant
  // aux administrateurs — d'où ce test sur le rôle, et lui seul, à changer le
  // jour où les agents y auront droit.
  // `usePermission` expose les rôles SPATIE ('super-admin'), pas les rôles
  // d'affichage de App.tsx ('admin') — les deux vocabulaires coexistent.
  const { role } = usePermission();
  const peutPrendreLaMain = role === 'super-admin';

  const impersonation = useMutation({
    // Cet écran affiche lui-même le message d'erreur : pas de toast en double.
    meta: SILENCIEUX,
    mutationFn: (userId: string) => staffApi.impersonate(userId),
    // Rechargement complet plutôt qu'une remise à zéro des contextes : toute
    // l'application (menus, requêtes, permissions) doit repartir sur le compte
    // consulté, et un rechargement le garantit sans état résiduel.
    onSuccess: () => window.location.reload(),
    onError: e => setImpersonationError(apiErrorMessage(e, 'Prise en main impossible.')),
  });
  const [impersonationError, setImpersonationError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  /**
   * Le message du serveur, tel quel, dans le canal unique de l'application.
   *
   * Cet écran avait son propre bandeau d'erreur, en plus du toast global de
   * `main.tsx` : deux messages pour un seul refus. Le repli ne sert que si le
   * serveur n'a rien dit — un 409 de transition arrive avec un texte écrit pour
   * l'agent, qui énumère ce qui est possible, et c'est celui-là qui compte.
   */
  const failWith = (fallback: string) => (e: unknown) => notifier.error(apiErrorMessage(e, fallback));

  // Banques partenaires + orientations : /staff/banks porte les deux.
  const banksQuery = useBanksQuery(true);
  const banks: Bank[] = (banksQuery.data ?? []).map(toBank);
  const assignMap = toAssignmentMap(banksQuery.data ?? []);
  const assignMutation = useAssignBank();
  const statusMutation = useSetBankStatus();
  const removeMutation = useRemoveBankAssignment();

  const rows = allClients.map(c => {
    const docs = allDocsByClient[c.id] ?? [];
    const submitted = submittedByClient[c.id] ?? false;
    const etapeCpi = dossierEtapes[c.id] ?? DOCS_VALIDES_INDEX;
    const activeStep = computeJourneyStep(submitted, docs, etapeCpi);
    const validated = docs.filter(d => d.status === 'accepte').length;
    const toVerify = docs.filter(d => d.status === 'depose' || d.status === 'verification').length;
    const hasIssue = docs.some(d => d.status === 'refuse' || d.status === 'a-remplacer');
    const cpiDocs = allCpiDocsByClient[c.id] ?? [];
    const toSign = cpiDocs.filter(d => d.visibleClient && d.signatureRequise && d.status === 'a-signer').length;
    const urgence = toVerify + toSign + (hasIssue ? 1 : 0);
    return { c, docs, cpiDocs, activeStep, etapeCpi, validated, total: docs.length, toVerify, hasIssue, toSign, urgence };
  });

  const total = rows.length;
  const finalises = rows.filter(r => r.activeStep >= SIGNATURE_INDEX).length;
  const enCours = total - finalises;
  const aTraiter = rows.reduce((n, r) => n + r.urgence, 0);

  const q = query.trim().toLowerCase();
  let list = rows.filter(r => {
    if (q && !(r.c.name.toLowerCase().includes(q) || r.c.ref.toLowerCase().includes(q))) return false;
    if (filter === 'verifier') return r.toVerify > 0;
    if (filter === 'corriger') return r.hasIssue;
    if (filter === 'signer') return r.toSign > 0;
    if (filter === 'finalises') return r.activeStep >= SIGNATURE_INDEX;
    return true;
  });
  list = [...list].sort((a, b) =>
    sort === 'ref' ? a.c.ref.localeCompare(b.c.ref)
    : sort === 'etape' ? b.activeStep - a.activeStep
    : b.urgence - a.urgence);

  const selected = rows.find(r => r.c.id === selectedId) || null;

  const submitComment = (clientId: string) => {
    if (!commentFor) return;
    if (commentFor.kind === 'refuse') refuseDoc(commentFor.docId, agentName, commentText || 'Non conforme', clientId);
    else requestReplacement(commentFor.docId, agentName, commentText || 'Merci de redéposer une version conforme', clientId);
    setCommentFor(null); setCommentText('');
    showToast(commentFor.kind === 'refuse' ? 'Pièce refusée.' : 'Remplacement demandé.');
  };

  const FILTERS: [typeof filter, string][] = [['tous', 'Tous'], ['verifier', 'À vérifier'], ['corriger', 'À corriger'], ['signer', 'À signer'], ['finalises', 'Finalisés']];
  const SORTS: [typeof sort, string][] = [['urgence', 'Urgence'], ['etape', 'Étape'], ['ref', 'Référence']];

  return (
    <div className="space-y-4" style={{ position: 'relative' }}>
      {/* Synthèse */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Total', v: total, c: A.bordeaux },
          { l: 'En cours', v: enCours, c: A.gold },
          { l: 'Finalisés', v: finalises, c: A.green },
          { l: 'Actions à traiter', v: aTraiter, c: aTraiter > 0 ? A.red : A.green },
        ].map(s => (
          <div key={s.l} className="bg-white p-4" style={cs}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: '0.75rem', color: A.muted, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Recherche + filtres + tri */}
      <div className="bg-white p-4 space-y-3" style={cs}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', background: '#FAF7F7' }}>
          <Search className="w-4 h-4" style={{ color: A.muted, flexShrink: 0 }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher (nom, n° de dossier)…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: A.text }} />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {FILTERS.map(([val, lbl]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '5px 12px', borderRadius: 'var(--r-full)', border: `1px solid ${filter === val ? A.bordeaux : A.border}`, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                  background: filter === val ? A.bordeaux : 'white', color: filter === val ? 'white' : A.muted }}>{lbl}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span style={{ fontSize: '0.6875rem', color: A.muted }}>Trier :</span>
            {SORTS.map(([val, lbl]) => (
              <button key={val} onClick={() => setSort(val)}
                style={{ padding: '4px 10px', borderRadius: 'var(--r-xs)', border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700,
                  background: sort === val ? '#F5ECEE' : 'transparent', color: sort === val ? A.bordeaux : A.muted }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {list.length === 0 ? (
        <div className="bg-white p-8 text-center" style={cs}>
          <FileText className="w-7 h-7 mx-auto mb-2" style={{ color: A.border }} />
          <div style={{ fontSize: '0.875rem', color: A.muted }}>{total === 0 ? 'Aucune demande pour le moment. Les dossiers apparaîtront dès les premières inscriptions.' : 'Aucun dossier ne correspond à ce filtre.'}</div>
        </div>
      ) : list.map(r => (
        <div key={r.c.id} className="bg-white p-4" style={cs}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0" style={{ background: '#F5ECEE', color: A.bordeaux, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', borderRadius: 'var(--r-sm)' }}>
              {r.c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1" style={{ minWidth: 180 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, fontSize: '0.9375rem' }}>{r.c.name}</div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: A.bordeaux, background: '#F5ECEE', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>Dossier {r.c.ref}</span>
                <span style={{ fontSize: '0.75rem', color: A.muted }}>{r.c.projectNom}</span>
              </div>
              {/* Barre de progression 6 étapes */}
              <div className="flex gap-1 mt-2" title={TIMELINE_STEPS[r.activeStep]?.label}>
                {TIMELINE_STEPS.map((s, i) => (
                  <div key={i} className="flex-1 h-1.5" style={{ background: i <= r.activeStep ? (r.activeStep >= SIGNATURE_INDEX ? A.green : A.bordeaux) : '#EDE4E6', borderRadius: 'var(--r-full)' }} />
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: A.bordeaux, background: '#F5ECEE', padding: '3px 9px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>Étape {r.activeStep + 1}/6 · {TIMELINE_STEPS[r.activeStep]?.label}</span>
              <div className="flex gap-2 flex-wrap justify-end">
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.green }}>{r.validated}/{r.total} pièces</span>
                {r.toVerify > 0 && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.gold }}>· {r.toVerify} à vérifier</span>}
                {r.hasIssue && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.red }}>· à corriger</span>}
                {r.toSign > 0 && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.bordeaux }}>· {r.toSign} à signer</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={() => setSelectedId(r.c.id)} className="flex items-center gap-1 px-3 py-1.5"
              style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              Ouvrir le dossier <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => navigate('documents-clients')} className="px-3 py-1.5"
              style={{ background: 'white', color: A.bordeaux, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Gérer les pièces</button>
            <button onClick={() => navigate('documents-admin')} className="px-3 py-1.5"
              style={{ background: 'white', color: A.bordeaux, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Documents CPI</button>
          </div>
        </div>
      ))}

      {/* Drawer latéral de gestion */}
      {selected && (
        <Modal
          open
          onClose={() => { setSelectedId(null); setCommentFor(null); }}
          titre={`Gestion du dossier ${selected.c.ref} — ${selected.c.name}`}
          sansCroix
          largeur="min(460px, 100%)"
          className="p-5 cpi-drawer-enter"
          // Tiroir plaqué à droite : Radix positionne le panneau, la mise en
          // page reste celle d'avant.
          style={{ position: 'fixed', top: 0, right: 0, height: '100%', maxHeight: '100%', borderRadius: 0, border: 'none', boxShadow: '-8px 0 32px rgba(0,0,0,0.18)' }}
        >
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem', color: A.text }}>{selected.c.name}</div>
                <div style={{ fontSize: '0.75rem', color: A.muted }}>{selected.c.ref} · {selected.c.projectNom}</div>
              </div>
              <button onClick={() => { setSelectedId(null); setCommentFor(null); }} style={{ background: '#FAF7F7', border: 'none', borderRadius: 'var(--r-sm)', padding: 6, cursor: 'pointer' }}><X className="w-4 h-4" style={{ color: A.muted }} /></button>
            </div>

            {/* Prise en main — administrateurs uniquement pour l'instant.
                Un dossier créé par le personnel n'a pas de compte de connexion
                (userId absent) : il n'y a alors rien à consulter. */}
            {peutPrendreLaMain && (
              selected.c.userId ? (
                <button
                  onClick={() => impersonation.mutate(selected.c.userId as string)}
                  disabled={impersonation.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 14, padding: '9px 12px', borderRadius: 'var(--r-sm)', border: `1px solid ${A.border}`, background: '#FAF7F7', cursor: impersonation.isPending ? 'wait' : 'pointer', textAlign: 'left' }}
                >
                  {impersonation.isPending
                    ? <Loader2 className="w-4 h-4" style={{ color: A.bordeaux, animation: 'spin 0.8s linear infinite' }} />
                    : <Eye className="w-4 h-4" style={{ color: A.bordeaux }} />}
                  <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>
                    Voir son espace client
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: A.muted }}>consultation</span>
                </button>
              ) : (
                <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FAF7F7', fontSize: '0.75rem', color: A.muted }}>
                  Dossier sans compte de connexion — espace client inexistant.
                </div>
              )
            )}

            {impersonationError && (
              <div role="alert" style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: 'rgba(192,57,43,0.08)', border: `1px solid ${A.red}40`, fontSize: '0.75rem', fontWeight: 600, color: A.red }}>
                {impersonationError}
              </div>
            )}

            {/* Parcours + étape */}
            <div className="p-3 mb-4" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: A.text }}>Étape {selected.activeStep + 1}/6 · {TIMELINE_STEPS[selected.activeStep]?.label}</span>
              </div>
              <div className="flex gap-1 mb-3">
                {TIMELINE_STEPS.map((s, i) => (
                  <div key={i} className="flex-1 h-1.5" style={{ background: i <= selected.activeStep ? (selected.activeStep >= SIGNATURE_INDEX ? A.green : A.bordeaux) : '#EDE4E6', borderRadius: 'var(--r-full)' }} />
                ))}
              </div>
              <div style={{ fontSize: '0.6875rem', color: A.muted, marginBottom: 6 }}>Faire avancer le dossier :</div>
              <div className="flex gap-2 flex-wrap">
                {[3, 4, 5].map(e => (
                  <button key={e} onClick={() => setDossierEtape(e, agentName, selected.c.id, () => showToast('Étape mise à jour.'))}
                    style={{ padding: '5px 10px', borderRadius: 'var(--r-sm)', border: `1px solid ${selected.etapeCpi === e ? A.bordeaux : A.border}`, cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700,
                      background: selected.etapeCpi === e ? A.bordeaux : 'white', color: selected.etapeCpi === e ? 'white' : A.text }}>
                    → {TIMELINE_STEPS[e]?.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Correction de la demande — le client perd la main dès l'étape
                « Analyse », l'agent la garde pour rattraper une coquille. */}
            <CorrigerDemande clientId={selected.c.id} clientNom={selected.c.name} />

            {/* Pièces */}
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Pièces justificatives</div>
            <div className="space-y-2 mb-4">
              {selected.docs.length === 0 ? <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucune pièce.</div> : selected.docs.map(d => {
                const st = DOC_STATUS[d.status] ?? DOC_STATUS['en-attente'];
                const canAct = d.status === 'depose' || d.status === 'verification';
                return (
                  <div key={d.id} className="p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: A.text }}>{d.label}</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: st.color, background: `${st.color}14`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{st.label}</span>
                    </div>
                    {d.commentaire && <div style={{ fontSize: '0.6875rem', color: A.muted, marginTop: 4 }}>« {d.commentaire} »</div>}
                    {canAct && commentFor?.docId !== d.id && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button onClick={() => { acceptDoc(d.id, agentName, selected.c.id); showToast('Pièce validée.'); }}
                          className="flex items-center gap-1 px-2.5 py-1" style={{ background: A.green, color: 'white', border: 'none', borderRadius: 'var(--r-xs)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><CheckCircle2 className="w-3 h-3" /> Valider</button>
                        <button onClick={() => { setCommentFor({ docId: d.id, kind: 'refuse' }); setCommentText(''); }}
                          className="flex items-center gap-1 px-2.5 py-1" style={{ background: 'white', color: A.red, border: `1px solid ${A.red}30`, borderRadius: 'var(--r-xs)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><XCircle className="w-3 h-3" /> Refuser</button>
                        <button onClick={() => { setCommentFor({ docId: d.id, kind: 'remplacer' }); setCommentText(''); }}
                          className="flex items-center gap-1 px-2.5 py-1" style={{ background: 'white', color: A.gold, border: `1px solid ${A.gold}30`, borderRadius: 'var(--r-xs)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><RefreshCw className="w-3 h-3" /> Remplacement</button>
                      </div>
                    )}
                    {commentFor?.docId === d.id && (
                      <div className="mt-2">
                        <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={2}
                          placeholder={commentFor.kind === 'refuse' ? 'Motif du refus…' : 'Précisez ce qui doit être corrigé…'}
                          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', padding: 8, fontSize: '0.75rem', outline: 'none', resize: 'vertical' }} />
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => submitComment(selected.c.id)} className="px-3 py-1" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-xs)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}>Confirmer</button>
                          <button onClick={() => { setCommentFor(null); setCommentText(''); }} className="px-3 py-1" style={{ background: 'white', color: A.muted, border: `1px solid ${A.border}`, borderRadius: 'var(--r-xs)', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Documents CPI */}
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Documents CPI</div>
            <div className="space-y-2 mb-4">
              {selected.cpiDocs.length === 0 ? <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucun document CPI.</div> : selected.cpiDocs.map(d => {
                const st = CPI_STATUS[d.status] ?? CPI_STATUS.brouillon;
                return (
                  <div key={d.id} className="p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: A.text }}>{d.nom}</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: st.color, background: `${st.color}14`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{st.label}</span>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {d.status !== 'a-signer' && d.status !== 'signe' && (
                        <button onClick={() => { requestSignature(d.id, agentName, selected.c.id); showToast('Signature demandée.'); }}
                          className="flex items-center gap-1 px-2.5 py-1" style={{ background: 'white', color: A.bordeaux, border: `1px solid ${A.border}`, borderRadius: 'var(--r-xs)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><PenLine className="w-3 h-3" /> Demander signature</button>
                      )}
                      {d.status === 'a-signer' && (
                        <button onClick={() => { markSigned(d.id, agentName, selected.c.id); showToast('Document marqué signé.'); }}
                          className="flex items-center gap-1 px-2.5 py-1" style={{ background: A.green, color: 'white', border: 'none', borderRadius: 'var(--r-xs)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><CheckCircle2 className="w-3 h-3" /> Marquer signé</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Orientation banques partenaires */}
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Orientation banques</div>
            {(() => {
              const clientId = selected.c.id;
              const assigned = assignMap[clientId] ?? [];
              const available = banks.filter(b => !assigned.some(a => a.bankId === b.id));
              const busy = assignMutation.isPending || statusMutation.isPending || removeMutation.isPending;
              return (
                <div className="space-y-2 mb-4">
                  {banksQuery.isPending && <div style={{ fontSize: '0.8125rem', color: A.muted }}>Chargement des banques partenaires…</div>}
                  {banksQuery.isError && (
                    <div style={{ fontSize: '0.8125rem', color: A.red }}>
                      {apiErrorMessage(banksQuery.error, 'Impossible de charger les banques partenaires.')}{' '}
                      <button onClick={() => { void banksQuery.refetch(); }} style={{ background: 'transparent', border: 'none', color: A.bordeaux, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Réessayer</button>
                    </div>
                  )}
                  {!banksQuery.isPending && !banksQuery.isError && banks.length === 0 && <div style={{ fontSize: '0.8125rem', color: A.muted }}>Aucune banque partenaire enregistrée. Ajoutez-en dans « Partenaires ».</div>}
                  {assigned.map(a => {
                    const st = STATUT_BANQUE[a.status];
                    return (
                      <div key={a.bankId} className="p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>{a.bankName}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: st.color, background: `${st.color}14`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{st.label}</span>
                            <button disabled={busy} onClick={() => removeMutation.mutate({ clientId, bankId: a.bankId }, {
                              onSuccess: () => showToast('Orientation retirée.'),
                              onError: failWith("Le retrait de l'orientation a échoué."),
                            })} style={{ background: 'white', border: `1px solid ${A.border}`, borderRadius: 'var(--r-xs)', padding: 4, cursor: 'pointer' }}><X className="w-3 h-3" style={{ color: A.muted }} /></button>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {(Object.keys(STATUT_BANQUE) as BankStatus[]).map(s => (
                            <button key={s} disabled={busy} onClick={() => statusMutation.mutate({ clientId, bankId: a.bankId, status: s }, {
                              onSuccess: () => {
                                showToast('Statut mis à jour.');
                              },
                              onError: failWith('La mise à jour du statut a échoué.'),
                            })}
                              style={{ padding: '3px 10px', borderRadius: 'var(--r-xs)', border: `1px solid ${a.status === s ? STATUT_BANQUE[s].color : A.border}`, cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700, background: a.status === s ? STATUT_BANQUE[s].color : 'white', color: a.status === s ? 'white' : A.muted }}>{STATUT_BANQUE[s].label}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {available.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {available.map(b => (
                        <button key={b.id} disabled={busy} onClick={() => assignMutation.mutate({ clientId, bankId: b.id }, {
                          onSuccess: () => {
                            showToast(`Dossier orienté vers ${b.name}.`);
                          },
                          onError: failWith("L'orientation du dossier a échoué."),
                        })}
                          className="flex items-center gap-1 px-2.5 py-1.5" style={{ background: 'white', color: b.color, border: `1px solid ${b.color}40`, borderRadius: 'var(--r-sm)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><Plus className="w-3 h-3" /> {b.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Raccourcis modules */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigate('documents-clients')} className="flex-1 px-3 py-2" style={{ background: '#FAF7F7', color: A.bordeaux, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Ouvrir Documents clients</button>
              <button onClick={() => navigate('documents-admin')} className="flex-1 px-3 py-2" style={{ background: '#FAF7F7', color: A.bordeaux, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Ouvrir Documents CPI</button>
            </div>
          </>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: A.text, color: 'white', padding: '10px 18px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, zIndex: 70, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast}</div>
      )}
    </div>
  );
}

// ─── Utilisateurs — vue 3 rôles + ajout d'utilisateur ─────────────────────────

const ROLE_CFG: Record<string, { label: string; color: string }> = {
  client:      { label: 'Client',         color: A.bordeaux },
  'agent-cpi': { label: 'Agent CPI',      color: A.gold },
  admin:       { label: 'Administrateur', color: A.green },
};

function UsersView({ agentName }: { agentName: string }) {
  const { navigate } = useNavigate();
  const { allDocsByClient, dossierEtapes, submittedByClient, pushNotification } = useDocState();
  const { allClients } = useClientContext();

  // Registre réel : dossiers clients et comptes du personnel viennent de l'API.
  const staffQuery   = useStaffQuery(true);
  const createClient = useCreateClient();
  const createStaff  = useCreateStaff();

  const clients: ClientSummary[] = allClients;
  const staff: StaffAccount[] = (staffQuery.data ?? []).map(toStaffAccount);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'tous' | 'clients' | 'personnel'>('tous');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ role: 'client' | 'agent-cpi' | 'admin'; name: string; email: string; phone: string }>({ role: 'client', name: '', email: '', phone: '' });
  const [creds, setCreds] = useState<{ name: string; roleLabel: string; email: string; password?: string; ref?: string; message: string } | null>(null);
  const [notifyFor, setNotifyFor] = useState<{ id: string; name: string } | null>(null);
  const [notifyText, setNotifyText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const allStaff = staff;

  const clientRows = clients.map(c => {
    const docs = allDocsByClient[c.id] ?? [];
    const submitted = submittedByClient[c.id] ?? false;
    const etapeCpi = dossierEtapes[c.id] ?? DOCS_VALIDES_INDEX;
    return { c, activeStep: computeJourneyStep(submitted, docs, etapeCpi) };
  });

  const nbClients = clients.length;
  const nbAgents = allStaff.filter(s => s.role === 'agent-cpi').length;
  const nbAdmins = allStaff.filter(s => s.role === 'admin').length;

  const q = query.trim().toLowerCase();
  const showClients = roleFilter === 'tous' || roleFilter === 'clients';
  const showPersonnel = roleFilter === 'tous' || roleFilter === 'personnel';
  const filteredClients = showClients ? clientRows.filter(r => !q || r.c.name.toLowerCase().includes(q) || r.c.ref.toLowerCase().includes(q)) : [];
  const filteredStaff = showPersonnel ? allStaff.filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) : [];
  const emptyList = filteredClients.length === 0 && filteredStaff.length === 0;

  const roleLabel = (r: string) => ROLE_CFG[r]?.label ?? 'Client';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Création réelle via l'API : la référence de dossier et le mot de passe
  // provisoire sont générés côté serveur.
  const creating = createClient.isPending || createStaff.isPending;

  const addUser = () => {
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email) { showToast('Nom et e-mail requis.'); return; }
    if (creating) return;
    const role = form.role;
    const finish = () => {
      setShowAdd(false);
      setForm({ role: 'client', name: '', email: '', phone: '' });
      showToast('Utilisateur créé.');
    };

    if (role === 'client') {
      createClient.mutate(
        { name, email, phone: form.phone.trim() },
        {
          onSuccess: created => {
            const message = `Bonjour ${name},\n\nVotre espace client CPI Immobilier a été créé.\n\nConnexion : ${origin}\n→ « Accéder à mon espace », onglet « Espace client »\nConnectez-vous avec votre nom : ${name}\nNuméro de dossier : ${created.ref}\n\nL'équipe CPI`;
            setCreds({ name, roleLabel: 'Client', email, ref: created.ref, message });
            finish();
          },
          onError: e => showToast(apiErrorMessage(e, 'La création du dossier client a échoué.')),
        },
      );
      return;
    }

    createStaff.mutate(
      { name, email, role },
      {
        onSuccess: ({ temporaryPassword }) => {
          const message = `Bonjour ${name},\n\nVotre accès professionnel CPI Immobilier (${roleLabel(role)}) a été créé.\n\nConnexion : ${origin}\n→ « Espace professionnel CPI »\nIdentifiant : ${email}\nMot de passe provisoire : ${temporaryPassword}\n\nMerci de le changer à la première connexion.\nL'équipe CPI`;
          setCreds({ name, roleLabel: roleLabel(role), email, password: temporaryPassword, message });
          finish();
        },
        onError: e => showToast(apiErrorMessage(e, 'La création du compte professionnel a échoué.')),
      },
    );
  };

  const sendEmail = () => {
    if (!creds) return;
    const url = `mailto:${creds.email}?subject=${encodeURIComponent('Vos accès CPI Immobilier')}&body=${encodeURIComponent(creds.message)}`;
    const a = document.createElement('a');
    a.href = url; a.click();
  };
  const copyCreds = () => {
    if (!creds) return;
    try { navigator.clipboard?.writeText(creds.message); showToast('Identifiants copiés.'); } catch { showToast('Copie indisponible.'); }
  };
  const sendNotify = () => {
    if (!notifyFor || !notifyText.trim()) return;
    pushNotification(notifyFor.id, notifyText.trim(), 'Notification', agentName);
    setNotifyFor(null); setNotifyText('');
    showToast('Notification envoyée.');
  };

  const initials = (n: string) => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  const FROLE: [typeof roleFilter, string][] = [['tous', 'Tous'], ['clients', 'Clients'], ['personnel', 'Personnel CPI']];

  return (
    <div className="space-y-4" style={{ position: 'relative' }}>
      {/* En-tête + ajout */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p style={{ fontSize: '0.875rem', color: A.muted, margin: 0 }}>Tous les utilisateurs de la plateforme — clients et personnel CPI.</p>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2"
          style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
          <UserPlus className="w-4 h-4" /> Ajouter un utilisateur
        </button>
      </div>

      {/* Répartition par rôle */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Clients', v: nbClients, c: A.bordeaux, icon: Users },
          { l: 'Agents CPI', v: nbAgents, c: A.gold, icon: Shield },
          { l: 'Administrateurs', v: nbAdmins, c: A.green, icon: Server },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.l} className="bg-white p-4" style={cs}>
              <div className="w-8 h-8 flex items-center justify-center mb-2" style={{ background: `${s.c}12`, borderRadius: 'var(--r-sm)' }}><Icon className="w-4 h-4" style={{ color: s.c }} /></div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: A.text }}>{s.v}</div>
              <div style={{ fontSize: '0.75rem', color: A.muted }}>{s.l}</div>
            </div>
          );
        })}
      </div>

      {/* Recherche + filtre rôle */}
      <div className="bg-white p-4 space-y-3" style={cs}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', background: '#FAF7F7' }}>
          <Search className="w-4 h-4" style={{ color: A.muted, flexShrink: 0 }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher (nom, e-mail, n° de dossier)…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: A.text }} />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FROLE.map(([val, lbl]) => (
            <button key={val} onClick={() => setRoleFilter(val)}
              style={{ padding: '5px 12px', borderRadius: 'var(--r-full)', border: `1px solid ${roleFilter === val ? A.bordeaux : A.border}`, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                background: roleFilter === val ? A.bordeaux : 'white', color: roleFilter === val ? 'white' : A.muted }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {emptyList ? (
        <div className="bg-white p-8 text-center" style={cs}>
          <Users className="w-7 h-7 mx-auto mb-2" style={{ color: A.border }} />
          <div style={{ fontSize: '0.875rem', color: A.muted }}>Aucun utilisateur ne correspond.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Clients */}
          {filteredClients.map(r => (
            <div key={r.c.id} className="bg-white p-4 flex items-center gap-4 flex-wrap" style={cs}>
              <div className="w-10 h-10 flex items-center justify-center text-white flex-shrink-0" style={{ background: A.bordeaux, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.8125rem', borderRadius: 'var(--r-sm)' }}>{initials(r.c.name)}</div>
              <div className="flex-1" style={{ minWidth: 180 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, fontSize: '0.9375rem' }}>{r.c.name}</span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.bordeaux, background: `${A.bordeaux}12`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>Client</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: A.muted, marginTop: 2 }}>{r.c.ref}{r.c.dateInscription ? ` · inscrit le ${r.c.dateInscription}` : ''}</div>
              </div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: r.activeStep >= SIGNATURE_INDEX ? A.green : A.gold, background: '#F5ECEE', padding: '3px 9px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>{TIMELINE_STEPS[r.activeStep]?.label}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => navigate('demandes')} className="px-3 py-1.5" style={{ background: 'white', color: A.bordeaux, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Voir le dossier</button>
                <button onClick={() => { setNotifyFor({ id: r.c.id, name: r.c.name }); setNotifyText(''); }} className="flex items-center gap-1 px-3 py-1.5" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}><Bell className="w-3.5 h-3.5" /> Notifier</button>
              </div>
            </div>
          ))}
          {/* Personnel */}
          {filteredStaff.map(s => {
            const cfg = ROLE_CFG[s.role];
            return (
              <div key={s.email} className="bg-white p-4 flex items-center gap-4 flex-wrap" style={cs}>
                <div className="w-10 h-10 flex items-center justify-center text-white flex-shrink-0" style={{ background: cfg.color, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.8125rem', borderRadius: 'var(--r-sm)' }}>{initials(s.name)}</div>
                <div className="flex-1" style={{ minWidth: 180 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: A.text, fontSize: '0.9375rem' }}>{s.name}</span>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, color: cfg.color, background: `${cfg.color}12`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: A.muted, marginTop: 2 }}>{s.email}</div>
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: A.muted, background: '#FAF7F7', padding: '3px 9px', borderRadius: 'var(--r-full)' }}>Compte CPI</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: A.green }}>● Actif</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale : ajouter un utilisateur */}
      {showAdd && (
        <Modal open onClose={() => setShowAdd(false)} sansCroix titre="Ajouter un utilisateur" largeur={440} className="p-5">
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem', color: A.text }}>Ajouter un utilisateur</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: '#FAF7F7', border: 'none', borderRadius: 'var(--r-sm)', padding: 6, cursor: 'pointer' }}><X className="w-4 h-4" style={{ color: A.muted }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>Rôle</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {(['client', 'agent-cpi', 'admin'] as const).map(rr => (
                    <button key={rr} onClick={() => setForm(f => ({ ...f, role: rr }))}
                      style={{ padding: '6px 12px', borderRadius: 'var(--r-sm)', border: `1px solid ${form.role === rr ? A.bordeaux : A.border}`, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                        background: form.role === rr ? A.bordeaux : 'white', color: form.role === rr ? 'white' : A.text }}>{ROLE_CFG[rr].label}</button>
                  ))}
                </div>
              </div>
              {[
                { k: 'name', label: 'Nom complet *', ph: 'Prénom Nom' },
                { k: 'email', label: 'E-mail *', ph: 'personne@email.com' },
                { k: 'phone', label: 'Téléphone', ph: '+221 7X XXX XX XX' },
              ].map(fld => (
                <div key={fld.k}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>{fld.label}</label>
                  <input value={(form as any)[fld.k]} onChange={e => setForm(f => ({ ...f, [fld.k]: e.target.value }))} placeholder={fld.ph}
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', padding: '9px 12px', fontSize: '0.875rem', outline: 'none' }} />
                </div>
              ))}
              {form.role !== 'client' && (
                <div style={{ fontSize: '0.75rem', color: A.muted, background: '#FAF7F7', padding: 10, borderRadius: 'var(--r-sm)' }}>
                  Un <strong>mot de passe provisoire</strong> sera généré pour ce compte professionnel.
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={addUser} className="flex-1 px-4 py-2" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>Créer le compte</button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2" style={{ background: 'white', color: A.muted, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
              </div>
            </div>
          </>
        </Modal>
      )}

      {/* Modale : identifiants à transmettre */}
      {creds && (
        <Modal open onClose={() => setCreds(null)} sansCroix titre="Compte créé — identifiants à transmettre" largeur={460} zIndex={310} className="p-5">
          <>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5" style={{ color: A.green }} />
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem', color: A.text }}>Compte créé — identifiants à transmettre</h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: A.muted, marginBottom: 12 }}>{creds.name} · {creds.roleLabel}</p>
            <div className="space-y-2 mb-3">
              {creds.password ? (
                <>
                  <div className="flex items-center justify-between p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}><span style={{ fontSize: '0.75rem', color: A.muted }}>Identifiant</span><span style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text }}>{creds.email}</span></div>
                  <div className="flex items-center justify-between p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}><span style={{ fontSize: '0.75rem', color: A.muted }}>Mot de passe</span><span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: A.bordeaux }}>{creds.password}</span></div>
                </>
              ) : (
                <div className="p-3" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: A.muted }}>Accès : Espace client (connexion par nom)</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: A.text, marginTop: 2 }}>Dossier {creds.ref}</div>
                </div>
              )}
            </div>
            <textarea readOnly value={creds.message} rows={6}
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', padding: 10, fontSize: '0.75rem', color: A.text, background: '#FAFAFA', resize: 'vertical' }} />
            <div style={{ fontSize: '0.6875rem', color: A.muted, margin: '8px 0' }}>
              ⚠️ L'envoi automatique par e-mail nécessitera un backend. Utilisez « Copier » ou « Envoyer par e-mail » (ouvre votre messagerie).
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={copyCreds} className="flex items-center gap-1 px-3 py-2" style={{ background: 'white', color: A.bordeaux, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}><Copy className="w-3.5 h-3.5" /> Copier</button>
              <button onClick={sendEmail} className="flex items-center gap-1 px-3 py-2" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}><Mail className="w-3.5 h-3.5" /> Envoyer par e-mail</button>
              <button onClick={() => setCreds(null)} className="ml-auto px-3 py-2" style={{ background: 'white', color: A.muted, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Fermer</button>
            </div>
          </>
        </Modal>
      )}

      {/* Modale : notifier un client */}
      {notifyFor && (
        <Modal open onClose={() => setNotifyFor(null)} sansCroix titre="Notifier le client" largeur={420} zIndex={310} className="p-5">
          <>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.0625rem', color: A.text, marginBottom: 4 }}>Notifier {notifyFor.name}</h3>
            <p style={{ fontSize: '0.75rem', color: A.muted, marginBottom: 10 }}>Le message apparaîtra dans l'espace Notifications du client.</p>
            <textarea value={notifyText} onChange={e => setNotifyText(e.target.value)} rows={3} placeholder="Votre message…"
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', padding: 10, fontSize: '0.8125rem', outline: 'none', resize: 'vertical' }} />
            <div className="flex gap-2 mt-3">
              <button onClick={sendNotify} className="flex-1 px-4 py-2" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>Envoyer</button>
              <button onClick={() => setNotifyFor(null)} className="px-4 py-2" style={{ background: 'white', color: A.muted, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
            </div>
          </>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: A.text, color: 'white', padding: '10px 18px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, zIndex: 70, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast}</div>
      )}
    </div>
  );
}

// ─── Partenaires — registre des banques partenaires ───────────────────────────

const PRODUCT_OPTIONS = ['Fonctionnaire', 'Secteur privé', 'Diaspora', 'Terrain', 'Construction'];

function PartnersView() {
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Bank | null>(null);
  const [form, setForm] = useState<{ name: string; conventionDate: string; validity: string; products: string[]; rate: string; contact: string; color: string }>({ name: '', conventionDate: '', validity: '', products: [], rate: '', contact: '', color: BANK_COLORS[0] });
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const failWith = (fallback: string) => (e: unknown) => notifier.error(apiErrorMessage(e, fallback));

  // /staff/banks : registre + orientations en un seul appel.
  const banksQuery = useBanksQuery(true);
  const banks: Bank[] = (banksQuery.data ?? []).map(toBank);
  const assignments = toAssignmentMap(banksQuery.data ?? []);
  const createMutation = useCreateBank();
  const deleteMutation = useDeleteBank();

  const now = new Date();
  const countForBank = (bankId: string) => Object.values(assignments).flat().filter(a => a.bankId === bankId).length;
  const accordsForBank = (bankId: string) => Object.values(assignments).flat().filter(a => a.bankId === bankId && a.status === 'accord').length;

  const activeCount = banks.filter(b => isBankActive(b, now)).length;

  const addBank = () => {
    const name = form.name.trim();
    if (!name) { showToast('Le nom de la banque est requis.'); return; }
    createMutation.mutate({
      name,
      convention_date: form.conventionDate.trim() || null,
      validity: form.validity.trim() || null,
      products: form.products,
      rate: form.rate.trim() || null,
      contact: form.contact.trim() || null,
      color: form.color,
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setForm({ name: '', conventionDate: '', validity: '', products: [], rate: '', contact: '', color: BANK_COLORS[0] });
        showToast('Banque partenaire ajoutée.');
      },
      onError: failWith("L'ajout de la banque a échoué."),
    });
  };

  const removeBank = () => {
    if (!confirmDel) return;
    deleteMutation.mutate(confirmDel.id, {
      onSuccess: () => {
        setConfirmDel(null);
        showToast('Banque retirée.');
      },
      onError: failWith('Le retrait de la banque a échoué.'),
    });
  };

  const toggleProduct = (p: string) => setForm(f => ({ ...f, products: f.products.includes(p) ? f.products.filter(x => x !== p) : [...f.products, p] }));

  if (banksQuery.isPending) {
    return (
      <div className="bg-white p-8 text-center" style={cs}>
        <Landmark className="w-7 h-7 mx-auto mb-2" style={{ color: A.border }} />
        <div style={{ fontSize: '0.875rem', color: A.muted }}>Chargement des banques partenaires…</div>
      </div>
    );
  }

  if (banksQuery.isError) {
    return (
      <div className="bg-white p-8 text-center" style={cs}>
        <div style={{ fontSize: '0.875rem', color: A.red, marginBottom: 12 }}>{apiErrorMessage(banksQuery.error, 'Impossible de charger les banques partenaires.')}</div>
        <button onClick={() => { void banksQuery.refetch(); }} className="px-4 py-2" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>Réessayer</button>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ position: 'relative' }}>
      {/* En-tête + ajout */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p style={{ fontSize: '0.875rem', color: A.muted, margin: 0 }}>Banques partenaires de financement. Chaque banque ajoutée ici est vue automatiquement par les autres espaces (client, agent, décaissements).</p>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
          <Plus className="w-4 h-4" /> Ajouter une banque
        </button>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Banques partenaires', v: banks.length, c: A.bordeaux, icon: Landmark },
          { l: 'Conventions actives', v: activeCount, c: A.green, icon: Shield },
          { l: 'Dossiers orientés', v: Object.values(assignments).flat().length, c: A.gold, icon: ArrowRight },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.l} className="bg-white p-4" style={cs}>
              <div className="w-8 h-8 flex items-center justify-center mb-2" style={{ background: `${s.c}12`, borderRadius: 'var(--r-sm)' }}><Icon className="w-4 h-4" style={{ color: s.c }} /></div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: A.text }}>{s.v}</div>
              <div style={{ fontSize: '0.75rem', color: A.muted }}>{s.l}</div>
            </div>
          );
        })}
      </div>

      {/* CPI — promoteur (référence, pas une banque) */}
      <div className="bg-white p-4 flex items-center gap-3" style={cs}>
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: `${A.bordeaux}12`, border: `2px solid ${A.bordeaux}25`, borderRadius: 'var(--r-sm)' }}><Building2 className="w-5 h-5" style={{ color: A.bordeaux }} /></div>
        <div className="flex-1">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: A.text }}>CPI Immobilier</div>
          <div style={{ fontSize: '0.75rem', color: A.muted }}>Promoteur immobilier — orchestrateur des dossiers</div>
        </div>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: A.bordeaux, background: '#F5ECEE', padding: '3px 10px', borderRadius: 'var(--r-full)' }}>Interne</span>
      </div>

      {/* Banques */}
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Banques partenaires</div>
      {banks.length === 0 ? (
        <div className="bg-white p-8 text-center" style={cs}>
          <Landmark className="w-7 h-7 mx-auto mb-2" style={{ color: A.border }} />
          <div style={{ fontSize: '0.875rem', color: A.muted, marginBottom: 12 }}>Aucune banque partenaire pour le moment.<br />Ajoutez une banque dès qu'une convention est signée — elle apparaîtra partout.</div>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}><Plus className="w-4 h-4" /> Ajouter une banque</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {banks.map(b => {
            const active = isBankActive(b, now);
            return (
              <div key={b.id} className="bg-white p-4" style={cs}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 flex items-center justify-center text-white flex-shrink-0" style={{ background: b.color, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', borderRadius: 'var(--r-sm)' }}>{b.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.0625rem', color: A.text }}>{b.name}</span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: active ? A.green : A.red, background: active ? 'rgba(26,107,68,0.1)' : 'rgba(192,57,43,0.1)', padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{active ? 'Convention active' : 'Convention expirée'}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: A.muted, marginTop: 2 }}>Signée le {b.conventionDate} · valable jusqu'au {b.validity}</div>
                  </div>
                  <button onClick={() => setConfirmDel(b)} style={{ background: 'white', border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', padding: 6, cursor: 'pointer' }} title="Retirer"><Trash2 className="w-3.5 h-3.5" style={{ color: A.red }} /></button>
                </div>
                {b.products.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {b.products.map(p => <span key={p} style={{ fontSize: '0.625rem', fontWeight: 700, color: b.color, background: `${b.color}14`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{p}</span>)}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Taux indicatif', value: b.rate },
                    { label: 'Dossiers orientés', value: String(countForBank(b.id)) },
                    { label: 'Accords', value: String(accordsForBank(b.id)) },
                  ].map(s => (
                    <div key={s.label} className="p-2.5 text-center" style={{ background: '#FAF7F7', borderRadius: 'var(--r-sm)' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: A.text }}>{s.value}</div>
                      <div style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: A.muted }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {b.contact !== '—' && <div style={{ fontSize: '0.75rem', color: A.muted, marginTop: 10 }}>Contact : {b.contact}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale : ajouter une banque */}
      {showAdd && (
        <Modal open onClose={() => setShowAdd(false)} sansCroix titre="Ajouter une banque partenaire" largeur={480} className="p-5">
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem', color: A.text }}>Ajouter une banque partenaire</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: '#FAF7F7', border: 'none', borderRadius: 'var(--r-sm)', padding: 6, cursor: 'pointer' }}><X className="w-4 h-4" style={{ color: A.muted }} /></button>
            </div>
            <div className="space-y-3">
              {[
                { k: 'name', label: 'Nom de la banque *', ph: 'Ex. Banque de l\'Habitat' },
                { k: 'conventionDate', label: 'Date de signature de la convention', ph: 'Ex. 25 juillet 2026' },
                { k: 'validity', label: 'Valable jusqu\'au', ph: 'Ex. 24 juillet 2027' },
                { k: 'rate', label: 'Taux indicatif', ph: 'Ex. 8,50%' },
                { k: 'contact', label: 'Contact (téléphone / e-mail)', ph: 'Ex. financement@banque.sn' },
              ].map(fld => (
                <div key={fld.k}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>{fld.label}</label>
                  <input value={(form as any)[fld.k]} onChange={e => setForm(f => ({ ...f, [fld.k]: e.target.value }))} placeholder={fld.ph}
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', padding: '9px 12px', fontSize: '0.875rem', outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>Produits de financement</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {PRODUCT_OPTIONS.map(p => (
                    <button key={p} onClick={() => toggleProduct(p)}
                      style={{ padding: '5px 10px', borderRadius: 'var(--r-full)', border: `1px solid ${form.products.includes(p) ? A.bordeaux : A.border}`, cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700, background: form.products.includes(p) ? A.bordeaux : 'white', color: form.products.includes(p) ? 'white' : A.muted }}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: A.text }}>Couleur d'identité</label>
                <div className="flex gap-2 mt-1">
                  {BANK_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: c, border: form.color === c ? `3px solid ${A.text}` : '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={addBank} disabled={createMutation.isPending} className="flex-1 px-4 py-2" style={{ background: A.bordeaux, color: 'white', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>{createMutation.isPending ? 'Ajout en cours…' : 'Ajouter la banque'}</button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2" style={{ background: 'white', color: A.muted, border: `1px solid ${A.border}`, borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
              </div>
            </div>
          </>
        </Modal>
      )}

      {/* Confirmation de suppression */}
      <ConfirmDialog
        open={confirmDel !== null}
        onOpenChange={ouvert => { if (!ouvert) setConfirmDel(null); }}
        titre={confirmDel ? `Retirer ${confirmDel.name} ?` : ''}
        description="Cette banque ne sera plus proposée aux dossiers, et les orientations déjà enregistrées vers elle seront retirées."
        libelleConfirmer="Retirer la banque"
        enCours={deleteMutation.isPending}
        onConfirmer={removeBank}
      />

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: A.text, color: 'white', padding: '10px 18px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, zIndex: 70, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast}</div>
      )}
    </div>
  );
}
