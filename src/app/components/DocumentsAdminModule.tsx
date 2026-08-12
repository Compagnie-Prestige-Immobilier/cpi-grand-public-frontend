import React, { useState, useRef } from 'react';
import {
  Plus, Eye, Download, Send, Archive, FileText, CheckCircle2,
  PenSquare, EyeOff, ChevronDown, ChevronUp, Upload, Search, X,
  ListChecks, LayoutTemplate, History, Users,
} from 'lucide-react';
import { useCpiDocs, type CpiDoc, type CpiDocStatus, type CpiCategorie } from '../data/cpiDocsContext';
import { useDocState } from '../data/docStateContext';
import { useClientContext } from '../contexts/ClientContext';

// ─── Config ────────────────────────────────────────────────────────────────────

const CPI_STATUS_CFG: Record<CpiDocStatus, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',   color: 'var(--muted-foreground)', bg: 'var(--muted)'             },
  publie:     { label: 'Publié',      color: 'var(--success)',          bg: 'rgba(26,107,68,0.10)'     },
  disponible: { label: 'Disponible',  color: 'var(--primary)',          bg: 'var(--secondary)'         },
  'a-signer': { label: 'À signer',    color: '#C0392B',                 bg: 'rgba(192,57,43,0.08)'     },
  signe:      { label: 'Signé',       color: 'var(--success)',          bg: 'rgba(26,107,68,0.10)'     },
  refuse:     { label: 'Refusé',      color: '#C0392B',                 bg: 'rgba(192,57,43,0.08)'     },
  archive:    { label: 'Archivé',     color: '#C8921A',                 bg: 'rgba(200,146,26,0.10)'    },
};

const CATEGORIE_LABELS: Record<CpiCategorie, string> = {
  contrats: 'Contrat', conventions: 'Convention', bancaires: 'Document bancaire',
  courriers: 'Courrier', pv: 'Procès-verbal', autorisations: 'Autorisation',
};
const CPI_CATEGORIES: CpiCategorie[] = ['contrats', 'conventions', 'bancaires', 'courriers', 'pv', 'autorisations'];

// (N4) Modèles pré-remplis
const TEMPLATES: { label: string; categorie: CpiCategorie; signature: boolean }[] = [
  { label: 'Contrat de réservation',        categorie: 'contrats',      signature: true  },
  { label: 'Convention de financement',     categorie: 'conventions',   signature: true  },
  { label: 'Autorisation de prélèvement',   categorie: 'autorisations', signature: true  },
  { label: 'Offre de prêt bancaire',        categorie: 'bancaires',     signature: false },
  { label: 'Accusé de réception du dossier',categorie: 'courriers',     signature: false },
  { label: 'PV de réservation',             categorie: 'pv',            signature: false },
];

// Filtres de statut
const FILTERS = ['all', 'a-signer', 'brouillon', 'publie', 'signe', 'archive'] as const;
type FilterStatut = typeof FILTERS[number];
const FILTER_LABELS: Record<FilterStatut, string> = { all: 'Tous', 'a-signer': 'À signer', brouillon: 'Brouillons', publie: 'Publiés', signe: 'Signés', archive: 'Archivés' };
function matchesFilter(status: CpiDocStatus, f: FilterStatut): boolean {
  if (f === 'all') return true;
  if (f === 'publie') return status === 'publie' || status === 'disponible';
  return status === f;
}

interface Props { agentName?: string; }

const emptyForm = { titre: '', categorie: 'contrats' as CpiCategorie, destinataires: [] as string[], note: '', signature: false };

