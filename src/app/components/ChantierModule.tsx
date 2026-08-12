import React, { useRef, useState } from 'react';
import {
  HardHat, Camera, MessageSquare, ChevronDown, ChevronUp, CheckCircle2,
  AlertCircle, Edit2, Upload, Plus, Calendar, Send, Loader2,
} from 'lucide-react';
import { useChantierState, type ChantierStatut, type CalendarEventType, type PublicationType } from '../data/chantierStateContext';
import { STATUT_TRANCHE } from '../lib/statuts';
import { Modal } from './ui/overlays';

type TrancheStatus = 'valide' | 'en-cours' | 'en-attente' | 'bloque';
type ChantierEtape = 'Préparation' | 'Fondations' | 'Gros œuvre' | 'Second œuvre' | 'Finitions' | 'Livraison';

interface Tranche {
  num: number; label: string; pct: number;
  status: TrancheStatus; date?: string; comment?: string;
}

interface ChantierProject {
  id: string; nom: string; client: string; ref: string;
  progression: number; etape: ChantierEtape;
  chefChantier: string; entreprise: string;
  dateDebut: string; dateLivraison: string;
  tranches: Tranche[];
  photos: string[];
  commentaires: { auteur: string; date: string; texte: string }[];
}


const ETAPES: ChantierEtape[] = ['Préparation', 'Fondations', 'Gros œuvre', 'Second œuvre', 'Finitions', 'Livraison'];
const STATUTS: { value: ChantierStatut; label: string }[] = [
  { value: 'en-cours',    label: 'En cours'     },
  { value: 'suspendu',    label: 'Suspendu'      },
  { value: 'en-retard',   label: 'En retard'     },
  { value: 'termine',     label: 'Terminé'       },
  { value: 'livre',       label: 'Livré'          },
  { value: 'non-demarre', label: 'Non démarré'   },
];

const PUB_TYPES: { value: PublicationType; label: string }[] = [
  { value: 'actualite',    label: 'Actualité'    },
  { value: 'photo',        label: 'Photo'        },
  { value: 'video',        label: 'Vidéo'        },
  { value: 'document',     label: 'Document'     },
  { value: 'commentaire',  label: 'Commentaire'  },
  { value: 'etape-validee',label: 'Étape validée'},
  { value: 'visite',       label: 'Visite'       },
];

const EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
  { value: 'visite',            label: 'Visite de chantier'    },
  { value: 'inspection',        label: 'Inspection'             },
  { value: 'livraison-materiaux',label: 'Livraison matériaux'  },
  { value: 'debut-etape',       label: 'Début d\'étape'        },
  { value: 'fin-etape',         label: 'Fin d\'étape'          },
  { value: 'rdv-client',        label: 'Rendez-vous client'    },
  { value: 'reception',         label: 'Réception'             },
  { value: 'remise-cles',       label: 'Remise des clés'       },
];

const CH1_ID = 'ch-live';

// Chantier secondaire neutre (base vide — aucun persona fictif, non affiché).
const INITIAL_CH2: ChantierProject = {
  id: 'ch2', nom: '—', client: '—',
  ref: '—', progression: 0, etape: 'Préparation',
  chefChantier: '—', entreprise: '—',
  dateDebut: '—', dateLivraison: '—',
  tranches: [],
  photos: [],
  commentaires: [],
};

interface Props { agentName?: string; }

