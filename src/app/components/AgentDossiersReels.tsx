import { useState, useRef } from 'react';
import {
  User, FileText, CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle, Send,
  ChevronRight, ArrowLeft, PenSquare, Building, Banknote, CreditCard, UserCheck,
  ScrollText, Handshake, ClipboardList, FileSignature, Mail as MailIcon, Upload,
} from 'lucide-react';
import { useClientContext } from '../contexts/ClientContext';
import { useDocState, type SharedDoc } from '../data/docStateContext';
import { useCpiDocs, type CpiDoc } from '../data/cpiDocsContext';
import { useClientData } from '../data/useClientData';
import {
  TIMELINE_STEPS, computeJourneyStep,
  DOCS_VALIDES_INDEX, SIGNATURE_INDEX,
} from '../data/dossierJourney';

// ─── Config statuts pièces ────────────────────────────────────────────────────

type DocStatus = SharedDoc['status'];

const PIECE_CFG: Record<DocStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  'en-attente':  { label: 'À déposer',        color: 'var(--muted-foreground)', bg: 'var(--muted)',          icon: Clock },
  depose:        { label: 'Déposé — à vérifier', color: 'var(--chart-4)',       bg: 'rgba(176,80,112,0.08)', icon: Upload },
  verification:  { label: 'En vérification',  color: 'var(--accent)',           bg: 'rgba(200,146,26,0.10)', icon: Clock },
  accepte:       { label: 'Validé',           color: 'var(--success)',          bg: 'rgba(26,107,68,0.10)',  icon: CheckCircle2 },
  refuse:        { label: 'Refusé',           color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.08)',  icon: XCircle },
  'a-remplacer': { label: 'À remplacer',      color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.08)',  icon: RefreshCw },
};

const PIECE_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  identite: UserCheck, revenus: Banknote, bancaires: CreditCard,
};

const CPI_CAT_CFG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  contrats: { label: 'Contrat', icon: ScrollText }, conventions: { label: 'Convention', icon: Handshake },
  bancaires: { label: 'Bancaire', icon: CreditCard }, courriers: { label: 'Courrier', icon: MailIcon },
  pv: { label: 'PV', icon: ClipboardList }, autorisations: { label: 'Autorisation', icon: FileSignature },
};

const CPI_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',  color: 'var(--muted-foreground)', bg: 'var(--muted)' },
  disponible: { label: 'Disponible', color: 'var(--primary)',          bg: 'var(--secondary)' },
  publie:     { label: 'Publié',     color: 'var(--primary)',          bg: 'var(--secondary)' },
  'a-signer': { label: 'À signer',   color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.08)' },
  signe:      { label: 'Signé',      color: 'var(--success)',          bg: 'rgba(26,107,68,0.10)' },
  archive:    { label: 'Archivé',    color: 'var(--muted-foreground)', bg: 'var(--muted)' },
};

// ─── Dérivation de l'état d'un client ─────────────────────────────────────────

interface ClientState {
  submitted: boolean;
  docs: SharedDoc[];
  validated: number;
  total: number;
  hasIssue: boolean;
  allValid: boolean;
  activeStep: number;
  toSign: number;
}

function deriveClientState(
  clientId: string,
  allDocs: Record<string, SharedDoc[]>,
  etapes: Record<string, number>,
  cpiByClient: Record<string, CpiDoc[]>,
  submittedByClient: Record<string, boolean>,
): ClientState {
  const docs = allDocs[clientId] ?? [];
  const total = docs.length;
  const validated = docs.filter(d => d.status === 'accepte').length;
  const hasIssue = docs.some(d => d.status === 'refuse' || d.status === 'a-remplacer');
  const allValid = total > 0 && validated === total;
  const submitted = submittedByClient[clientId] ?? false;
  const etape = etapes[clientId] ?? DOCS_VALIDES_INDEX;
  const activeStep = computeJourneyStep(submitted, docs, etape);
  const toSign = (cpiByClient[clientId] ?? []).filter(d => d.visibleClient && d.signatureRequise && d.status === 'a-signer').length;
  return { submitted, docs, validated, total, hasIssue, allValid, activeStep, toSign };
}

