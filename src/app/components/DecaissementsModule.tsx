import React, { useMemo, useState } from 'react';
import {
  Banknote, CheckCircle2, Clock, ChevronDown, ChevronUp, MessageSquare,
  Search, MapPin, Hammer, Landmark, Send, Circle, Loader2, AlertCircle,
} from 'lucide-react';
import { useClientContext } from '../contexts/ClientContext';
import { useDocState } from '../data/docStateContext';
import { resolveClientBank } from '../data/bankRegistry';
import { apiErrorMessage } from '../api/client';
// Aliasé : `toast` est déjà le nom de l'état du bandeau de confirmation local.
import { toast as notifier } from 'sonner';
import { formatAmount, formatFCFA, parseAmount } from '../lib/format';
import { ConfirmDialog, Modal } from './ui/overlays';
import {
  useDecaissementsQuery, useUpdateDecaissement, useValidateFoncierStep,
  useValidateTerrain, useValidateTranche, defaultDecaissement, toTranchesInput,
  FONCIER_STEPS, CONSTRUCTION_TRANCHES, type DecaissementState,
} from '../data/decaissementStore';


export default function DecaissementsModule() {
  const { allClients } = useClientContext();
  const { pushNotification } = useDocState();

  const clientIds = useMemo(() => allClients.map(c => c.id), [allClients]);
  const { states, loading, error, retry } = useDecaissementsQuery(clientIds, clientIds.length > 0);

  const updateMutation   = useUpdateDecaissement();
  const terrainMutation  = useValidateTerrain();
  const foncierMutation  = useValidateFoncierStep();
  const trancheMutation  = useValidateTranche();

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(allClients[0]?.id ?? null);
  const [commentFor, setCommentFor] = useState<{ id: string; tr: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };
  /**
   * Le message du serveur, tel quel, dans le canal unique de l'application.
   *
   * L'écran affichait ses échecs dans un bandeau qui lui était propre, en plus
   * du toast global de `main.tsx` : deux messages identiques pour un seul refus.
   * Le repli n'est utilisé que si le serveur n'a rien dit — un 409 de séquence
   * (« la tranche 2 ne peut pas être validée avant la tranche 1 », « ce
   * décaissement dépasse le montant accordé ») arrive avec son propre texte,
   * écrit pour l'agent, et c'est celui-là qu'il faut lire.
   */
  const failWith = (fallback: string) => (e: unknown) => notifier.error(apiErrorMessage(e, fallback));

  // Saisie de montant : optimiste à l'écran, persistée au blur (PUT).
  const [draftAmounts, setDraftAmounts] = useState<Record<string, { terrain?: number; construction?: number }>>({});

  const st = (id: string): DecaissementState => states[id] ?? defaultDecaissement();
  const terrainOf = (id: string) => draftAmounts[id]?.terrain ?? st(id).terrainMontant;
  const constructionOf = (id: string) => draftAmounts[id]?.construction ?? st(id).constructionMontant;
  const bankFor = (id: string) => { const b = resolveClientBank(id); return b !== '—' ? b : ''; };

  /**
   * Notifications et messages de confirmation ne partent qu'une fois le serveur
   * d'accord : une action refusée ne doit jamais être annoncée comme réussie.
   * (Le journal d'activité, lui, est écrit côté serveur par le contrôleur.)
   */
  const journaliseSiOk = (onOk: () => void, fallback: string) => ({
    onSuccess: onOk,
    onError: failWith(fallback),
  });

  // ── Actions ──────────────────────────────────────────────────────────────────
  const setTerrain = (id: string, n: number) =>
    setDraftAmounts(prev => ({ ...prev, [id]: { ...prev[id], terrain: n } }));
  const setConstruction = (id: string, n: number) =>
    setDraftAmounts(prev => ({ ...prev, [id]: { ...prev[id], construction: n } }));

  const commitTerrain = (id: string) => {
    const montant = terrainOf(id);
    if (montant === st(id).terrainMontant) return;
    updateMutation.mutate({ clientId: id, input: { terrain_montant: montant } }, {
      onError: failWith('Impossible d\'enregistrer le prix du terrain.'),
    });
  };

  const commitConstruction = (id: string) => {
    const montant = constructionOf(id);
    if (montant === st(id).constructionMontant) return;
    updateMutation.mutate({ clientId: id, input: { construction_montant: montant } }, {
      onError: failWith('Impossible d\'enregistrer le coût de construction.'),
    });
  };

  const decaisserTerrain = (id: string, name: string) => {
    const montant = terrainOf(id);
    // Le montant saisi doit être enregistré avant le décaissement.
    updateMutation.mutate({ clientId: id, input: { terrain_montant: montant } }, {
      onError: failWith('Impossible d\'enregistrer le prix du terrain.'),
      onSuccess: () => {
        terrainMutation.mutate(id, journaliseSiOk(() => {
          pushNotification(id, `Décaissement du prix du terrain effectué (${formatFCFA(montant)}).`, 'Notification', 'CPI');
          showToast(`Prix du terrain décaissé pour ${name} · client notifié.`);
        }, 'Le décaissement du terrain a échoué.'));
      },
    });
  };

  const validateFoncier = (id: string, idx: number, name: string) => {
    foncierMutation.mutate({ clientId: id, step: idx }, {
      onError: failWith("La validation de l'étape foncière a échoué."),
    });
  };

  const activateConstruction = (id: string, name: string) => {
    const montant = constructionOf(id);
    updateMutation.mutate(
      { clientId: id, input: { construction_active: true, construction_montant: montant } },
      journaliseSiOk(() => {
        showToast(`Construction lancée pour ${name}.`);
      }, 'Le lancement de la construction a échoué.'),
    );
  };

  /**
   * Décaissement d'une tranche — confirmation obligatoire.
   *
   * Un simple clic déclenchait un virement : la somme part vers le compte du
   * client, le client est notifié, et rien dans l'interface ne permet de
   * revenir en arrière. C'est la seule action de l'application qui engage
   * directement de l'argent réel ; elle ne peut pas dépendre d'un clic distrait.
   */
  const [aDecaisser, setADecaisser] = useState<{ id: string; tr: number; name: string; montant: number } | null>(null);

  const demanderDecaissement = (id: string, tr: number, name: string) => {
    const montant = Math.round(st(id).constructionMontant * CONSTRUCTION_TRANCHES[tr].pct / 100);
    setADecaisser({ id, tr, name, montant });
  };

  const validateTranche = (id: string, tr: number, name: string, montant: number) => {
    trancheMutation.mutate({ clientId: id, num: tr }, journaliseSiOk(() => {
      pushNotification(id, `Tranche ${tr + 1} décaissée (${CONSTRUCTION_TRANCHES[tr].label}) — ${formatFCFA(montant)}.`, 'Notification', 'CPI');
      showToast(`Tranche ${tr + 1} décaissée pour ${name} · client notifié.`);
      setADecaisser(null);
    }, 'Le décaissement de la tranche a échoué.'));
  };

  const saveComment = () => {
    if (!commentFor) return;
    const { id, tr } = commentFor;
    const tranches = st(id).tranches.map((t, i) => i === tr ? { ...t, comment: commentText.trim() } : t);
    updateMutation.mutate({ clientId: id, input: { tranches: toTranchesInput(tranches) } }, {
      onSuccess: () => { setCommentFor(null); setCommentText(''); showToast('Commentaire enregistré.'); },
      onError: failWith("L'enregistrement du commentaire a échoué."),
    });
  };

  // ── KPI ──────────────────────────────────────────────────────────────────────
  const rows = allClients.map(c => ({ c, s: st(c.id) }));
  const nbDossiers = rows.length;
  const parcellesDecaissees = rows.filter(r => r.s.terrainDecaisse).length;
  const enConstruction = rows.filter(r => r.s.constructionActive).length;
  const totalDecaisse = rows.reduce((n, r) => {
    let m = r.s.terrainDecaisse ? r.s.terrainMontant : 0;
    if (r.s.constructionActive) r.s.tranches.forEach((t, i) => { if (t.validated) m += Math.round(r.s.constructionMontant * CONSTRUCTION_TRANCHES[i].pct / 100); });
    return n + m;
  }, 0);

  const q = query.trim().toLowerCase();
  const list = rows.filter(r => !q || r.c.name.toLowerCase().includes(q) || r.c.ref.toLowerCase().includes(q));

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' };
  const amountInput = (value: number, onChange: (n: number) => void, onCommit?: () => void, disabled?: boolean) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '6px 10px', background: disabled ? 'var(--muted)' : 'var(--input-background)' }}>
      <input value={value ? formatAmount(value) : ''} disabled={disabled} onChange={e => onChange(parseAmount(e.target.value))} onBlur={() => onCommit?.()} placeholder="0"
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)', width: 120, textAlign: 'right' }} />
      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>FCFA</span>
    </div>
  );

  // Chargement : aucun écran blanc, aucune donnée à moitié vraie.
  if (loading) {
    return (
      <div style={{ ...card, padding: '48px 20px', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <Loader2 size={26} style={{ color: 'var(--primary)', margin: '0 auto 10px', display: 'block', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Chargement des décaissements…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...card, padding: '40px 20px', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <AlertCircle size={26} style={{ color: 'var(--destructive)', margin: '0 auto 10px', display: 'block' }} />
        <div style={{ fontSize: '0.875rem', color: 'var(--foreground)', marginBottom: 14 }}>
          {apiErrorMessage(error, 'Impossible de charger les décaissements.')}
        </div>
        <button onClick={retry} style={{ padding: '9px 18px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Décaissements bancaires</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0 }}>Acquisition foncière (décaissement unique) puis construction par tranches. Les informations sont visibles par le client.</p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {[
          { l: 'Dossiers suivis', v: String(nbDossiers), c: 'var(--primary)' },
          { l: 'Parcelles financées', v: String(parcellesDecaissees), c: 'var(--success)' },
          { l: 'En construction', v: String(enConstruction), c: 'var(--accent-text)' },
          { l: 'Total décaissé', v: formatFCFA(totalDecaisse), c: 'var(--foreground)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: s.l === 'Total décaissé' ? '1.0625rem' : '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--card)' }}>
        <Search size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un dossier (nom, n°)…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: 'var(--foreground)' }} />
      </div>

      {/* Liste */}
      {list.length === 0 ? (
        <div style={{ ...card, padding: '40px 20px', textAlign: 'center' }}>
          <Banknote size={26} style={{ color: 'var(--border)', margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{nbDossiers === 0 ? 'Aucun dossier pour le moment.' : 'Aucun dossier ne correspond.'}</div>
        </div>
      ) : list.map(({ c, s }) => {
        const isOpen = expanded === c.id;
        const bank = bankFor(c.id);
        const tranchesDone = s.tranches.filter(t => t.validated).length;
        return (
          <div key={c.id} style={card}>
            <button onClick={() => setExpanded(isOpen ? null : c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}>
              <Banknote size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{c.ref} · {c.projectNom} · {bank || 'Banque à assigner'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--r-full)', color: s.terrainDecaisse ? 'var(--success)' : '#C8921A', background: s.terrainDecaisse ? 'rgba(26,107,68,0.1)' : 'rgba(200,146,26,0.1)' }}>
                  {s.terrainDecaisse ? 'Terrain financé' : 'Terrain à financer'}
                </span>
                {s.constructionActive && <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--r-full)', color: 'var(--primary)', background: 'var(--secondary)' }}>Construction {tranchesDone}/4</span>}
                {isOpen ? <ChevronUp size={15} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={15} style={{ color: 'var(--muted-foreground)' }} />}
              </div>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: 18, display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--background)' }}>

                {/* ── Phase 1 — Acquisition foncière ── */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <MapPin size={16} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--foreground)' }}>Phase 1 · Acquisition foncière</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>— décaissement unique (crédit conso)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Prix du terrain</span>
                      {amountInput(terrainOf(c.id), n => setTerrain(c.id, n), () => commitTerrain(c.id), s.terrainDecaisse)}
                      {bank && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}><Landmark size={12} /> {bank}</span>}
                    </div>
                    {s.terrainDecaisse ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--success)' }}><CheckCircle2 size={15} /> Décaissé le {s.terrainDate}</span>
                    ) : (
                      <button onClick={() => decaisserTerrain(c.id, c.name)} disabled={terrainOf(c.id) <= 0 || terrainMutation.isPending}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--r-sm)', border: 'none', background: terrainOf(c.id) > 0 ? 'var(--success)' : 'var(--muted)', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: terrainOf(c.id) > 0 ? 'pointer' : 'not-allowed' }}>
                        <Send size={13} /> Décaisser le prix du terrain
                      </button>
                    )}
                  </div>

                  {/* Parcours foncier 5 étapes */}
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Parcours foncier</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {FONCIER_STEPS.map((step, i) => {
                      const done = s.foncier[i];
                      const isNext = !done && s.foncier.slice(0, i).every(Boolean);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: done ? 'rgba(26,107,68,0.06)' : 'var(--background)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                          {done ? <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} /> : <Circle size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: done ? 600 : 500, color: done ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{i + 1}. {step}</span>
                          {isNext && <button onClick={() => validateFoncier(c.id, i, c.name)} disabled={foncierMutation.isPending} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}>Valider</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Phase 2 — Construction ── */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <Hammer size={16} style={{ color: 'var(--accent-text)' }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--foreground)' }}>Phase 2 · Construction de la villa</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>— décaissement par tranches</span>
                  </div>

                  {!s.constructionActive ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Coût de construction</span>
                      {amountInput(constructionOf(c.id), n => setConstruction(c.id, n), () => commitConstruction(c.id))}
                      <button onClick={() => activateConstruction(c.id, c.name)} disabled={constructionOf(c.id) <= 0 || !s.terrainDecaisse || updateMutation.isPending}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--r-sm)', border: 'none', background: constructionOf(c.id) > 0 && s.terrainDecaisse ? '#C8921A' : 'var(--muted)', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: constructionOf(c.id) > 0 && s.terrainDecaisse ? 'pointer' : 'not-allowed' }}>
                        <Hammer size={13} /> Lancer la construction
                      </button>
                      {!s.terrainDecaisse && <span style={{ fontSize: '0.6875rem', color: 'var(--accent-text)', fontStyle: 'italic' }}>Le terrain doit d'abord être financé.</span>}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Coût total</span>
                        {amountInput(constructionOf(c.id), n => setConstruction(c.id, n), () => commitConstruction(c.id))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {CONSTRUCTION_TRANCHES.map((tr, i) => {
                          const t = s.tranches[i] ?? { validated: false };
                          const montant = Math.round(s.constructionMontant * tr.pct / 100);
                          const prevDone = i === 0 ? true : Boolean(s.tranches[i - 1]?.validated);
                          return (
                            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', flexWrap: 'wrap' }}>
                              <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.8125rem', color: t.validated ? 'var(--success)' : 'var(--primary)', background: t.validated ? 'rgba(26,107,68,0.1)' : 'var(--secondary)' }}>T{i + 1}</div>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>Tranche {i + 1} — {tr.label}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{tr.pct}% · <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{formatFCFA(montant)}</span></div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{tr.detail}</div>
                                {t.comment && <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic', marginTop: 3 }}>"{t.comment}"</div>}
                                {t.validated && t.date && <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, marginTop: 3 }}>Décaissé le {t.date}</div>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {t.validated ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(26,107,68,0.1)', padding: '3px 9px', borderRadius: 'var(--r-full)' }}><CheckCircle2 size={11} /> Décaissé</span>
                                ) : prevDone ? (
                                  <button onClick={() => demanderDecaissement(c.id, i, c.name)} disabled={trancheMutation.isPending} style={btnSm('var(--success)', 'rgba(26,107,68,0.10)')}><Send size={11} /> Décaisser</button>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-text)', background: 'rgba(200,146,26,0.1)', padding: '3px 9px', borderRadius: 'var(--r-full)' }}><Clock size={11} /> En attente</span>
                                )}
                                <button onClick={() => { setCommentFor({ id: c.id, tr: i }); setCommentText(t.comment || ''); }} style={btnSm('var(--primary)', 'var(--secondary)')}><MessageSquare size={11} /> Commenter</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={aDecaisser !== null}
        onOpenChange={ouvert => { if (!ouvert) setADecaisser(null); }}
        titre={aDecaisser ? `Décaisser la tranche ${aDecaisser.tr + 1} ?` : ''}
        description={aDecaisser ? (
          <>
            <strong style={{ color: 'var(--foreground)' }}>{formatFCFA(aDecaisser.montant)}</strong> vont être décaissés
            pour <strong style={{ color: 'var(--foreground)' }}>{aDecaisser.name}</strong>
            {' '}({CONSTRUCTION_TRANCHES[aDecaisser.tr].label}).
            Le client sera notifié. Cette opération ne peut pas être annulée depuis l'application.
          </>
        ) : ''}
        libelleConfirmer="Décaisser"
        ton="engageant"
        enCours={trancheMutation.isPending}
        onConfirmer={() => { if (aDecaisser) validateTranche(aDecaisser.id, aDecaisser.tr, aDecaisser.name, aDecaisser.montant); }}
      />

      {/* Comment modal */}
      {commentFor && (
        <Modal open onClose={() => setCommentFor(null)} sansCroix
          titre={`Commenter la tranche T${commentFor.tr + 1}`} largeur={440} style={{ padding: 24 }}>
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>Commenter la tranche T{commentFor.tr + 1}</div>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={3} placeholder="Ex : Décaissement effectué après inspection du chantier." style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--input-background)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', outline: 'none', fontSize: '0.875rem', color: 'var(--foreground)', resize: 'vertical', lineHeight: 1.55, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setCommentFor(null)} style={btnOutline}>Annuler</button>
              <button onClick={saveComment} disabled={updateMutation.isPending} style={btnPrimary}>
                <CheckCircle2 size={13} /> {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </>
        </Modal>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--foreground)', color: 'var(--background)', padding: '12px 18px', borderRadius: 'var(--r-sm)', fontSize: '0.875rem', fontWeight: 600, zIndex: 300, maxWidth: 360 }}>{toast}</div>
      )}
    </div>
  );
}

function btnSm(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: bg, color, border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
}
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--r-sm)', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' };
const btnOutline: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--r-sm)', background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
