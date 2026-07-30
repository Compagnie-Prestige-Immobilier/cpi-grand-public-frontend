import React, { useState, useMemo } from 'react';
import { CheckCircle2, FileText, Bell, Camera, Banknote, MessageSquare, Upload, AlertCircle, Filter, Search, UserPlus, Landmark, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDocState } from '../data/docStateContext';
import { useCpiDocs } from '../data/cpiDocsContext';
import { useClientContext } from '../contexts/ClientContext';
import { toActivityEntries, useHistoriqueQuery } from '../data/activityLog';
import { usePermission } from '../auth/PermissionContext';

type ActionType = 'validation' | 'document' | 'notification' | 'photo' | 'decaissement' | 'commentaire' | 'depot' | 'refus' | 'compte' | 'banque';

interface HistoryEntry {
  id: string;
  date: string;
  heure: string;
  utilisateur: string;
  role: string;
  action: string;
  type: ActionType;
  cible?: string;
}

const TYPE_CFG: Record<ActionType, { icon: LucideIcon; color: string; bg: string }> = {
  validation:    { icon: CheckCircle2,  color: 'var(--success)',           bg: 'rgba(26,107,68,0.10)'    },
  document:      { icon: FileText,      color: 'var(--primary)',           bg: 'var(--secondary)'        },
  notification:  { icon: Bell,          color: '#8B5CF6',                  bg: 'rgba(139,92,246,0.10)'   },
  photo:         { icon: Camera,        color: '#C8921A',                  bg: 'rgba(200,146,26,0.10)'   },
  decaissement:  { icon: Banknote,      color: 'var(--success)',           bg: 'rgba(26,107,68,0.10)'    },
  commentaire:   { icon: MessageSquare, color: 'var(--muted-foreground)',  bg: 'var(--muted)'            },
  depot:         { icon: Upload,        color: 'var(--primary)',           bg: 'var(--secondary)'        },
  refus:         { icon: AlertCircle,   color: '#C0392B',                  bg: 'rgba(192,57,43,0.08)'    },
  compte:        { icon: UserPlus,      color: '#0E7490',                  bg: 'rgba(14,116,144,0.10)'   },
  banque:        { icon: Landmark,      color: '#B45309',                  bg: 'rgba(180,83,9,0.10)'     },
};

// Convertit une date FR (« 18 juin 2026 ») + heure en clé triable.
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function sortKey(date: string, heure: string): string {
  const m = date.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!m) return date + ' ' + heure;
  const day = m[1].padStart(2, '0');
  const monthIdx = MONTHS_FR.findIndex(x => m[2].toLowerCase().startsWith(x.slice(0, 4)));
  const month = String((monthIdx < 0 ? 0 : monthIdx) + 1).padStart(2, '0');
  return `${m[3]}-${month}-${day} ${heure || '00:00'}`;
}

const ALL_TYPES: (ActionType | 'all')[] = ['all', 'validation', 'document', 'depot', 'refus', 'decaissement', 'banque', 'notification', 'photo', 'commentaire', 'compte'];
const TYPE_LABELS: Record<ActionType | 'all', string> = {
  all:          'Tous',
  validation:   'Validations',
  document:     'Documents',
  notification: 'Notifications',
  photo:        'Photos',
  decaissement: 'Décaissements',
  commentaire:  'Commentaires',
  depot:        'Dépôts',
  refus:        'Refus',
  compte:       'Comptes',
  banque:       'Banques',
};

const ROLES: string[] = ['Client', 'Agent CPI', 'Administrateur'];
type Periode = 'all' | 'jour' | '7j' | '30j';
const PERIODES: { key: Periode; label: string; days: number }[] = [
  { key: 'all',  label: 'Tout',        days: 0 },
  { key: 'jour', label: "Aujourd'hui", days: 1 },
  { key: '7j',   label: '7 jours',     days: 7 },
  { key: '30j',  label: '30 jours',    days: 30 },
];

