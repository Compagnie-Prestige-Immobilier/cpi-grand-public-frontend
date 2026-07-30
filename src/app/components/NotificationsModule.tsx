import React, { useState, useMemo } from 'react';
import { Bell, Send, Users, User } from 'lucide-react';
import { useDocState } from '../data/docStateContext';
import { useClientContext } from '../contexts/ClientContext';
import type { HistoEntry } from '../data/demoStore';

type NotifType = 'notification' | 'email' | 'sms' | 'whatsapp';
type NotifCible = 'client' | 'tous';

const TYPE_CFG: Record<NotifType, { label: string; color: string; bg: string }> = {
  notification: { label: 'Notification', color: 'var(--primary)', bg: 'var(--secondary)'      },
  email:        { label: 'Email',        color: '#C8921A',        bg: 'rgba(200,146,26,0.10)' },
  sms:          { label: 'SMS',          color: 'var(--success)', bg: 'rgba(26,107,68,0.10)'  },
  whatsapp:     { label: 'WhatsApp',     color: '#25D366',        bg: 'rgba(37,211,102,0.10)' },
};

const TEMPLATES = [
  'Votre dossier a été mis à jour. Veuillez vous connecter pour consulter les détails.',
  'Un document requis a été validé par votre conseiller CPI.',
  'Action requise : un document doit être remplacé dans votre dossier.',
  'Un document vous attend pour signature dans votre espace « Mon dossier ».',
  'Un décaissement a été effectué. Consultez le suivi de votre dossier.',
];

// Tri des dates FR.
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function sortKey(date: string, heure: string): string {
  const m = date.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!m) return date + ' ' + heure;
  const day = m[1].padStart(2, '0');
  const monthIdx = MONTHS_FR.findIndex(x => m[2].toLowerCase().startsWith(x.slice(0, 4)));
  const month = String((monthIdx < 0 ? 0 : monthIdx) + 1).padStart(2, '0');
  return `${m[3]}-${month}-${day} ${heure || '00:00'}`;
}

interface Props { agentName?: string; }

export default function NotificationsModule({ agentName = 'Agent CPI' }: Props) {
  const { allClients } = useClientContext();
  const { pushNotification, allHistoryByClient } = useDocState();

  const [cible, setCible] = useState<NotifCible>('client');
  const [selectedClient, setSelectedClient] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotifType>('notification');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const handleSend = () => {
    if (!message.trim()) return;
    if (cible === 'client' && !selectedClient) return;
    const target = cible === 'tous' ? 'tous' : selectedClient;
    pushNotification(target, message.trim(), TYPE_CFG[type].label, agentName);
    const dest = cible === 'tous' ? 'tous les clients' : (allClients.find(c => c.id === selectedClient)?.name ?? '');
    setMessage('');
    setSelectedClient('');
    showToast(`Notification envoyée à ${dest} — visible dans son dossier.`);
  };

  const canSend = message.trim() && (cible === 'tous' || selectedClient);

  // Historique réel des notifications envoyées (toutes traces de type 'notification').
  const sent = useMemo<HistoEntry[]>(() => {
    const all = Object.values(allHistoryByClient).flat().filter(e => e.type === 'notification') as HistoEntry[];
    const seen = new Set<string>();
    const unique = all.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    return unique.sort((a, b) => sortKey(b.date, b.heure).localeCompare(sortKey(a.date, a.heure)));
  }, [allHistoryByClient]);

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 'var(--r-sm)', background: 'var(--input-background)', border: '1px solid var(--border)', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)' };
  const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Notifications</h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0 }}>Envoyez une notification à un client ou à tous. Elle s'inscrit dans le suivi du dossier client.</p>
      </div>

      {/* Compose */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '20px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={15} style={{ color: 'var(--primary)' }} /> Composer une notification
        </div>

        {/* Cible */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Destinataire</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([['client', 'Un client', User], ['tous', 'Tous les clients', Users]] as const).map(([val, lbl, Icon]) => (
              <button key={val} onClick={() => setCible(val)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 14px', borderRadius: 'var(--r-sm)', border: `1px solid ${cible === val ? 'var(--primary)' : 'var(--border)'}`, background: cible === val ? 'var(--primary)' : 'transparent', color: cible === val ? 'var(--primary-foreground)' : 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: cible === val ? 700 : 500, cursor: 'pointer' }}>
                <Icon size={14} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {cible === 'client' && (
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Client</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={inputStyle}>
              <option value="">Sélectionner un client</option>
              {allClients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.ref}</option>)}
            </select>
          </div>
        )}

        {/* Canal */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Canal</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(Object.keys(TYPE_CFG) as NotifType[]).map(t => (
              <button key={t} onClick={() => setType(t)} style={{ padding: '6px 14px', borderRadius: 'var(--r-full)', border: `1px solid ${type === t ? TYPE_CFG[t].color : 'var(--border)'}`, background: type === t ? TYPE_CFG[t].bg : 'transparent', color: type === t ? TYPE_CFG[t].color : 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: type === t ? 700 : 500, cursor: 'pointer' }}>
                {TYPE_CFG[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Rédigez votre message..." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
        </div>

        {/* Templates */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '6px' }}>Messages types :</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {TEMPLATES.map((t, i) => (
              <button key={i} onClick={() => setMessage(t)} style={{ textAlign: 'left', padding: '8px 11px', borderRadius: 'var(--r-sm)', background: 'var(--input-background)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', cursor: 'pointer' }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSend} disabled={!canSend} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', borderRadius: 'var(--r-sm)', background: canSend ? 'var(--primary)' : 'var(--muted)', color: canSend ? 'var(--primary-foreground)' : 'var(--muted-foreground)', border: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700, cursor: canSend ? 'pointer' : 'not-allowed' }}>
            <Send size={15} /> Envoyer
          </button>
        </div>
      </div>

      {/* History — envois réels */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>Historique des envois</div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '3px 9px', borderRadius: 'var(--r-full)' }}>{sent.length}</span>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Aucune notification envoyée pour l'instant.</div>
          ) : sent.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--input-background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', flexWrap: 'wrap' }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={15} style={{ color: 'var(--primary)' }} /></div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', lineHeight: 1.45 }}>{n.action}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 3 }}>→ {n.cible} · {n.date} · {n.heure}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--foreground)', color: 'var(--background)', padding: '12px 18px', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, zIndex: 300, maxWidth: '360px' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