export default function DocumentsAdminModule({ agentName = 'Agent CPI' }: Props) {
  const { allCpiDocsByClient, allCpiHistoryByClient, publishDoc, archiveDoc, requestSignature, markSigned, retireFromClient, createDoc } = useCpiDocs();
  const { pushNotification } = useDocState();
  const { allClients: allClientSummaries, selectedClientId } = useClientContext();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [allRecipients, setAllRecipients] = useState(false);
  const [filterStatut, setFilterStatut] = useState<FilterStatut>('all');
  const [filterCat, setFilterCat] = useState<'toutes' | CpiCategorie>('toutes');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(selectedClientId);
  const [queueOpen, setQueueOpen] = useState(true);
  const [preview, setPreview] = useState<{ clientId: string; clientName: string; ref: string; doc: CpiDoc } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [file, setFile] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [taille, setTaille] = useState('—');
  const [uploadDone, setUploadDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };
  const nameOf = (id: string) => allClientSummaries.find(c => c.id === id)?.name ?? id;

  const startUpload = (f: File) => {
    // Le fichier est seulement SÉLECTIONNÉ ici : le transfert vers R2 n'a lieu
    // qu'à la création (createDoc → upload), et pour plusieurs destinataires à
    // la fois. Une barre de progression à ce stade ne pourrait mesurer que du
    // vide — l'ancienne version l'animait avec `Math.random()`.
    setFile(f.name); setPendingFile(f); setUploadDone(true);
    setTaille(`${(f.size / 1048576).toFixed(1)} Mo`);
    if (!form.titre) setForm(fo => ({ ...fo, titre: f.name.replace(/\.[^.]+$/, '') }));
  };
  const resetForm = () => { setForm(emptyForm); setAllRecipients(false); setFile(null); setPendingFile(null); setTaille('—'); setUploadDone(false); setShowForm(false); };

  const applyTemplate = (t: typeof TEMPLATES[number]) => {
    setForm(f => ({ ...f, titre: t.label, categorie: t.categorie, signature: t.signature }));
    setShowForm(true);
  };
  const toggleRecipient = (id: string) => setForm(f => ({ ...f, destinataires: f.destinataires.includes(id) ? f.destinataires.filter(x => x !== id) : [...f.destinataires, id] }));

  const recipients = allRecipients ? allClientSummaries.map(c => c.id) : form.destinataires;

  const handleCreate = (asDraft: boolean) => {
    if (!form.titre || recipients.length === 0) return;
    recipients.forEach(clientId => {
      createDoc(
        { categorie: form.categorie, nom: form.titre, version: 'V1', auteur: agentName, signatureRequise: form.signature, commentaire: form.note || undefined, format: 'PDF', taille: file ? taille : '—' },
        agentName, !asDraft, clientId, pendingFile,
      );
      if (!asDraft) {
        const msg = form.signature ? `Document à signer : « ${form.titre} »` : `Nouveau document disponible : « ${form.titre} »`;
        pushNotification(clientId, msg, 'Notification', agentName);
      }
    });
    const who = recipients.length === 1 ? nameOf(recipients[0]) : `${recipients.length} clients`;
    showToast(asDraft ? `Brouillon enregistré (${who}).` : `Document transmis à ${who}${form.signature ? ' — à signer' : ''} · client(s) notifié(s).`);
    resetForm();
  };

  // ── Actions par document (avec notification) ───────────────────────────────────
  const doPublish = (doc: CpiDoc, clientId: string) => {
    publishDoc(doc.id, agentName, clientId);
    pushNotification(clientId, `Nouveau document disponible : « ${doc.nom} »`, 'Notification', agentName);
    showToast(`Document publié dans l'espace client de ${nameOf(clientId)} · client notifié.`);
  };
  const doRequestSign = (doc: CpiDoc, clientId: string) => {
    requestSignature(doc.id, agentName, clientId);
    pushNotification(clientId, `Document à signer : « ${doc.nom} »`, 'Notification', agentName);
    showToast('Signature demandée · client notifié.');
  };
  const doMarkSigned = (doc: CpiDoc, clientId: string) => { markSigned(doc.id, agentName, clientId); showToast('Document marqué comme signé.'); };
  const doArchive = (doc: CpiDoc, clientId: string) => { archiveDoc(doc.id, agentName, clientId); showToast('Document archivé.'); };
  const doRetire = (doc: CpiDoc, clientId: string) => { retireFromClient(doc.id, agentName, clientId); showToast("Document retiré de l'espace client."); };

  const downloadRecap = (clientName: string, ref: string, doc: CpiDoc, timeline: { action: string; date: string; heure: string }[]) => {
    const lines = [
      'CPI IMMOBILIER — Document', `Client : ${clientName}   Dossier : ${ref}`,
      `Document : ${doc.nom}`, `Catégorie : ${CATEGORIE_LABELS[doc.categorie]}   Version : ${doc.version}`,
      `Statut : ${CPI_STATUS_CFG[doc.status].label}   Signature requise : ${doc.signatureRequise ? 'oui' : 'non'}`,
      doc.commentaire ? `Note : ${doc.commentaire}` : '', '',
      'Historique :', ...(timeline.length ? timeline.map(t => `  - ${t.date} ${t.heure} — ${t.action}`) : ['  (aucun événement)']),
    ].filter(Boolean);
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${ref}_${doc.nom.replace(/\s+/g, '_')}.txt`; a.click(); URL.revokeObjectURL(url);
  };

  // ── KPI ────────────────────────────────────────────────────────────────────────
  const allDocsFlat = allClientSummaries.flatMap(c => (allCpiDocsByClient[c.id] ?? []).map(d => ({ d, clientId: c.id })));
  const kTotal = allDocsFlat.length;
  const kASigner = allDocsFlat.filter(x => x.d.status === 'a-signer').length;
  const kBrouillons = allDocsFlat.filter(x => x.d.status === 'brouillon').length;
  const kSignes = allDocsFlat.filter(x => x.d.status === 'signe').length;

  // ── File d'attente : à signer + brouillons à publier ────────────────────────────
  const queue = allClientSummaries.flatMap(c =>
    (allCpiDocsByClient[c.id] ?? [])
      .filter(d => d.status === 'a-signer' || d.status === 'brouillon')
      .map(doc => ({ clientId: c.id, clientName: c.name, ref: c.ref, doc })));

  // ── Liste clients filtrée ────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const sortedClients = [...allClientSummaries].sort((a, b) => a.ref.localeCompare(b.ref))
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.ref.toLowerCase().includes(q));

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Documents admin</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0 }}>Créez, publiez et faites signer des documents pour les dossiers clients.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 16px', borderRadius: 'var(--r-sm)', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={14} /> Nouveau document
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        {[
          { l: 'Documents au total', v: kTotal, c: 'var(--primary)' },
          { l: 'À signer', v: kASigner, c: '#C0392B' },
          { l: 'Brouillons', v: kBrouillons, c: 'var(--muted-foreground)' },
          { l: 'Signés', v: kSignes, c: 'var(--success)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* (N4) Modèles rapides */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <LayoutTemplate size={15} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)' }}>Créer depuis un modèle</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TEMPLATES.map(t => (
            <button key={t.label} onClick={() => applyTemplate(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-full)', border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              <FileText size={12} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '16px' }}>Nouveau document</div>

          {/* Fichier (optionnel — un modèle génère un document sans fichier) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Fichier du document <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--muted-foreground)' }}>· optionnel</span></label>
            {!file ? (
              <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) startUpload(f); }}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', padding: '18px 16px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--secondary)' : 'var(--input-background)' }}>
                <Upload size={22} style={{ color: 'var(--primary)', margin: '0 auto 4px', display: 'block' }} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>Glissez un fichier, ou cliquez (facultatif)</div>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) startUpload(f); e.currentTarget.value = ''; }} />
              </div>
            ) : (
              <div style={{ background: 'var(--input-background)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FileText size={17} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file} · {taille}</span>
                  {uploadDone && <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />}
                  <button onClick={() => { setFile(null); setPendingFile(null); setUploadDone(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>Retirer</button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                  Prêt à envoyer — le fichier partira à la publication.
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Titre du document</label>
              <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Contrat de réservation" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value as CpiCategorie }))} style={inputStyle}>
                {CPI_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORIE_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          {/* Destinataires (multi) */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Destinataire(s)</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--foreground)' }}>
                <input type="checkbox" checked={allRecipients} onChange={e => setAllRecipients(e.target.checked)} style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
                <Users size={12} /> Tous les clients
              </label>
            </div>
            {allClientSummaries.length === 0 ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Aucun client inscrit pour le moment.</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', opacity: allRecipients ? 0.5 : 1, pointerEvents: allRecipients ? 'none' : 'auto' }}>
                {allClientSummaries.map(c => {
                  const on = form.destinataires.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleRecipient(c.id)} style={{ padding: '5px 12px', borderRadius: 'var(--r-full)', border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary)' : 'var(--card)', color: on ? 'var(--primary-foreground)' : 'var(--muted-foreground)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>{c.name}</button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Note interne (optionnelle)</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Note visible uniquement par l'équipe..." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}>
            <input type="checkbox" checked={form.signature} onChange={e => setForm(f => ({ ...f, signature: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>Signature du client requise (le document part directement « à signer »)</span>
          </label>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={resetForm} style={btnOutline}>Annuler</button>
            <button onClick={() => handleCreate(true)} disabled={!form.titre || recipients.length === 0} style={{ ...btnGhost, opacity: form.titre && recipients.length ? 1 : 0.5 }}>Enregistrer brouillon</button>
            <button onClick={() => handleCreate(false)} disabled={!form.titre || recipients.length === 0} style={{ ...btnPrimary, opacity: form.titre && recipients.length ? 1 : 0.5 }}>
              <Send size={13} /> Transmettre {recipients.length > 1 ? `(${recipients.length})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* (N2) File d'attente */}
      {queue.length > 0 && (
        <div style={card}>
          <button onClick={() => setQueueOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(192,57,43,0.05)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <ListChecks size={18} style={{ color: '#C0392B', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', flex: 1 }}>À traiter — {queue.length} document{queue.length > 1 ? 's' : ''} (à signer / à publier)</span>
            {queueOpen ? <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />}
          </button>
          {queueOpen && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)' }}>
              {queue.map(({ clientId, clientName, ref, doc }) => {
                const cfg = CPI_STATUS_CFG[doc.status];
                return (
                  <div key={clientId + doc.id} style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{doc.nom}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 1 }}>{clientName} · {ref} · {CATEGORIE_LABELS[doc.categorie]}</div>
                    </div>
                    <span style={{ padding: '3px 9px', borderRadius: 'var(--r-full)', background: cfg.bg, color: cfg.color, fontSize: '0.625rem', fontWeight: 700 }}>{cfg.label}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => setPreview({ clientId, clientName, ref, doc })} style={btnSm('var(--primary)', 'var(--secondary)')}><Eye size={12} /> Aperçu</button>
                      {doc.status === 'brouillon' && <button onClick={() => doPublish(doc, clientId)} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><Send size={12} /> Publier</button>}
                      {doc.status === 'a-signer' && <>
                        <button onClick={() => doRequestSign(doc, clientId)} style={btnSm('#8B5CF6', 'rgba(139,92,246,0.10)')}><PenSquare size={12} /> Relancer</button>
                        <button onClick={() => doMarkSigned(doc, clientId)} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><CheckCircle2 size={12} /> Marquer signé</button>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filtres statut + catégorie + recherche */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--background)' }}>
          <Search size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un client (nom, n° de dossier)…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: 'var(--foreground)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilterStatut(f)} style={{ padding: '5px 12px', borderRadius: 'var(--r-full)', border: `1px solid ${filterStatut === f ? 'var(--primary)' : 'var(--border)'}`, background: filterStatut === f ? 'var(--primary)' : 'var(--card)', color: filterStatut === f ? 'var(--primary-foreground)' : 'var(--muted-foreground)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>{FILTER_LABELS[f]}</button>
            ))}
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value as any)} style={{ ...inputStyle, width: 'auto', borderRadius: 'var(--r-sm)' }}>
            <option value="toutes">Toutes catégories</option>
            {CPI_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORIE_LABELS[c]}</option>)}
          </select>
        </div>
      </div>

      {/* Liste clients */}
      {sortedClients.length === 0 ? (
        <div style={{ ...card, padding: '32px 20px', textAlign: 'center' }}>
          <FileText size={26} style={{ color: 'var(--border)', margin: '0 auto 8px', display: 'block' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{allClientSummaries.length === 0 ? 'Aucun client inscrit pour le moment.' : 'Aucun dossier ne correspond à la recherche.'}</div>
        </div>
      ) : sortedClients.map(client => {
        const allDocs = allCpiDocsByClient[client.id] ?? [];
        const docs = allDocs.filter(d => matchesFilter(d.status, filterStatut) && (filterCat === 'toutes' || d.categorie === filterCat));
        const isOpen = expanded === client.id;
        const toSign = allDocs.filter(d => d.status === 'a-signer').length;
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{client.projectNom}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {toSign > 0 && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#C0392B', background: 'rgba(192,57,43,0.08)', padding: '3px 8px', borderRadius: 'var(--r-full)' }}>{toSign} à signer</span>}
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{docs.length} doc{docs.length > 1 ? 's' : ''}</span>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />}
              </div>
            </button>

            {isOpen && (docs.length === 0 ? (
              <div style={{ borderTop: '1px solid var(--border)', padding: '24px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Aucun document dans cette vue pour {client.name}.</div>
            ) : (
              <div style={{ borderTop: '1px solid var(--border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--background)' }}>
                {docs.map((doc: CpiDoc) => {
                  const cfg = CPI_STATUS_CFG[doc.status];
                  const dateDisplay = doc.datePublication || doc.dateCreation || '—';
                  return (
                    <div key={doc.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={16} style={{ color: cfg.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 150 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{doc.nom}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--secondary)', padding: '1px 6px', borderRadius: 'var(--r-xs)' }}>{CATEGORIE_LABELS[doc.categorie]}</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{doc.version} · {dateDisplay}{!doc.visibleClient ? ' · non visible' : ''}</span>
                          </div>
                        </div>
                        <span style={{ padding: '4px 10px', borderRadius: 'var(--r-full)', background: cfg.bg, color: cfg.color, fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{cfg.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        <button onClick={() => setPreview({ clientId: client.id, clientName: client.name, ref: client.ref, doc })} style={btnSm('var(--primary)', 'var(--secondary)')}><Eye size={12} /> Aperçu</button>
                        {doc.status === 'brouillon' && <button onClick={() => doPublish(doc, client.id)} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><Send size={12} /> Publier</button>}
                        {(doc.status === 'disponible' || doc.status === 'publie') && <button onClick={() => doRequestSign(doc, client.id)} style={btnSm('#8B5CF6', 'rgba(139,92,246,0.10)')}><PenSquare size={12} /> Demander signature</button>}
                        {doc.status === 'a-signer' && <button onClick={() => doMarkSigned(doc, client.id)} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><CheckCircle2 size={12} /> Marquer signé</button>}
                        {doc.visibleClient && doc.status !== 'archive' && <button onClick={() => doRetire(doc, client.id)} style={btnSm('var(--muted-foreground)', 'var(--muted)')}><EyeOff size={12} /> Retirer</button>}
                        {doc.status !== 'archive' && <button onClick={() => doArchive(doc, client.id)} style={btnSm('#C8921A', 'rgba(200,146,26,0.10)')}><Archive size={12} /> Archiver</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}

      {/* (N3 + suivi signature) Aperçu */}
      {preview && (() => {
        const timeline = (allCpiHistoryByClient[preview.clientId] ?? []).filter(e => e.action.toLowerCase().includes(preview.doc.nom.toLowerCase()));
        const cfg = CPI_STATUS_CFG[preview.doc.status];
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={() => setPreview(null)} style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--foreground)' }}>{preview.doc.nom}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{preview.clientName} · {preview.ref}</div>
                </div>
                <button onClick={() => setPreview(null)} style={{ background: 'var(--secondary)', border: 'none', borderRadius: 'var(--r-sm)', padding: 6, cursor: 'pointer' }}><X size={16} style={{ color: 'var(--muted-foreground)' }} /></button>
              </div>
              <div style={{ background: 'var(--background)', border: '1px dashed var(--border)', borderRadius: 'var(--r-md)', padding: '28px 20px', textAlign: 'center', marginBottom: 14 }}>
                <FileText size={30} style={{ color: cfg.color, margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{CATEGORIE_LABELS[preview.doc.categorie]} · {preview.doc.version}</div>
                {preview.doc.fileUrl ? (
                  <a href={preview.doc.fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                    <Download size={13} /> Ouvrir le fichier ({preview.doc.fichier ?? 'document'})
                  </a>
                ) : (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 8, fontStyle: 'italic' }}>Aucun fichier joint à ce document.</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {[
                  ['Statut', cfg.label],
                  ['Signature requise', preview.doc.signatureRequise ? 'Oui' : 'Non'],
                  ['Créé le', preview.doc.dateCreation],
                  ...(preview.doc.datePublication ? [['Publié le', preview.doc.datePublication] as [string, string]] : []),
                  ...(preview.doc.commentaire ? [['Note', preview.doc.commentaire] as [string, string]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>{k}</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <History size={14} style={{ color: 'var(--muted-foreground)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suivi du document</span>
                </div>
                {timeline.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Aucun événement enregistré.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {timeline.map(t => (
                      <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: '0.8125rem' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
                        <div><div style={{ color: 'var(--foreground)' }}>{t.action}</div><div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{t.date} · {t.heure} · {t.utilisateur}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => downloadRecap(preview.clientName, preview.ref, preview.doc, timeline)} style={btnOutline}><Download size={13} /> Télécharger le récap</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--foreground)', color: 'var(--background)', padding: '12px 18px', borderRadius: 'var(--r-sm)', fontSize: '0.875rem', fontWeight: 600, zIndex: 300, maxWidth: '360px' }}>{toast}</div>
      )}
    </div>
  );
}

function btnSm(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: bg, color, border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
}
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--input-background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)' };
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: 'var(--r-sm)', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' };
const btnOutline: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: 'var(--r-sm)', background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: 'var(--r-sm)', background: 'var(--secondary)', color: 'var(--primary)', border: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