// ─── Modale commentaire (refus / remplacement) ────────────────────────────────

function CommentModal({ title, cta, onConfirm, onClose }: { title: string; cta: string; onConfirm: (c: string) => void; onClose: () => void }) {
  const [txt, setTxt] = useState('');
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,8,16,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--r-md)', width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 24px 64px rgba(28,8,16,0.28)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>{title}</div>
        <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={4} placeholder="Précisez le motif pour le client…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--input-background)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', resize: 'vertical', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)', cursor: 'pointer' }}>Annuler</button>
          <button disabled={txt.trim().length < 3} onClick={() => onConfirm(txt.trim())}
            style={{ padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: txt.trim().length >= 3 ? 'var(--destructive)' : 'var(--muted)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: txt.trim().length >= 3 ? 'pointer' : 'not-allowed' }}>{cta}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Frise parcours + contrôles d'avancement ──────────────────────────────────

function ParcoursControl({ activeStep, allValid, submitted, onSet, agentName }: {
  activeStep: number; allValid: boolean; submitted: boolean;
  onSet: (etape: number) => void; agentName: string;
}) {
  return (
    <div style={{ background: 'var(--primary)', borderRadius: 'var(--r-md)', padding: '18px 20px', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800 }}>Parcours du dossier</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)' }}>Étape {activeStep + 1}/6 · {TIMELINE_STEPS[activeStep].label}</span>
      </div>
      {/* Frise compacte */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        {TIMELINE_STEPS.map((s, i) => {
          const past = i < activeStep, active = i === activeStep;
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? 1 : '0 0 auto' }}>
              <div title={s.label} style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: past ? 'var(--success)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.1)', border: `2px solid ${past ? 'var(--success)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {past ? <CheckCircle2 size={11} style={{ color: '#fff' }} /> : <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 800, color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>}
              </div>
              {i < TIMELINE_STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < activeStep ? 'var(--success)' : 'rgba(255,255,255,0.12)', margin: '0 3px' }} />}
            </div>
          );
        })}
      </div>
      {/* Contrôles */}
      {!submitted ? (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)' }}>Le client n'a pas encore envoyé sa demande.</div>
      ) : !allValid ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)' }}>
          <AlertCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} /> Validez d'abord toutes les pièces pour faire avancer le dossier.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: '→ Analyser',          etape: 3 },
            { label: '→ Validation banque', etape: 4 },
            { label: '→ Signature',         etape: 5 },
          ].map(b => {
            const isCurrent = activeStep === b.etape;
            const done = activeStep > b.etape;
            return (
              <button key={b.etape} onClick={() => onSet(b.etape)} disabled={isCurrent}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 13px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,255,255,0.2)', background: isCurrent ? 'var(--accent)' : done ? 'rgba(26,107,68,0.3)' : 'rgba(255,255,255,0.08)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: isCurrent ? 'default' : 'pointer', opacity: isCurrent ? 1 : 0.95 }}>
                {done && <CheckCircle2 size={12} />}{b.label}
              </button>
            );
          })}
          {activeStep > DOCS_VALIDES_INDEX && (
            <button onClick={() => onSet(activeStep - 1)} style={{ padding: '8px 13px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>← Reculer</button>
          )}
        </div>
      )}
      {activeStep >= SIGNATURE_INDEX && (
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
          <CheckCircle2 size={13} /> Dossier finalisé — prêt pour signature
        </div>
      )}
    </div>
  );
}

// ─── Section carte ────────────────────────────────────────────────────────────

function Card({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>{title}</div>
          {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 1 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

// ─── Fiche dossier (client sélectionné) ───────────────────────────────────────

function DossierFiche({ agentName, onBack }: { agentName: string; onBack: () => void }) {
  const client = useClientData();
  const { requisDocs, dossierEtape, submittedByClient, acceptDoc, refuseDoc, requestReplacement, setDossierEtape } = useDocState();
  const { cpiDocs, publishDoc, requestSignature, markSigned, createDoc } = useCpiDocs();
  const [modal, setModal] = useState<{ docId: string; mode: 'refuse' | 'remplacer' } | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const total = requisDocs.length;
  const validated = requisDocs.filter(d => d.status === 'accepte').length;
  const allValid = total > 0 && validated === total;
  const submitted = submittedByClient[client.id] ?? false;
  const activeStep = computeJourneyStep(submitted, requisDocs, dossierEtape);

  const visibleCpi = cpiDocs.filter(d => d.visibleClient && d.status !== 'archive');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Retour + en-tête client */}
      <div>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', padding: 0, marginBottom: 12 }}>
          <ArrowLeft size={15} /> Tous les dossiers
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.0625rem', flexShrink: 0 }}>
            {client.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)' }}>{client.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
              {[client.ref, client.projectNom, client.adresse].filter(x => x && x !== '—').map(x => (
                <span key={x} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', background: 'var(--input-background)', padding: '2px 9px', borderRadius: 'var(--r-full)' }}>{x}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Parcours + contrôles */}
      <ParcoursControl activeStep={activeStep} allValid={allValid} submitted={submitted} agentName={agentName}
        onSet={etape => setDossierEtape(etape, agentName, client.id)} />

      {/* Pièces justificatives */}
      <Card title="Pièces justificatives" sub={`${validated}/${total} validée${validated > 1 ? 's' : ''}`}
        right={allValid ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(26,107,68,0.10)', padding: '3px 9px', borderRadius: 'var(--r-full)' }}><CheckCircle2 size={12} /> Complet</span> : undefined}>
        {requisDocs.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Aucune pièce déposée.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requisDocs.map(d => {
              const cfg = PIECE_CFG[d.status];
              const Icon = PIECE_ICON[d.id] ?? FileText;
              const canValidate = d.status === 'depose' || d.status === 'verification' || d.status === 'refuse' || d.status === 'a-remplacer';
              return (
                <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} style={{ color: cfg.color }} /></div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{d.label}</div>
                      {d.submittedLabel && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{d.submittedLabel}{d.date ? ` · ${d.date}` : ''}</div>}
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--r-full)', background: cfg.bg, color: cfg.color, fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap' }}><cfg.icon size={11} />{cfg.label}</span>
                  </div>
                  {d.commentaire && (
                    <div style={{ marginTop: 8, borderLeft: `3px solid ${d.status === 'accepte' ? 'var(--success)' : 'var(--destructive)'}`, paddingLeft: 10, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>"{d.commentaire}"</div>
                  )}
                  {canValidate && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => acceptDoc(d.id, agentName, client.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--success)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}><CheckCircle2 size={13} /> Valider</button>
                      <button onClick={() => setModal({ docId: d.id, mode: 'remplacer' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}><RefreshCw size={13} /> Remplacement</button>
                      <button onClick={() => setModal({ docId: d.id, mode: 'refuse' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(192,57,43,0.3)', background: 'transparent', color: 'var(--destructive)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}><XCircle size={13} /> Refuser</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Documents CPI */}
      <Card title="Documents du dossier (CPI)" sub="Documents transmis au client (téléchargement, signature)"
        right={<button onClick={() => setShowUpload(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}><Upload size={13} /> Téléverser</button>}>
        {visibleCpi.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Aucun document publié pour ce client.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleCpi.map(d => {
              const scfg = CPI_STATUS_CFG[d.status] ?? CPI_STATUS_CFG.disponible;
              const cat = CPI_CAT_CFG[d.categorie];
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', flexWrap: 'wrap' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--input-background)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {cat ? <cat.icon size={15} style={{ color: 'var(--primary)' }} /> : <FileText size={15} style={{ color: 'var(--primary)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>{d.nom}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{cat?.label ?? d.categorie}{d.version ? ` · ${d.version}` : ''}</div>
                  </div>
                  <span style={{ padding: '3px 9px', borderRadius: 'var(--r-full)', background: scfg.bg, color: scfg.color, fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{scfg.label}</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {d.status === 'disponible' && !d.signatureRequise && (
                      <button onClick={() => requestSignature(d.id, agentName, client.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--r-sm)', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><PenSquare size={12} /> Demander signature</button>
                    )}
                    {d.status === 'a-signer' && (
                      <button onClick={() => markSigned(d.id, agentName, client.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><CheckCircle2 size={12} /> Marquer signé</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* documents en brouillon à publier */}
        {cpiDocs.filter(d => d.status === 'brouillon').map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)', marginTop: 8, flexWrap: 'wrap' }}>
            <FileText size={15} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 140, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)' }}>{d.nom}</div>
            <span style={{ padding: '3px 9px', borderRadius: 'var(--r-full)', background: 'var(--muted)', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700 }}>Brouillon</span>
            <button onClick={() => publishDoc(d.id, agentName, client.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}><Send size={12} /> Publier</button>
          </div>
        ))}
      </Card>

      {modal && (
        <CommentModal
          title={modal.mode === 'refuse' ? 'Refuser la pièce' : 'Demander un remplacement'}
          cta={modal.mode === 'refuse' ? 'Refuser' : 'Demander'}
          onClose={() => setModal(null)}
          onConfirm={c => {
            if (modal.mode === 'refuse') refuseDoc(modal.docId, agentName, c, client.id);
            else requestReplacement(modal.docId, agentName, c, client.id);
            setModal(null);
          }}
        />
      )}

      {showUpload && (
        <UploadDocModal
          onClose={() => setShowUpload(false)}
          onPublish={(nom, categorie, signatureRequise, taille) => {
            createDoc({ categorie: categorie as CpiDoc['categorie'], nom, version: 'V1', auteur: agentName, signatureRequise, format: 'PDF', taille }, agentName, true, client.id);
            setShowUpload(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Modale : téléverser un document pour le client ───────────────────────────

function UploadDocModal({ onClose, onPublish }: { onClose: () => void; onPublish: (nom: string, categorie: string, signatureRequise: boolean, taille: string) => void }) {
  const [file, setFile] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('contrats');
  const [signature, setSignature] = useState(false);
  const [taille, setTaille] = useState('—');
  const inputRef = useRef<HTMLInputElement>(null);

  const startUpload = (name: string, sizeMo?: number) => {
    setFile(name); setDone(false); setProgress(0);
    if (!nom) setNom(name.replace(/\.[^.]+$/, ''));
    setTaille(sizeMo ? `${sizeMo.toFixed(1)} Mo` : '—');
    let p = 0;
    const iv = setInterval(() => { p += Math.random() * 24 + 10; if (p >= 100) { p = 100; clearInterval(iv); setDone(true); } setProgress(Math.round(p)); }, 130);
  };

  const canPublish = done && nom.trim().length >= 3;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,8,16,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--r-md)', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(28,8,16,0.28)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Téléverser un document</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: 16 }}>Le document sera transmis au client, qui pourra le télécharger et le signer si nécessaire.</div>

        {/* Zone de dépôt */}
        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) startUpload(f.name, f.size / 1048576); }}
            onClick={() => inputRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: '26px 16px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--secondary)' : 'var(--input-background)' }}>
            <Upload size={26} style={{ color: 'var(--primary)', margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>Glissez le fichier ici, ou cliquez</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>PDF, JPG ou PNG · 10 Mo max</div>
            <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) startUpload(f.name, f.size / 1048576); }} />
          </div>
        ) : (
          <div style={{ background: 'var(--input-background)', borderRadius: 'var(--r-sm)', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
              {done && <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />}
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: done ? 'var(--success)' : 'var(--primary)', borderRadius: 'var(--r-full)', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {/* Métadonnées */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Nom du document</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Convention de financement"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--input-background)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Catégorie</label>
            <select value={categorie} onChange={e => setCategorie(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--input-background)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', boxSizing: 'border-box' }}>
              {Object.entries(CPI_CAT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={signature} onChange={e => setSignature(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)' }}>Signature du client requise</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)', cursor: 'pointer' }}>Annuler</button>
          <button disabled={!canPublish} onClick={() => onPublish(nom.trim(), categorie, signature, taille)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: canPublish ? 'var(--primary)' : 'var(--muted)', color: canPublish ? '#fff' : 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: canPublish ? 'pointer' : 'not-allowed' }}>
            <Send size={14} /> Transmettre au client
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Liste des dossiers réels ─────────────────────────────────────────────────

export default function AgentDossiersReels({ agentName, mode = 'actifs' }: { agentName: string; mode?: 'actifs' | 'traites' | 'clients' | 'dashboard' }) {
  const { allClients, selectedClientId, setSelectedClientId } = useClientContext();
  const { allDocsByClient, dossierEtapes, submittedByClient } = useDocState();
  const { allCpiDocsByClient } = useCpiDocs();
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) {
    return <DossierFiche agentName={agentName} onBack={() => setOpenId(null)} />;
  }

  const rows = allClients.map(c => ({ summary: c, st: deriveClientState(c.id, allDocsByClient, dossierEtapes, allCpiDocsByClient, submittedByClient) }));

  // ── Tableau de bord : KPIs + actions requises ──────────────────────────────
  if (mode === 'dashboard') {
    const openFiche = (id: string) => { setSelectedClientId(id); setOpenId(id); };
    const nbTotal     = rows.length;
    const nbFinalises = rows.filter(r => r.st.activeStep >= SIGNATURE_INDEX).length;
    const nbActifs    = nbTotal - nbFinalises;
    const nbAVerifier = rows.reduce((n, r) => n + r.st.docs.filter(d => d.status === 'depose' || d.status === 'verification').length, 0);
    const nbACorriger = rows.filter(r => r.st.hasIssue).length;
    const nbASigner   = rows.reduce((n, r) => n + r.st.toSign, 0);
    const nbAAvancer  = rows.filter(r => r.st.allValid && r.st.activeStep === DOCS_VALIDES_INDEX).length;

    // Répartition par étape
    const parEtape = TIMELINE_STEPS.map((s, i) => ({ label: s.label, n: rows.filter(r => r.st.activeStep === i).length }));

    // Actions requises (un dossier peut apparaître avec plusieurs raisons)
    const actions = rows.map(r => {
      const reasons: { txt: string; color: string }[] = [];
      const nDepose = r.st.docs.filter(d => d.status === 'depose').length;
      if (nDepose > 0) reasons.push({ txt: `${nDepose} pièce${nDepose > 1 ? 's' : ''} à vérifier`, color: 'var(--chart-4)' });
      if (r.st.hasIssue) reasons.push({ txt: 'pièce à corriger (client)', color: 'var(--destructive)' });
      if (r.st.allValid && r.st.activeStep === DOCS_VALIDES_INDEX) reasons.push({ txt: 'dossier à faire avancer', color: 'var(--accent)' });
      if (r.st.toSign > 0) reasons.push({ txt: `${r.st.toSign} document${r.st.toSign > 1 ? 's' : ''} à signer (client)`, color: 'var(--accent)' });
      return { summary: r.summary, st: r.st, reasons };
    }).filter(a => a.reasons.length > 0);

    const KPI = ({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) => (
      <div style={{ flex: '1 1 140px', minWidth: 140, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 18px' }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <FileText size={17} style={{ color }} />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 4 }}>{label}</div>
      </div>
    );

    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'var(--font-sans)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Tableau de bord</h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: '4px 0 0' }}>Vue d'ensemble de tous les dossiers clients — {agentName}</p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KPI label="Dossiers actifs"   value={nbActifs}    color="var(--primary)"     bg="var(--secondary)" />
          <KPI label="Pièces à vérifier" value={nbAVerifier} color="var(--chart-4)"     bg="rgba(176,80,112,0.10)" />
          <KPI label="À faire avancer"   value={nbAAvancer}  color="var(--accent)"      bg="rgba(200,146,26,0.12)" />
          <KPI label="Docs à signer"     value={nbASigner}   color="var(--destructive)" bg="rgba(192,57,43,0.08)" />
          <KPI label="Dossiers finalisés" value={nbFinalises} color="var(--success)"    bg="rgba(26,107,68,0.12)" />
        </div>

        {/* Répartition par étape */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 14 }}>Répartition par étape</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {parEtape.map((e, i) => (
              <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 130, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>{i + 1}. {e.label}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--muted)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${nbTotal ? (e.n / nbTotal) * 100 : 0}%`, background: i >= SIGNATURE_INDEX ? 'var(--success)' : 'var(--primary)', borderRadius: 'var(--r-full)' }} />
                </div>
                <span style={{ width: 20, textAlign: 'right', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)' }}>{e.n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions requises */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>Actions requises</div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: actions.length ? 'var(--accent)' : 'var(--success)', background: actions.length ? 'rgba(200,146,26,0.10)' : 'rgba(26,107,68,0.10)', padding: '3px 9px', borderRadius: 'var(--r-full)' }}>{actions.length} dossier{actions.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ padding: 14 }}>
            {actions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--success)', margin: '0 auto 8px', display: 'block' }} />
                Aucune action en attente. Tous les dossiers sont à jour.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actions.map(a => (
                  <button key={a.summary.id} onClick={() => openFiche(a.summary.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--input-background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left', width: '100%', flexWrap: 'wrap' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.8125rem', flexShrink: 0 }}>
                      {a.summary.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>{a.summary.name}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{a.summary.ref}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {a.reasons.map((r, i) => (
                        <span key={i} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: r.color, background: 'var(--card)', border: `1px solid ${r.color}33`, padding: '3px 8px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>{r.txt}</span>
                      ))}
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span style={{ display: 'none' }}>{selectedClientId}</span>
      </div>
    );
  }

  const filtered = mode === 'traites'
    ? rows.filter(r => r.st.activeStep >= SIGNATURE_INDEX)
    : mode === 'actifs'
    ? rows.filter(r => r.st.activeStep < SIGNATURE_INDEX)
    : rows; // clients = tous

  const title = mode === 'traites' ? 'Dossiers traités' : mode === 'clients' ? 'Clients' : 'Dossiers en cours';
  const subtitle = mode === 'clients'
    ? `${rows.length} client${rows.length > 1 ? 's' : ''} — cliquez pour gérer le dossier`
    : mode === 'traites' ? 'Dossiers finalisés (signature atteinte)' : 'Dossiers à traiter et à faire avancer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-sans)' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{title}</h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: '4px 0 0' }}>{subtitle}</p>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          <User size={26} style={{ color: 'var(--muted-foreground)', margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Aucun dossier dans cette catégorie.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(({ summary, st }) => {
            const stepLabel = TIMELINE_STEPS[st.activeStep].label;
            const needsAttention = st.hasIssue || st.docs.some(d => d.status === 'depose');
            return (
              <button key={summary.id}
                onClick={() => { setSelectedClientId(summary.id); setOpenId(summary.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--card)', border: `1px solid ${needsAttention ? 'rgba(200,146,26,0.28)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', flexShrink: 0 }}>
                  {summary.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>{summary.name}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{summary.ref} · {summary.projectNom}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--secondary)', padding: '3px 9px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>Étape {st.activeStep + 1}/6 · {stepLabel}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--success)' }}>{st.validated}/{st.total} pièces</span>
                    {st.docs.some(d => d.status === 'depose') && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--chart-4)' }}>· à vérifier</span>}
                    {st.hasIssue && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--destructive)' }}>· à corriger</span>}
                    {st.toSign > 0 && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, color: 'var(--accent)' }}>· {st.toSign} à signer</span>}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <span style={{ display: 'none' }}>{selectedClientId}</span>
    </div>
  );
}