export default function HistoriqueModule() {
  const [filterType, setFilterType] = useState<ActionType | 'all'>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [periode, setPeriode] = useState<Periode>('all');
  const [query, setQuery] = useState('');
  const { allHistoryByClient } = useDocState();
  const { allCpiHistoryByClient } = useCpiDocs();
  const { allClients } = useClientContext();
  const { role } = usePermission();
  // /staff/historique répond 403 à un client : l'écran est réservé au personnel.
  const historiqueQuery = useHistoriqueQuery(role === 'agent-cpi' || role === 'super-admin');


  // Historique réel agrégé : pièces + documents CPI + journal transverse. Depuis
  // la Phase 6 les trois viennent du même journal serveur (Spatie Activity Log) ;
  // la déduplication par identifiant suffit donc à recomposer la liste complète,
  // y compris les entrées sans dossier (création de banque, compte…).
  const ENTRIES = useMemo<HistoryEntry[]>(() => {
    const docEntries = Object.values(allHistoryByClient).flat() as HistoryEntry[];
    const cpiEntries = Object.values(allCpiHistoryByClient).flat() as HistoryEntry[];

    const actEntries: HistoryEntry[] = toActivityEntries(historiqueQuery.data).map(e => ({
      id: e.id, date: e.date, heure: e.heure, utilisateur: e.utilisateur,
      role: e.role, action: e.action, type: e.type as ActionType, cible: e.cible,
    }));

    const live = [...docEntries, ...cpiEntries, ...actEntries];
    const seen = new Set<string>();
    const unique = live.filter(e => (e.id && seen.has(e.id) ? false : (seen.add(e.id), true)));
    return unique.sort((a, b) => sortKey(b.date, b.heure).localeCompare(sortKey(a.date, a.heure)));
  }, [allHistoryByClient, allCpiHistoryByClient, historiqueQuery.data, allClients]);

  // Liste des dossiers présents dans le journal (pour le filtre).
  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    ENTRIES.forEach(e => { if (e.cible) set.add(e.cible); });
    return Array.from(set).sort();
  }, [ENTRIES]);

  // Seuil de période (date locale au format YYYY-MM-DD HH:MM).
  const periodeThreshold = useMemo(() => {
    const cfg = PERIODES.find(p => p.key === periode);
    if (!cfg || cfg.days === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - (cfg.days - 1));
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day} 00:00`;
  }, [periode]);

  const q = query.trim().toLowerCase();
  const visible = ENTRIES.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterRole !== 'all' && e.role !== filterRole) return false;
    if (filterClient !== 'all' && e.cible !== filterClient) return false;
    if (periodeThreshold && sortKey(e.date, e.heure) < periodeThreshold) return false;
    if (q && !(`${e.action} ${e.utilisateur} ${e.role} ${e.cible ?? ''}`.toLowerCase().includes(q))) return false;
    return true;
  });

  // KPI par rôle (sur le journal complet, hors filtres).
  const countByRole = (r: string) => ENTRIES.filter(e => e.role === r).length;

  const exportCSV = () => {
    const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Heure', 'Utilisateur', 'Rôle', 'Action', 'Type', 'Dossier'].join(','),
      ...visible.map(e => [e.date, e.heure, e.utilisateur, e.role, e.action, TYPE_LABELS[e.type], e.cible ?? ''].map(esc).join(',')),
    ].join('\n');
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'historique-cpi.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Group by date
  const grouped: { date: string; entries: HistoryEntry[] }[] = [];
  for (const e of visible) {
    const last = grouped[grouped.length - 1];
    if (last && last.date === e.date) last.entries.push(e);
    else grouped.push({ date: e.date, entries: [e] });
  }

  const selectStyle: React.CSSProperties = { padding: '6px 10px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', borderRadius: 'var(--r-sm)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Journal d'audit — toutes les activités</h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0 }}>Traçabilité complète de la plateforme : clients, agents CPI et administrateurs. Aucune action ne peut être supprimée.</p>
        </div>
        <button onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
          <Download size={14} /> Exporter (CSV)
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { l: 'Actions au total', v: ENTRIES.length, c: 'var(--foreground)' },
          { l: 'Clients', v: countByRole('Client'), c: '#0E7490' },
          { l: 'Agents CPI', v: countByRole('Agent CPI'), c: 'var(--primary)' },
          { l: 'Administrateurs', v: countByRole('Administrateur'), c: '#B45309' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '13px 16px', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Recherche + filtres rôle / dossier / période */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--card)', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher (action, utilisateur, dossier)…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: 'var(--foreground)' }} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={selectStyle}>
          <option value="all">Tous les rôles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={selectStyle}>
          <option value="all">Tous les dossiers</option>
          {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODES.map(p => (
            <button key={p.key} onClick={() => setPeriode(p.key)} style={{ padding: '6px 10px', border: '1px solid var(--border)', background: periode === p.key ? 'var(--primary)' : 'transparent', color: periode === p.key ? 'var(--primary-foreground)' : 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: periode === p.key ? 700 : 500, cursor: 'pointer', borderRadius: 'var(--r-sm)' }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Filtre par type */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: 'var(--muted-foreground)' }} />
        {ALL_TYPES.map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{ padding: '5px 12px', border: '1px solid var(--border)', background: filterType === t ? 'var(--primary)' : 'transparent', color: filterType === t ? 'var(--primary-foreground)' : 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: filterType === t ? 700 : 500, cursor: 'pointer', borderRadius: 'var(--r-sm)' }}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {grouped.map((group, gi) => (
          <div key={group.date}>
            {/* Date separator */}
            <div style={{ padding: '10px 18px', background: 'var(--background)', borderBottom: '1px solid var(--border)', ...(gi > 0 ? { borderTop: '1px solid var(--border)' } : {}) }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--muted-foreground)' }}>{group.date}</span>
            </div>

            {group.entries.map((e, i) => {
              const cfg = TYPE_CFG[e.type] ?? TYPE_CFG.document;
              const Icon = cfg.icon;
              return (
                <div key={e.id} style={{ display: 'flex', gap: '14px', padding: '13px 18px', borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                  {/* Icon */}
                  <div style={{ width: '32px', height: '32px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', borderRadius: 'var(--r-sm)' }}>
                    <Icon size={14} style={{ color: cfg.color }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '2px' }}>{e.action}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{e.utilisateur}</span>
                      <span style={{ padding: '1px 6px', background: 'var(--secondary)', color: 'var(--primary)', fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700 }}>{e.role}</span>
                      {e.cible && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>→ {e.cible}</span>}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{e.heure}</div>
                </div>
              );
            })}
          </div>
        ))}

        {visible.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {ENTRIES.length === 0 ? 'Aucune activité enregistrée pour le moment.' : 'Aucune activité ne correspond à ces filtres.'}
          </div>
        )}
      </div>
    </div>
  );
}