export default function ChantierModule({ agentName = 'Agent CPI' }: Props) {
  const {
    chantierInfo, tranches: ctxTranches, publications: ctxPubs, medias: ctxMedias,
    updateProgression, updateEtape, updateStatut, updateLivraison,
    validateTranche: ctxValidateTranche, addTrancheComment: ctxAddTrancheComment,
    addPublication, addMedia, addEvent,
    loading, error, retry,
  } = useChantierState();

  // Sélecteur de fichier : un média part toujours sur le stockage privé CPI.
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Build live ch1 from context
  const ch1Live: ChantierProject = {
    id: CH1_ID,
    nom: chantierInfo.projet,
    client: chantierInfo.client,
    ref: chantierInfo.reference,
    progression: chantierInfo.progression,
    etape: chantierInfo.etapeActuelle as ChantierEtape,
    chefChantier: chantierInfo.chefChantier,
    entreprise: chantierInfo.entreprise,
    dateDebut: chantierInfo.dateDebut,
    dateLivraison: chantierInfo.dateLivraison,
    tranches: ctxTranches.map(t => ({
      num: t.num, label: `${t.label} (${t.pct}%)`, pct: t.pct,
      status: (t.etat === 'terminee' ? 'valide' : t.etat) as TrancheStatus,
      date: t.date, comment: t.comment,
    })),
    photos: ctxMedias.filter(m => m.type === 'photo').map(m => m.titre),
    commentaires: ctxPubs
      .filter(p => p.type === 'commentaire')
      .map(p => ({ auteur: p.auteur, date: p.date, texte: p.titre || p.description })),
  };

  const [ch2, setCh2] = useState<ChantierProject>(INITIAL_CH2);
  void ch2; void setCh2; // chantier secondaire neutralisé (base vide)
  // Seul le chantier réel du client sélectionné est présenté.
  const chantiers = [ch1Live];

  const [expanded, setExpanded] = useState<string | null>(CH1_ID);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProg, setEditProg] = useState(0);
  const [editEtape, setEditEtape] = useState<ChantierEtape>('Gros œuvre');
  const [editStatut, setEditStatut] = useState<ChantierStatut>('en-cours');
  const [editLivraison, setEditLivraison] = useState('');
  const [commentText, setCommentText] = useState('');
  const [trancheComment, setTrancheComment] = useState<{ chId: string; trNum: number } | null>(null);
  const [trancheCommentText, setTrancheCommentText] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Publication form state (for ch1)
  const [showPubForm, setShowPubForm] = useState(false);
  const [pubForm, setPubForm] = useState({ titre: '', description: '', type: 'actualite' as PublicationType, phase: 2, visibleClient: true });

  // Event form state (for ch1)
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ titre: '', type: 'visite' as CalendarEventType, date: '', heure: '', description: '', visibleClient: true });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const startEdit = (ch: ChantierProject) => {
    setEditingId(ch.id);
    setEditProg(ch.progression);
    setEditEtape(ch.etape);
    setEditStatut(ch.id === CH1_ID ? chantierInfo.statut : 'en-cours');
    // L'API attend une vraie date : le champ de saisie est un `<input type="date">`.
    setEditLivraison(chantierInfo.dateLivraisonIso);
  };

  /**
   * La confirmation n'est plus affichée au clic mais à la réponse du serveur.
   *
   * Le changement de statut est celui qui compte : l'API refuse désormais les
   * transitions illégales (« non démarré » → « livré »…) avec un 409 dont le
   * message énumère ce qui est possible. Annoncer « Avancement mis à jour »
   * avant cette réponse faisait cohabiter à l'écran une confirmation et un
   * refus portant sur le même geste.
   */
  const saveEdit = (chId: string) => {
    const ok = () => showToast("Avancement mis à jour — visible dans l'espace client.");
    if (chId === CH1_ID) {
      const statutChange = editStatut !== chantierInfo.statut;
      updateProgression(editProg, agentName, undefined, statutChange ? undefined : ok);
      if (editEtape !== ch1Live.etape) updateEtape(editEtape, agentName);
      // Le statut, s'il change, porte la confirmation : c'est la seule des
      // quatre écritures que le serveur peut refuser pour cause de séquence.
      if (statutChange) updateStatut(editStatut, agentName, ok);
      if (editLivraison !== chantierInfo.dateLivraisonIso) updateLivraison(editLivraison, agentName);
    } else {
      setCh2(prev => ({ ...prev, progression: editProg, etape: editEtape, dateLivraison: editLivraison }));
      ok();
    }
    setEditingId(null);
  };

  const addComment = (chId: string) => {
    if (!commentText.trim()) return;
    if (chId === CH1_ID) {
      addPublication({
        phase: 0, titre: commentText.trim(), description: '',
        type: 'commentaire', visibleClient: true, auteur: agentName,
      }, agentName, () => showToast('Commentaire ajouté.'));
    } else {
      setCh2(prev => ({
        ...prev,
        commentaires: [{ auteur: agentName, date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), texte: commentText.trim() }, ...prev.commentaires],
      }));
      showToast('Commentaire ajouté.');
    }
    setCommentText('');
  };

  // Le serveur refuse une tranche validée hors ordre (409) : la confirmation
  // attend donc sa réponse plutôt que de partir au clic.
  const validateTranche = (chId: string, trNum: number) => {
    if (chId === CH1_ID) {
      ctxValidateTranche(trNum, agentName, () => showToast('Tranche validée.'));
    } else {
      setCh2(prev => ({
        ...prev,
        tranches: prev.tranches.map(t => t.num !== trNum ? t : {
          ...t, status: 'valide',
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        }),
      }));
      showToast('Tranche validée.');
    }
  };

  const saveTrancheComment = () => {
    if (!trancheComment || !trancheCommentText.trim()) return;
    const { chId, trNum } = trancheComment;
    if (chId === CH1_ID) {
      ctxAddTrancheComment(trNum, trancheCommentText.trim(), agentName, () => showToast('Commentaire de tranche enregistré.'));
    } else {
      setCh2(prev => ({
        ...prev,
        tranches: prev.tranches.map(t => t.num !== trNum ? t : { ...t, comment: trancheCommentText.trim() }),
      }));
      showToast('Commentaire de tranche enregistré.');
    }
    setTrancheComment(null);
    setTrancheCommentText('');
  };

  const submitPub = () => {
    if (!pubForm.titre.trim()) return;
    const visible = pubForm.visibleClient;
    addPublication({ ...pubForm, auteur: agentName }, agentName,
      () => showToast(`Publication ajoutée${visible ? ' — visible dans l\'espace client.' : ' (interne).'}`));
    setPubForm({ titre: '', description: '', type: 'actualite', phase: 2, visibleClient: true });
    setShowPubForm(false);
  };

  const submitEvent = () => {
    if (!eventForm.titre.trim() || !eventForm.date.trim()) return;
    const visible = eventForm.visibleClient;
    addEvent({ ...eventForm, statut: 'prevu' }, agentName,
      () => showToast(`Événement planifié${visible ? ' — visible dans l\'espace client.' : '.'}`));
    setEventForm({ titre: '', type: 'visite', date: '', heure: '', description: '', visibleClient: true });
    setShowEventForm(false);
  };

  /** Dépôt d'une photo/vidéo : le fichier est requis, le titre vient du nom. */
  const submitMedia = (file: File) => {
    const estVideo = file.type.startsWith('video/');
    addMedia({
      type: estVideo ? 'video' : 'photo',
      titre: file.name.replace(/\.[^.]+$/, ''),
      description: '',
      phase: 2,
      auteur: agentName,
      url: '',
      bg: 'linear-gradient(135deg,#630210,#B05070)',
      visibleClient: true,
    }, agentName, file, () => showToast('Média envoyé — visible dans l\'espace client.'));
    showToast('Envoi du média en cours…');
  };

  const header = (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '18px 20px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Suivi chantier</h2>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0 }}>Gérez l'avancement des chantiers. Les mises à jour sont visibles dans l'espace client.</p>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {header}
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px', background: 'var(--card)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          <Loader2 size={16} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} /> Chargement du chantier…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {header}
        <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 24px', background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <AlertCircle size={20} style={{ color: 'var(--destructive)' }} />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0, maxWidth: 420, lineHeight: 1.6 }}>{error}</p>
          <button onClick={retry} style={btnPrimary}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      {header}

      {chantiers.map(ch => {
        const isOpen = expanded === ch.id;
        const isEditing = editingId === ch.id;
        const isCh1 = ch.id === CH1_ID;
        return (
          <div key={ch.id} style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {/* Project header */}
            <button onClick={() => setExpanded(isOpen ? null : ch.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <HardHat size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{ch.nom}</span>
                  {isCh1 && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--secondary)', padding: '1px 6px' }}>CPI Connecté</span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  {ch.client} · {ch.ref} · Étape : <strong style={{ color: 'var(--foreground)' }}>{ch.etape}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{ch.progression}%</div>
                  <div style={{ width: '80px', height: '4px', background: 'var(--muted)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ch.progression}%`, background: 'var(--primary)', borderRadius: '2px', transition: 'width 0.4s' }} />
                  </div>
                </div>
                {isOpen ? <ChevronUp size={15} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={15} style={{ color: 'var(--muted-foreground)' }} />}
              </div>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {/* Info + edit */}
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    {[
                      { label: 'Chef chantier',   value: ch.chefChantier  },
                      { label: 'Entreprise',       value: ch.entreprise    },
                      { label: 'Début',            value: ch.dateDebut     },
                      { label: 'Livraison prévue', value: ch.dateLivraison },
                    ].map(row => (
                      <div key={row.label} style={{ padding: '10px 12px', background: 'var(--background)' }}>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '3px' }}>{row.label}</div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>{row.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Edit avancement */}
                  {isEditing ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', padding: '14px', background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                      <div>
                        <label style={labelStyle}>Progression (%)</label>
                        <input type="number" min={0} max={100} value={editProg} onChange={e => setEditProg(Math.max(0, Math.min(100, Number(e.target.value))))} style={{ ...inputStyle, width: '90px' }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Étape courante</label>
                        <select value={editEtape} onChange={e => setEditEtape(e.target.value as ChantierEtape)} style={inputStyle}>
                          {ETAPES.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      {isCh1 && (
                        <>
                          <div>
                            <label style={labelStyle}>Statut</label>
                            <select value={editStatut} onChange={e => setEditStatut(e.target.value as ChantierStatut)} style={inputStyle}>
                              {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Livraison estimée</label>
                            <input type="date" value={editLivraison} onChange={e => setEditLivraison(e.target.value)} style={inputStyle} />
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingId(null)} style={btnOutline}>Annuler</button>
                        <button onClick={() => saveEdit(ch.id)} style={btnPrimary}><CheckCircle2 size={13} /> Enregistrer</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => startEdit(ch)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--secondary)', color: 'var(--primary)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                        <Edit2 size={13} /> Modifier l'avancement
                      </button>
                      {isCh1 && (
                        <>
                          <button onClick={() => setShowPubForm(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--secondary)', color: 'var(--primary)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                            <Send size={13} /> Publier mise à jour
                          </button>
                          <button onClick={() => setShowEventForm(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--secondary)', color: 'var(--primary)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                            <Calendar size={13} /> Planifier événement
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Publication form */}
                  {isCh1 && showPubForm && (
                    <div style={{ marginTop: '12px', padding: '14px', background: 'var(--background)', border: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '10px' }}>Nouvelle publication</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Titre</label>
                          <input value={pubForm.titre} onChange={e => setPubForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Toiture posée" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Type</label>
                          <select value={pubForm.type} onChange={e => setPubForm(f => ({ ...f, type: e.target.value as PublicationType }))} style={inputStyle}>
                            {PUB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Phase</label>
                          <select value={pubForm.phase} onChange={e => setPubForm(f => ({ ...f, phase: Number(e.target.value) }))} style={inputStyle}>
                            {[1,2,3,4].map(n => <option key={n} value={n}>Phase {n}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                          <input type="checkbox" id="pubVisible" checked={pubForm.visibleClient} onChange={e => setPubForm(f => ({ ...f, visibleClient: e.target.checked }))} />
                          <label htmlFor="pubVisible" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', cursor: 'pointer' }}>Visible client</label>
                        </div>
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={labelStyle}>Description (optionnelle)</label>
                        <textarea value={pubForm.description} onChange={e => setPubForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowPubForm(false)} style={btnOutline}>Annuler</button>
                        <button onClick={submitPub} disabled={!pubForm.titre.trim()} style={{ ...btnPrimary, opacity: pubForm.titre.trim() ? 1 : 0.5 }}><Send size={13} /> Publier</button>
                      </div>
                    </div>
                  )}

                  {/* Event form */}
                  {isCh1 && showEventForm && (
                    <div style={{ marginTop: '12px', padding: '14px', background: 'var(--background)', border: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '10px' }}>Planifier un événement</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Titre</label>
                          <input value={eventForm.titre} onChange={e => setEventForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Visite de chantier" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Type</label>
                          <select value={eventForm.type} onChange={e => setEventForm(f => ({ ...f, type: e.target.value as CalendarEventType }))} style={inputStyle}>
                            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Date</label>
                          <input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Heure (optionnelle)</label>
                          <input type="time" value={eventForm.heure} onChange={e => setEventForm(f => ({ ...f, heure: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                          <input type="checkbox" id="evVisible" checked={eventForm.visibleClient} onChange={e => setEventForm(f => ({ ...f, visibleClient: e.target.checked }))} />
                          <label htmlFor="evVisible" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', cursor: 'pointer' }}>Visible client</label>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowEventForm(false)} style={btnOutline}>Annuler</button>
                        <button onClick={submitEvent} disabled={!eventForm.titre.trim() || !eventForm.date.trim()} style={{ ...btnPrimary, opacity: eventForm.titre.trim() && eventForm.date.trim() ? 1 : 0.5 }}><Calendar size={13} /> Planifier</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tranches */}
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '12px' }}>Tranches bancaires</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ch.tranches.map(t => {
                      const cfg = STATUT_TRANCHE[t.status];
                      return (
                        <div key={t.num} style={{ padding: '12px 14px', background: 'var(--background)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ width: '28px', height: '28px', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.875rem', color: 'var(--primary)' }}>T{t.num}</div>
                          <div style={{ flex: 1, minWidth: '120px' }}>
                            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{t.label}</div>
                            {t.comment && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px', fontStyle: 'italic' }}>{t.comment}</div>}
                            {t.date && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>Validée le {t.date}</div>}
                          </div>
                          <span style={{ padding: '2px 8px', background: cfg.bg, color: cfg.color, fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700 }}>{cfg.label}</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {t.status !== 'valide' && (
                              <button onClick={() => validateTranche(ch.id, t.num)} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><CheckCircle2 size={12} /> Valider</button>
                            )}
                            <button onClick={() => { setTrancheComment({ chId: ch.id, trNum: t.num }); setTrancheCommentText(t.comment || ''); }} style={btnSm('var(--primary)', 'var(--secondary)')}><MessageSquare size={12} /> Commenter</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Photos */}
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      Photos & vidéos
                      {isCh1 && <span style={{ marginLeft: '8px', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px' }}>{ch.photos.length} média{ch.photos.length > 1 ? 's' : ''}</span>}
                    </div>
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) submitMedia(file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        onClick={() => { if (isCh1) fileInputRef.current?.click(); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'var(--secondary)', color: 'var(--primary)', border: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                        <Upload size={13} /> Ajouter
                      </button>
                    </>
                  </div>
                  {ch.photos.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {ch.photos.slice(0, 6).map((p, i) => (
                        <div key={i} style={{ width: '80px', height: '60px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                          <Camera size={18} style={{ color: 'var(--muted-foreground)' }} />
                          <div style={{ position: 'absolute', bottom: '2px', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '0.5rem', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 3px' }}>{p}</div>
                        </div>
                      ))}
                      {ch.photos.length > 6 && <div style={{ width: '80px', height: '60px', background: 'var(--input-background)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>+{ch.photos.length - 6}</div>}
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>Aucune photo pour ce chantier.</div>
                  )}
                </div>

                {/* Commentaires */}
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '12px' }}>Commentaires</div>
                  {ch.commentaires.map((c, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--background)', borderLeft: '3px solid var(--primary)', marginBottom: '8px' }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '4px' }}>{c.auteur} · {c.date}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)' }}>{c.texte}</div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Ajouter un commentaire de chantier..."
                      style={{ flex: 1, ...inputStyle }}
                      onKeyDown={e => e.key === 'Enter' && addComment(ch.id)}
                    />
                    <button onClick={() => addComment(ch.id)} disabled={!commentText.trim()} style={{ ...btnPrimary, opacity: commentText.trim() ? 1 : 0.5 }}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Tranche comment modal */}
      {trancheComment && (
        <Modal open onClose={() => setTrancheComment(null)} sansCroix
          titre={`Commentaire de la tranche T${trancheComment.trNum}`} largeur={440}
          style={{ borderRadius: 0, padding: 24 }}>
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '12px' }}>Commentaire — Tranche T{trancheComment.trNum}</div>
            <textarea value={trancheCommentText} onChange={e => setTrancheCommentText(e.target.value)} rows={3} placeholder="Ex : Travaux de gros œuvre en bonne progression..." style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.55, marginBottom: '14px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setTrancheComment(null)} style={btnOutline}>Annuler</button>
              <button onClick={saveTrancheComment} style={btnPrimary}><CheckCircle2 size={13} /> Enregistrer</button>
            </div>
          </>
        </Modal>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--foreground)', color: 'var(--background)', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, zIndex: 300, maxWidth: '340px' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function btnSm(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', background: bg, color, border: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
}
const inputStyle: React.CSSProperties = { padding: '8px 10px', background: 'var(--input-background)', border: '1px solid var(--border)', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' };
const btnOutline: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
