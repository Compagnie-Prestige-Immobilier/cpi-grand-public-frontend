import React, { useState } from 'react';
import {
  Eye, Download, CheckCircle2, XCircle, AlertCircle, MessageSquare,
  ChevronDown, ChevronUp, FileText, RefreshCw, Search, Clock, X, ListChecks, History,
} from 'lucide-react';
import { useDocState, type SharedDoc } from '../data/docStateContext';
import { useClientContext } from '../contexts/ClientContext';

type DocStatus = 'accepte' | 'en-analyse' | 'a-remplacer' | 'refuse' | 'manquant';

interface ClientDoc {
  id: string;
  label: string;
  file: string;
  date: string;
  size: string;
  status: DocStatus;
  version: number;
  comment?: string;
  /** Lien signé de courte durée vers le fichier réel (bucket privé). */
  fileUrl?: string;
}

interface ClientEntry {
  id: string;
  name: string;
  ref: string;
  project: string;
  docs: ClientDoc[];
}

interface Props { agentName?: string; }

const DOC_STATUS_CFG: Record<DocStatus, { label: string; color: string; bg: string }> = {
  'accepte':    { label: 'Accepté',         color: 'var(--success)',          bg: 'rgba(26,107,68,0.10)'  },
  'en-analyse': { label: 'À vérifier',      color: 'var(--accent-text)',                 bg: 'rgba(200,146,26,0.10)' },
  'a-remplacer':{ label: 'À remplacer',     color: 'var(--destructive)',                 bg: 'rgba(192,57,43,0.08)'  },
  'refuse':     { label: 'Refusé',          color: 'var(--destructive)',                 bg: 'rgba(192,57,43,0.08)'  },
  'manquant':   { label: 'Non déposé',      color: 'var(--muted-foreground)', bg: 'var(--muted)'          },
};

type StoreDocStatus = 'en-attente' | 'depose' | 'verification' | 'accepte' | 'refuse' | 'a-remplacer';
function toModuleStatus(s: StoreDocStatus): DocStatus {
  if (s === 'accepte')                         return 'accepte';
  if (s === 'refuse')                          return 'refuse';
  if (s === 'a-remplacer')                     return 'a-remplacer';
  if (s === 'verification' || s === 'depose')  return 'en-analyse';
  return 'manquant';
}

function toClientDoc(d: SharedDoc): ClientDoc {
  return {
    id: d.id,
    label: d.label,
    file: d.submittedLabel ?? '—',
    date: d.date ?? '—',
    size: d.taille ?? '—',
    status: toModuleStatus(d.status as StoreDocStatus),
    version: d.version ?? 0,
    comment: d.commentaire,
    fileUrl: d.fileUrl,
  };
}

// ── Ancienneté ────────────────────────────────────────────────────────────────
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function parseFrDate(date: string): Date | null {
  if (!date || date === '—') return null;
  const m = date.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!m) return null;
  const idx = MONTHS_FR.findIndex(x => m[2].toLowerCase().startsWith(x.slice(0, 4)));
  if (idx < 0) return null;
  return new Date(Number(m[3]), idx, Number(m[1]));
}
function ageLabel(date: string): string {
  const d = parseFrDate(date);
  if (!d) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "déposé aujourd'hui";
  if (days === 1) return 'déposé hier';
  return `déposé il y a ${days} jours`;
}

export default function DocumentsClientsModule({ agentName = 'Agent CPI' }: Props) {
  const {
    allDocsByClient, allHistoryByClient,
    acceptDoc: ctxAcceptDoc,
    refuseDoc: ctxRefuseDoc,
    requestReplacement: ctxRequestReplacement,
    remettreVerification: ctxRemettreVerification,
    pushNotification,
  } = useDocState();

  const { selectedClientId, allClients: allClientSummaries } = useClientContext();

  const allClients: ClientEntry[] = allClientSummaries.map(c => ({
    id: c.id,
    name: c.name,
    ref: c.ref,
    project: `${c.projectNom} — ${c.adresse}`,
    docs: (allDocsByClient[c.id] ?? []).map(toClientDoc),
  }));

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'tous' | 'verifier' | 'corriger' | 'complets'>('tous');
  const [sort, setSort] = useState<'urgence' | 'nom' | 'ref'>('urgence');
  const [expanded, setExpanded] = useState<string | null>(selectedClientId);
  const [queueOpen, setQueueOpen] = useState(true);
  const [commentModal, setCommentModal] = useState<{ clientId: string; docId: string; docLabel: string; mode: 'complement' | 'refus' } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [preview, setPreview] = useState<{ clientId: string; clientName: string; ref: string; doc: ClientDoc } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  // ── KPI globaux ──────────────────────────────────────────────────────────────
  const allDocsFlat = allClients.flatMap(c => c.docs);
  const kTotal = allDocsFlat.length;
  const kValides = allDocsFlat.filter(d => d.status === 'accepte').length;
  const kAVerifier = allDocsFlat.filter(d => d.status === 'en-analyse').length;
  const kACorriger = allDocsFlat.filter(d => d.status === 'refuse' || d.status === 'a-remplacer').length;

  // ── File d'attente (toutes les pièces à vérifier, tous clients) ───────────────
  const queue = allClients
    .flatMap(c => c.docs.filter(d => d.status === 'en-analyse').map(doc => ({ clientId: c.id, clientName: c.name, ref: c.ref, doc })))
    .sort((a, b) => {
      const da = parseFrDate(a.doc.date)?.getTime() ?? Infinity;
      const db = parseFrDate(b.doc.date)?.getTime() ?? Infinity;
      return da - db; // plus anciennes d'abord
    });

  // ── Actions ──────────────────────────────────────────────────────────────────
  const accept = (clientId: string, docId: string) => {
    ctxAcceptDoc(docId, agentName, clientId);
    showToast('Document accepté — visible dans le dossier client.');
  };
  const openComment = (clientId: string, docId: string, docLabel: string, mode: 'refus' | 'complement') => {
    setCommentModal({ clientId, docId, docLabel, mode });
    setCommentText('');
  };
  const backToVerif = (clientId: string, docId: string) => {
    ctxRemettreVerification(docId, agentName, clientId);
    showToast('Document remis en vérification.');
  };
  const acceptAll = (client: ClientEntry) => {
    const pending = client.docs.filter(d => d.status === 'en-analyse');
    pending.forEach(d => ctxAcceptDoc(d.id, agentName, client.id));
    if (pending.length) showToast(`${pending.length} pièce${pending.length > 1 ? 's' : ''} acceptée${pending.length > 1 ? 's' : ''}.`);
  };

  const handleCommentSubmit = () => {
    if (!commentModal || !commentText.trim()) return;
    const { clientId, docId, docLabel, mode } = commentModal;
    const txt = commentText.trim();
    if (mode === 'complement') {
      ctxRequestReplacement(docId, agentName, txt, clientId);
    } else {
      ctxRefuseDoc(docId, agentName, txt, clientId);
    }
    // (C) Notifier automatiquement le client
    pushNotification(clientId, `Pièce « ${docLabel} » — action requise : ${txt}`, 'Notification', agentName);
    showToast(mode === 'refus' ? 'Document refusé — client notifié.' : 'Remplacement demandé — client notifié.');
    setCommentModal(null);
    setCommentText('');
  };

  const downloadRecap = (clientName: string, ref: string, doc: ClientDoc, timeline: { action: string; date: string; heure: string }[]) => {
    const lines = [
      `CPI IMMOBILIER — Récapitulatif de pièce`,
      `Client : ${clientName}   Dossier : ${ref}`,
      `Pièce : ${doc.label}`,
      `Fichier : ${doc.file}   Version : v${doc.version}   Taille : ${doc.size}`,
      `Statut : ${DOC_STATUS_CFG[doc.status].label}`,
      doc.comment ? `Commentaire : ${doc.comment}` : '',
      '',
      'Historique :',
      ...(timeline.length ? timeline.map(t => `  - ${t.date} ${t.heure} — ${t.action}`) : ['  (aucun événement)']),
    ].filter(Boolean);
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${ref}_${doc.label.replace(/\s+/g, '_')}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtre + recherche + tri sur la liste clients ─────────────────────────────
  const q = query.trim().toLowerCase();
  let list = allClients.filter(c => {
    if (q && !(c.name.toLowerCase().includes(q) || c.ref.toLowerCase().includes(q))) return false;
    const pending = c.docs.filter(d => d.status === 'en-analyse').length;
    const issues = c.docs.filter(d => d.status === 'refuse' || d.status === 'a-remplacer').length;
    const total = c.docs.length;
    const accepted = c.docs.filter(d => d.status === 'accepte').length;
    if (filter === 'verifier') return pending > 0;
    if (filter === 'corriger') return issues > 0;
    if (filter === 'complets') return total > 0 && accepted === total;
    return true;
  });
  list = [...list].sort((a, b) => {
    if (sort === 'nom') return a.name.localeCompare(b.name);
    if (sort === 'ref') return a.ref.localeCompare(b.ref);
    const ua = a.docs.filter(d => d.status === 'en-analyse' || d.status === 'refuse' || d.status === 'a-remplacer').length;
    const ub = b.docs.filter(d => d.status === 'en-analyse' || d.status === 'refuse' || d.status === 'a-remplacer').length;
    return ub - ua;
  });

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: '12px', overflow: 'hidden' };
  const FILTERS: [typeof filter, string][] = [['tous', 'Tous'], ['verifier', 'À vérifier'], ['corriger', 'À corriger'], ['complets', 'Complets']];
  const SORTS: [typeof sort, string][] = [['urgence', 'Urgence'], ['nom', 'Nom'], ['ref', 'Référence']];

  return (
    <div style={{ width: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Documents clients</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0 }}>Dossiers de tous les clients — vérifiez, acceptez ou refusez les pièces déposées.</p>
      </div>

      {/* (A) Bandeau KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { l: 'Pièces au total', v: kTotal, c: 'var(--primary)' },
          { l: 'Validées', v: kValides, c: 'var(--success)' },
          { l: 'À vérifier', v: kAVerifier, c: 'var(--accent-text)' },
          { l: 'À corriger', v: kACorriger, c: 'var(--destructive)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* (N1) Recherche + filtres + tri */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--background)' }}>
          <Search size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher (nom, n° de dossier)…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: 'var(--foreground)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(([val, lbl]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '5px 12px', borderRadius: 'var(--r-full)', border: `1px solid ${filter === val ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, background: filter === val ? 'var(--primary)' : 'var(--card)', color: filter === val ? 'var(--primary-foreground)' : 'var(--muted-foreground)' }}>{lbl}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>Trier :</span>
            {SORTS.map(([val, lbl]) => (
              <button key={val} onClick={() => setSort(val)}
                style={{ padding: '4px 10px', borderRadius: 'var(--r-xs)', border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700, background: sort === val ? 'var(--secondary)' : 'transparent', color: sort === val ? 'var(--primary)' : 'var(--muted-foreground)' }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* (N2) File d'attente "À traiter" */}
      {queue.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 16, overflow: 'hidden' }}>
          <button onClick={() => setQueueOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(200,146,26,0.06)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <ListChecks size={18} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', flex: 1 }}>File d'attente — {queue.length} pièce{queue.length > 1 ? 's' : ''} à traiter</span>
            {queueOpen ? <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />}
          </button>
          {queueOpen && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)' }}>
              {queue.map(({ clientId, clientName, ref, doc }) => (
                <div key={clientId + doc.id} style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{doc.label}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 1 }}>{clientName} · {ref}</div>
                    {doc.date !== '—' && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--accent-text)', fontWeight: 600, marginTop: 3 }}><Clock size={11} /> {ageLabel(doc.date)}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setPreview({ clientId, clientName, ref, doc })} style={btnSm('var(--primary)', 'var(--secondary)')}><Eye size={12} /> Aperçu</button>
                    <button onClick={() => accept(clientId, doc.id)} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><CheckCircle2 size={12} /> Accepter</button>
                    <button onClick={() => openComment(clientId, doc.id, doc.label, 'refus')} style={btnSm('var(--destructive)', 'rgba(192,57,43,0.08)')}><XCircle size={12} /> Refuser</button>
                    <button onClick={() => openComment(clientId, doc.id, doc.label, 'complement')} style={btnSm('#C8921A', 'rgba(200,146,26,0.10)')}><AlertCircle size={12} /> Remplacement</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Liste clients */}
      {list.length === 0 ? (
        <div style={{ ...card, padding: '32px 20px', textAlign: 'center' }}>
          <FileText size={26} style={{ color: 'var(--border)', margin: '0 auto 8px', display: 'block' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{allClients.length === 0 ? 'Aucun dossier client pour le moment.' : 'Aucun dossier ne correspond à ce filtre.'}</div>
        </div>
      ) : list.map(client => {
        const isOpen = expanded === client.id;
        const total = client.docs.length;
        const accepted = client.docs.filter(d => d.status === 'accepte').length;
        const pending = client.docs.filter(d => d.status === 'en-analyse').length;
        const issues = client.docs.filter(d => d.status === 'refuse' || d.status === 'a-remplacer').length;
        return (
          <div key={client.id} style={card}>
            <button onClick={() => setExpanded(isOpen ? null : client.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', color: 'var(--primary)' }}>
                {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>{client.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--secondary)', padding: '2px 8px', borderRadius: 'var(--r-xs)', whiteSpace: 'nowrap' }}>Dossier {client.ref}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{client.project}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: total > 0 && accepted === total ? 'var(--success)' : 'var(--muted-foreground)', fontWeight: 700 }}>{accepted}/{total} validés</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {pending > 0 && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--accent-text)' }}>{pending} à vérifier</span>}
                    {issues > 0 && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--destructive)' }}>{issues} à corriger</span>}
                  </div>
                </div>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />}
              </div>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--background)' }}>
                {/* (N4) Tout accepter */}
                {pending > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => acceptAll(client)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(26,107,68,0.25)', background: 'rgba(26,107,68,0.08)', color: 'var(--success)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      <CheckCircle2 size={13} /> Tout accepter ({pending})
                    </button>
                  </div>
                )}
                {client.docs.map(doc => {
                  const cfg = DOC_STATUS_CFG[doc.status];
                  return (
                    <div key={doc.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={16} style={{ color: cfg.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 150 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{doc.label} {doc.version > 0 && <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>v{doc.version}</span>}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 1 }}>
                            {doc.file === '—' ? 'Non déposé' : `${doc.file} · ${doc.date} · ${doc.size}`}
                          </div>
                          {doc.status === 'en-analyse' && doc.date !== '—' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--accent-text)', fontWeight: 600, marginTop: 3 }}><Clock size={11} /> {ageLabel(doc.date)}</div>
                          )}
                        </div>
                        <span style={{ padding: '4px 10px', borderRadius: 'var(--r-full)', background: cfg.bg, color: cfg.color, fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{cfg.label}</span>
                      </div>
                      {doc.comment && (
                        <div style={{ marginTop: 8, borderLeft: '3px solid var(--destructive)', paddingLeft: 10, fontSize: '0.75rem', color: 'var(--destructive)', fontStyle: 'italic' }}>"{doc.comment}"</div>
                      )}
                      {doc.status !== 'manquant' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                          <button onClick={() => setPreview({ clientId: client.id, clientName: client.name, ref: client.ref, doc })} style={btnSm('var(--primary)', 'var(--secondary)')}><Eye size={12} /> Aperçu</button>
                          {doc.status !== 'accepte' && (
                            <button onClick={() => accept(client.id, doc.id)} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><CheckCircle2 size={12} /> Accepter</button>
                          )}
                          {(doc.status === 'refuse' || doc.status === 'a-remplacer') && (
                            <button onClick={() => backToVerif(client.id, doc.id)} style={btnSm('#C8921A', 'rgba(200,146,26,0.10)')}><RefreshCw size={12} /> Vérification</button>
                          )}
                          {doc.status !== 'refuse' && (
                            <button onClick={() => openComment(client.id, doc.id, doc.label, 'refus')} style={btnSm('var(--destructive)', 'rgba(192,57,43,0.08)')}><XCircle size={12} /> Refuser</button>
                          )}
                          <button onClick={() => openComment(client.id, doc.id, doc.label, 'complement')} style={btnSm('#C8921A', 'rgba(200,146,26,0.10)')}><AlertCircle size={12} /> Remplacement</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* (N3 + D) Aperçu du document + historique de versions */}
      {preview && (() => {
        const timeline = (allHistoryByClient[preview.clientId] ?? [])
          .filter(e => e.action.toLowerCase().includes(preview.doc.label.toLowerCase()));
        const cfg = DOC_STATUS_CFG[preview.doc.status];
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={() => setPreview(null)} style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--foreground)' }}>{preview.doc.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{preview.clientName} · {preview.ref}</div>
                </div>
                <button onClick={() => setPreview(null)} style={{ background: 'var(--secondary)', border: 'none', borderRadius: 'var(--r-sm)', padding: 6, cursor: 'pointer' }}><X size={16} style={{ color: 'var(--muted-foreground)' }} /></button>
              </div>

              {/* Fichier réel déposé par le client (lien signé, valable quelques minutes) */}
              <div style={{ background: 'var(--background)', border: '1px dashed var(--border)', borderRadius: 'var(--r-md)', padding: '28px 20px', textAlign: 'center', marginBottom: 14 }}>
                <FileText size={30} style={{ color: cfg.color, margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{preview.doc.file}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{preview.doc.file === '—' ? 'Pièce non déposée' : `${preview.doc.size} · v${preview.doc.version}`}</div>
                {preview.doc.fileUrl ? (
                  <a href={preview.doc.fileUrl} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '7px 16px', borderRadius: 'var(--r-sm)', background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
                    <Eye size={12} /> Ouvrir le document
                  </a>
                ) : (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 8, fontStyle: 'italic' }}>Aucun fichier déposé pour cette pièce.</div>
                )}
              </div>

              {/* Métadonnées */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {[
                  ['Statut', DOC_STATUS_CFG[preview.doc.status].label],
                  ['Déposé le', preview.doc.date],
                  ['Version', `v${preview.doc.version}`],
                  ...(preview.doc.comment ? [['Commentaire', preview.doc.comment] as [string, string]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>{k}</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* (D) Historique de versions */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <History size={14} style={{ color: 'var(--muted-foreground)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historique de la pièce</span>
                </div>
                {timeline.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Aucun événement enregistré.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {timeline.map(t => (
                      <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: '0.8125rem' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
                        <div>
                          <div style={{ color: 'var(--foreground)' }}>{t.action}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{t.date} · {t.heure} · {t.utilisateur}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => downloadRecap(preview.clientName, preview.ref, preview.doc, timeline)} style={btnOutline}><Download size={13} /> Télécharger le récap</button>
                {preview.doc.status !== 'accepte' && preview.doc.status !== 'manquant' && (
                  <button onClick={() => { accept(preview.clientId, preview.doc.id); setPreview(null); }} style={btnPrimary}><CheckCircle2 size={13} /> Accepter</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal commentaire (refus / remplacement) */}
      {commentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: '480px', padding: '24px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '6px' }}>
              {commentModal.mode === 'refus' ? 'Refuser ce document' : 'Demander un remplacement'}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
              {commentModal.mode === 'refus'
                ? 'Expliquez la raison du refus. Le client sera notifié et verra ce commentaire dans son dossier.'
                : 'Expliquez ce qui doit être corrigé. Le client sera notifié.'}
            </div>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder={commentModal.mode === 'refus' ? 'Ex : Document expiré ou non conforme au type requis.' : 'Ex : Relevés illisibles, merci de redéposer des fichiers plus nets.'}
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', resize: 'vertical', lineHeight: 1.55 }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCommentModal(null)} style={btnOutline}>Annuler</button>
              <button onClick={handleCommentSubmit} disabled={!commentText.trim()} style={{ ...btnPrimary, opacity: commentText.trim() ? 1 : 0.5 }}>
                <MessageSquare size={13} /> {commentModal.mode === 'refus' ? 'Refuser & notifier' : 'Envoyer & notifier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--foreground)', color: 'var(--background)', padding: '12px 18px', borderRadius: 'var(--r-sm)', fontSize: '0.875rem', fontWeight: 600, zIndex: 300, maxWidth: '340px' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function btnSm(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: bg, color, border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
}
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' };
const btnOutline: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
