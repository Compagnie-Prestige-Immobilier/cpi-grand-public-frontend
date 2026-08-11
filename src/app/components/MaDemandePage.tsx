import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Calendar, Clock, CheckCircle2, AlertCircle, XCircle,
  Building2, Edit3, Save, X, MessageSquare,
  Printer, Send, MapPin, Banknote, Timer, User2,
  Hash, LayoutGrid, ArrowRight, FolderOpen, Bell, ImageIcon, FileUp, Loader2,
  Eye, Download, Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '../App';
import type { ActivityType } from '../data/activityLog';
import { frDate } from '../data/demoStore';
import { useClientData } from '../data/useClientData';
import { useDocState, type SharedDoc } from '../data/docStateContext';
import { useNavigate } from '../contexts/NavigationContext';
import { clientApi, type DemandeData, type DemandeInput } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { usePermission } from '../auth/PermissionContext';
import { JOURNEY_QUERY_KEY } from '../data/dossierJourney';
import { MY_PROFILE_QUERY_KEY } from '../data/clientRegistry';

interface Props { user: AuthUser }

// ── Types ──────────────────────────────────────────────────────────
type DemandStatut = 'validee' | 'en-cours' | 'incomplete' | 'brouillon';

interface DemandeForm {
  typeProjet: string;
  natureProjet: string;
  montant: string;
  duree: string;
  apport: string;
  region: string;
  commune: string;
  adresseProjet: string;
  description: string;
}


// ── Doc status config (statuts réels, gérés par l'Agent CPI dans "Mon dossier") ──
//
// Les CLÉS sont les statuts du serveur et ne changent pas — seuls les libellés
// affichés évoluent. Renommer une clé casserait la lecture des réponses API.
const DOC_STATUS_CFG: Record<SharedDoc['status'], { label: string; color: string; bg: string }> = {
  'en-attente':  { label: 'À envoyer',              color: 'var(--muted-foreground)', bg: 'var(--muted)'           },
  depose:        { label: 'En attente de validation', color: 'var(--chart-4)',        bg: 'rgba(176,80,112,0.08)' },
  verification:  { label: 'En vérification',        color: 'var(--accent)',           bg: 'rgba(200,146,26,0.09)' },
  accepte:       { label: 'Validé',                 color: 'var(--success)',          bg: 'rgba(26,107,68,0.1)'   },
  refuse:        { label: 'Refusé',                 color: 'var(--destructive)',       bg: 'rgba(192,57,43,0.08)' },
  'a-remplacer': { label: 'À remplacer',             color: 'var(--destructive)',       bg: 'rgba(192,57,43,0.08)' },
};

const DOC_DESCRIPTIONS: Record<string, string> = {
  identite:  'CNI ou passeport en cours de validité',
  revenus:   'Les 3 derniers bulletins de salaire ou justificatifs de revenus',
  bancaires: 'Les 3 derniers mois de relevés de compte courant',
};

// ── History icon/tone (mêmes conventions que le Tableau de bord) ────
// Le journal serveur porte deux familles de plus que l'ancien journal local
// (« compte » et « banque ») : la table doit les couvrir, sans quoi ces entrées
// s'afficheraient sans icône.
const HISTO_ICON: Record<ActivityType, LucideIcon> = {
  validation: CheckCircle2, document: FileText, notification: Bell, photo: ImageIcon,
  decaissement: Banknote, commentaire: MessageSquare, depot: FileUp, refus: AlertCircle,
  compte: User2, banque: Building2,
};
const HISTO_COLOR: Record<ActivityType, string> = {
  validation: 'var(--success)', document: 'var(--primary)', notification: 'var(--accent)',
  photo: 'var(--primary)', decaissement: 'var(--success)', commentaire: 'var(--muted-foreground)',
  depot: 'var(--primary)', refus: 'var(--destructive)',
  compte: 'var(--primary)', banque: 'var(--accent)',
};

// ── Constants ──────────────────────────────────────────────────────
const STATUT_CONFIG: Record<DemandStatut, { label: string; color: string; bg: string; dot: string }> = {
  validee:    { label: 'Validée',                color: 'var(--success)',          bg: 'rgba(26,107,68,0.1)',   dot: 'var(--success)'          },
  'en-cours': { label: "En cours d'étude",       color: 'var(--accent)',           bg: 'rgba(200,146,26,0.1)', dot: 'var(--accent)'           },
  incomplete: { label: 'Document à corriger',    color: 'var(--destructive)',      bg: 'rgba(192,57,43,0.09)', dot: 'var(--destructive)'      },
  brouillon:  { label: 'Brouillon',              color: 'var(--muted-foreground)', bg: 'var(--muted)',         dot: 'var(--muted-foreground)' },
};

const NATURE_LABELS: Record<string, string> = {
  construction:  'Construction neuve',
  acquisition:   'Acquisition immobilière',
  renovation:    'Rénovation / Extension',
  viabilisation: 'Viabilisation de terrain',
};

// ── Design tokens ──────────────────────────────────────────────────
const CARD_RADIUS = 20;
const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.04)';
const CARD_BORDER = '1px solid rgba(99,2,16,0.08)';
const SECTION_PAD = '26px 28px';
const BODY_PAD    = '0 28px 28px';

// ── Demande persistée côté API (/client/ma-demande) ────────────────
const MA_DEMANDE_QUERY_KEY = ['client', 'ma-demande'] as const;

/** Brouillon vide : aucune valeur pré-remplie fictive. */
function emptyForm(): DemandeForm {
  return {
    typeProjet: 'financement', natureProjet: 'acquisition',
    montant: '', duree: '15', apport: '',
    region: 'Dakar', commune: '', adresseProjet: '', description: '',
  };
}

/** DemandeData (API) → champs du formulaire. */
function toForm(d: DemandeData): DemandeForm {
  return {
    typeProjet: d.typeProjet,
    natureProjet: d.natureProjet,
    montant: d.montant !== null ? String(d.montant) : '',
    duree: d.duree,
    apport: String(d.apport ?? 0),
    region: d.region,
    commune: d.commune ?? '',
    adresseProjet: d.adresseProjet ?? '',
    description: d.description ?? '',
  };
}

/** « 25 000 000 » → 25000000. Renvoie null si la saisie n'est pas un nombre. */
function parseMontant(value: string): number | null {
  const cleaned = value.replace(/[\s ]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Champs du formulaire → corps attendu par l'API (snake_case). */
function toPayload(form: DemandeForm): DemandeInput {
  return {
    type_projet: form.typeProjet,
    nature_projet: form.natureProjet,
    montant: parseMontant(form.montant),
    duree: form.duree,
    apport: parseMontant(form.apport) ?? 0,
    region: form.region,
    commune: form.commune.trim() || null,
    adresse_projet: form.adresseProjet.trim() || null,
    description: form.description.trim() || null,
  };
}

// ── Contraintes de dépôt (miroir de la validation serveur) ─────────
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

// ── Primitives ─────────────────────────────────────────────────────

function SectionCard({ title, icon, iconBg, children, accent }: {
  title: string; icon: React.ReactNode; iconBg?: string;
  children: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{ background: 'var(--card)', border: CARD_BORDER, borderRadius: CARD_RADIUS, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: SECTION_PAD, borderBottom: '1px solid rgba(99,2,16,0.06)' }}>
        <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', flexShrink: 0, background: iconBg ?? 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ?? 'var(--primary)' }}>
          {icon}
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
          {title}
        </h3>
      </div>
      <div style={{ padding: BODY_PAD }}>{children}</div>
    </div>
  );
}

function FieldGroup({ label, required, hint, error, valid, children }: {
  label: string; required?: boolean; hint?: string; error?: string; valid?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}{required && <span style={{ color: 'var(--destructive)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {(error || hint) && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', lineHeight: 1.4, color: error ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
          {error ? <AlertCircle size={11} style={{ flexShrink: 0 }} /> : valid ? <CheckCircle2 size={11} style={{ flexShrink: 0, color: 'var(--success)' }} /> : null}
          {error || hint}
        </span>
      )}
    </div>
  );
}

const INPUT_BASE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: '0.9375rem',
  border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)',
  padding: '11px 14px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
  transition: 'border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out)',
};

function FInput({ value, onChange, placeholder, type = 'text', disabled, error, valid, icon }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
  error?: boolean; valid?: boolean; icon?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);
  const borderColor = disabled ? 'var(--border)'
    : error ? 'var(--destructive)'
    : focused ? 'var(--primary)'
    : valid ? 'var(--success)'
    : hover ? 'var(--muted-foreground)' : 'var(--border)';
  const boxShadow = !focused ? 'none' : error ? '0 0 0 3px rgba(192,57,43,0.14)' : 'var(--ring-focus)';
  const showCheck = valid && !error && !disabled;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {icon && (
        <span style={{ position: 'absolute', left: 13, display: 'flex', pointerEvents: 'none', color: focused ? 'var(--primary)' : 'var(--muted-foreground)', transition: 'color var(--dur-1) var(--ease-out)' }}>{icon}</span>
      )}
      <input
        type={type} value={value} placeholder={placeholder} disabled={disabled}
        aria-invalid={error || undefined}
        onChange={e => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ ...INPUT_BASE, borderColor, boxShadow, paddingLeft: icon ? 38 : 14, paddingRight: showCheck ? 38 : 14, background: disabled ? 'var(--muted)' : '#ffffff', color: disabled ? 'var(--muted-foreground)' : 'var(--foreground)' }}
      />
      {showCheck && <CheckCircle2 size={15} style={{ position: 'absolute', right: 12, color: 'var(--success)', pointerEvents: 'none' }} />}
    </div>
  );
}

function FSelect({ value, onChange, options, disabled }: {
  value: string; onChange?: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);
  const borderColor = disabled ? 'var(--border)' : focused ? 'var(--primary)' : hover ? 'var(--muted-foreground)' : 'var(--border)';
  return (
    <select
      value={value} disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...INPUT_BASE, borderColor, boxShadow: focused ? 'var(--ring-focus)' : 'none', background: disabled ? 'var(--muted)' : '#ffffff', color: disabled ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: disabled ? 'default' : 'pointer', appearance: 'auto' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Toast ──────────────────────────────────────────────────────────
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; text: string }

function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map(t => {
        const colors = t.type === 'success'
          ? { bg: 'rgba(26,107,68,0.96)', icon: <CheckCircle2 size={15} /> }
          : t.type === 'error'
          ? { bg: 'rgba(192,57,43,0.96)', icon: <XCircle size={15} /> }
          : { bg: 'rgba(99,2,16,0.96)', icon: <AlertCircle size={15} /> };
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 'var(--r-md)',
            background: colors.bg, color: '#fff',
            fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            animation: 'slideInToast 0.2s ease',
          }}>
            {colors.icon}
            {t.text}
          </div>
        );
      })}
    </div>
  );
}

// ── Zone de dépôt inline (une pièce) ───────────────────────────────
function InlineDepot({ label, onDeposit }: { label: string; onDeposit: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Contrôle local aligné sur la validation serveur (10 Mo, pdf/jpg/png/webp).
  const pick = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED_EXT.includes(ext)) {
      setRefus('Format non accepté — utilisez un PDF, JPG, PNG ou WEBP.');
      setFile(null);
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setRefus('Fichier trop volumineux — 10 Mo maximum.');
      setFile(null);
      return;
    }
    setRefus(null);
    setFile(f);
  };

  const reset = () => { setFile(null); setRefus(null); };

  if (!file) {
    return (
      <div>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
          onClick={() => inputRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: '18px 16px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--secondary)' : 'var(--muted)', transition: 'all var(--dur-1) var(--ease-out)' }}
        >
          <FileUp size={22} style={{ color: 'var(--primary)', margin: '0 auto 6px', display: 'block' }} />
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>Glissez votre fichier ici, ou cliquez pour parcourir</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>PDF, JPG, PNG ou WEBP · 10 Mo maximum</div>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }} />
        </div>
        {refus && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--destructive)' }}>
            <AlertCircle size={12} style={{ flexShrink: 0 }} /> {refus}
          </div>
        )}
      </div>
    );
  }

  const sizeLabel = file.size >= 1048576
    ? `${(file.size / 1048576).toFixed(1).replace('.', ',')} Mo`
    : `${Math.round(file.size / 1024)} Ko`;

  return (
    <div style={{ background: 'var(--muted)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
        <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{sizeLabel} · prêt à être envoyé</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reset} style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => onDeposit(file)} style={{ padding: '7px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Valider le dépôt</button>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 8 }}>Pièce : {label}</div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function MaDemandePage({ user: _user }: Props) {
  const client = useClientData();
  const { requisDocs, history, depositDoc, loading: docsLoading, error: docsError, retry: retryDocs } = useDocState();
  const { navigate } = useNavigate();
  const { role } = usePermission();
  const queryClient = useQueryClient();

  const demandeQuery = useQuery({
    queryKey: MA_DEMANDE_QUERY_KEY,
    queryFn: () => clientApi.maDemande(),
    enabled: role === 'client',
  });
  const remote = demandeQuery.data ?? null;
  const submitted   = remote?.submitted ?? false;
  const submittedAt = frDate(remote?.submittedAt);

  const [form, setForm] = useState<DemandeForm | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [depotDocId, setDepotDocId] = useState<string | null>(null);
  // Pièce mise en évidence après un clic sur « Compléter les informations » :
  // on la fait défiler à l'écran, on ouvre sa zone de dépôt et on l'encadre.
  const [surligneDocId, setSurligneDocId] = useState<string | null>(null);
  const docSurligneRef = useRef<HTMLDivElement | null>(null);
  const [attempted, setAttempted] = useState(false);
  const lastClientId = useRef(client.id);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((type: ToastItem['type'], text: string) => {
    const id = Date.now();
    setToasts(p => [...p, { id, type, text }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  // Première hydratation du formulaire depuis l'API (et à chaque changement de
  // dossier sélectionné : on repart de la demande réellement enregistrée).
  useEffect(() => {
    if (lastClientId.current !== client.id) {
      lastClientId.current = client.id;
      setForm(null);
      return;
    }
    if (!demandeQuery.isSuccess || form !== null) return;
    setForm(remote ? toForm(remote) : emptyForm());
    setIsEditing(!(remote?.submitted ?? false));
  }, [client.id, demandeQuery.isSuccess, remote, form]);

  // Amène la pièce mise en évidence à l'écran, une fois sa carte rendue.
  //
  // Déclaré ICI, avec les autres hooks : ce composant fait des retours anticipés
  // (erreur, chargement) plus bas. Un hook placé après ceux-ci ne s'exécute pas
  // à tous les rendus — React lève alors « Rendered more hooks than during the
  // previous render » et la page entière tombe en écran blanc.
  useEffect(() => {
    if (!surligneDocId) return;
    docSurligneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // L'encadré s'estompe seul : il signale, il ne s'installe pas.
    const t = setTimeout(() => setSurligneDocId(null), 4000);
    return () => clearTimeout(t);
  }, [surligneDocId]);

  // ── Écriture ──────────────────────────────────────────────────────
  const refreshDossier = () => {
    void queryClient.invalidateQueries({ queryKey: MA_DEMANDE_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: JOURNEY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: DemandeInput) => clientApi.saveMaDemande(payload),
    onSuccess: () => {
      refreshDossier();
      setIsEditing(false);
      addToast('success', 'Modifications enregistrées');
    },
    onError: e => addToast('error', apiErrorMessage(e, "L'enregistrement de votre demande a échoué.")),
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: DemandeInput) => {
      await clientApi.saveMaDemande(payload);
      return clientApi.submitMaDemande();
    },
    onSuccess: () => {
      refreshDossier();
      setIsEditing(false);
      addToast('success', 'Demande envoyée — votre conseiller CPI va l\'étudier.');
    },
    onError: e => addToast('error', apiErrorMessage(e, "L'envoi de votre demande a échoué.")),
  });

  // Le succès est le téléchargement lui-même : pas de toast « réussi » qui
  // s'afficherait même si rien n'était arrivé — c'était le défaut de l'ancienne
  // version, qui annonçait la réussite sans jamais produire de fichier.
  const recapMutation = useMutation({
    mutationFn: () => clientApi.telechargerRecapitulatif(),
    onError: e => addToast('error', apiErrorMessage(e, 'Le récapitulatif n\'a pas pu être généré.')),
  });

  const sending = submitMutation.isPending || saveMutation.isPending;

  // ── Erreur / chargement ───────────────────────────────────────────
  if (demandeQuery.isError) {
    return (
      <div role="alert" style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <AlertCircle size={22} style={{ color: 'var(--destructive)' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)' }}>Demande indisponible</div>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0, maxWidth: 420, lineHeight: 1.6 }}>
          {apiErrorMessage(demandeQuery.error, 'Impossible de charger votre demande de financement.')}
        </p>
        <button onClick={() => { void demandeQuery.refetch(); }} style={{ padding: '10px 22px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    );
  }

  if (demandeQuery.isPending || form === null) {
    return (
      <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', fontFamily: 'var(--font-sans)' }}>
        <div className="cpi-skeleton" style={{ width: 240, height: 16, borderRadius: 'var(--r-full)' }} />
        <div className="cpi-skeleton" style={{ width: 180, height: 16, borderRadius: 'var(--r-full)' }} />
        <span role="status" aria-live="polite" style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Chargement de votre demande…</span>
      </div>
    );
  }

  const set = (k: keyof DemandeForm) => (v: string) => setForm(f => (f ? { ...f, [k]: v } : f));

  const canSubmit = form.montant.trim() !== '' && form.commune.trim() !== '' && form.adresseProjet.trim() !== '';

  const handleSubmitDemande = () => {
    if (!canSubmit) {
      setAttempted(true);
      addToast('error', 'Complétez les champs requis avant d\'envoyer.');
      return;
    }
    if (sending) return;
    submitMutation.mutate(toPayload(form));
  };

  const handleDepot = (docId: string, file: File) => {
    depositDoc(docId, file);
    setDepotDocId(null);
    // La pièce repasse « en attente de validation » : plus rien à mettre en
    // évidence, l'encadré rouge et l'alerte disparaissent d'eux-mêmes.
    setSurligneDocId(null);
    addToast('success', 'Document envoyé — votre conseiller CPI va le valider.');
  };

  const validDocs   = requisDocs.filter(d => d.status === 'accepte').length;
  const totalDocs   = requisDocs.length;
  const docsAAgir   = requisDocs.filter(d => d.status === 'refuse' || d.status === 'a-remplacer' || d.status === 'en-attente');
  const hasDocIssue = requisDocs.some(d => d.status === 'refuse' || d.status === 'a-remplacer');
  const dossierComplet = totalDocs > 0 && validDocs === totalDocs;

  // « Compléter les informations » — amène directement à la pièce qui bloque :
  // priorité au refus, puis au remplacement, puis à ce qui n'a pas été envoyé.
  const allerAuDocABloquer = () => {
    const cible = requisDocs.find(d => d.status === 'refuse')
      ?? requisDocs.find(d => d.status === 'a-remplacer')
      ?? requisDocs.find(d => d.status === 'en-attente');
    if (!cible) return;
    setSurligneDocId(cible.id);
    setDepotDocId(cible.id);   // ouvre la zone de dépôt de cette pièce
  };


  const statut: DemandStatut = !submitted
    ? 'brouillon'
    : hasDocIssue
    ? 'incomplete'
    : (totalDocs > 0 && validDocs === totalDocs)
    ? 'validee'
    : 'en-cours';
  const sc = STATUT_CONFIG[statut];

  const progressPct = !submitted
    ? 10
    : Math.round(20 + (totalDocs > 0 ? (validDocs / totalDocs) * 80 : 0));

  const DEMO_REF  = client.ref;
  const DEMO_DATE = submittedAt ?? client.dateOuverture;

  const recentHistory = history.slice(0, 6);

  const GRID2: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px 22px',
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--foreground)', width: '100%', padding: '0 0 64px' }}>

      <style>{`@keyframes slideInToast { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <div style={{ padding: '28px 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
                Ma demande
              </h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 'var(--r-full)', background: sc.bg, color: sc.color, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                {sc.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                <Hash size={12} /> {submitted ? DEMO_REF : '—'}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                <Calendar size={12} /> {DEMO_DATE}
              </span>
            </div>
          </div>

          {submitted && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isEditing ? (
                <>
                  <button onClick={() => { setIsEditing(false); setForm(remote ? toForm(remote) : emptyForm()); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600 }}>
                    <X size={14} /> Annuler
                  </button>
                  <button onClick={() => saveMutation.mutate(toPayload(form))} disabled={sending} aria-busy={sending || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', cursor: sending ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(99,2,16,0.25)', opacity: sending ? 0.92 : 1 }}>
                    {sending ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} />} Enregistrer
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700 }}>
                  <Edit3 size={14} /> Modifier la demande
                </button>
              )}
            </div>
          )}
        </div>

        {!submitted && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'rgba(99,2,16,0.05)', border: '1px solid rgba(99,2,16,0.12)', borderRadius: 'var(--r-md)' }}>
            <AlertCircle size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
              Remplissez les informations de votre projet ci-dessous, puis envoyez votre demande pour qu'elle soit étudiée par votre conseiller.
            </span>
          </div>
        )}

        {/* Progress */}
        <div style={{ marginTop: 20, background: 'var(--card)', border: CARD_BORDER, borderRadius: 'var(--r-lg)', padding: '18px 22px', boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>
              Avancement global de la demande
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
              {progressPct}<span style={{ fontSize: '0.8em', fontWeight: 600 }}>%</span>
            </span>
          </div>
          <div style={{ height: 10, background: 'var(--muted)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--primary) 0%, var(--chart-4) 100%)', borderRadius: 'var(--r-full)', transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
          {submitted && totalDocs > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 11px', borderRadius: 'var(--r-full)', background: 'rgba(26,107,68,0.1)', color: 'var(--success)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600 }}>
                {validDocs}/{totalDocs} document{totalDocs > 1 ? 's' : ''} validé{validDocs > 1 ? 's' : ''}
              </span>
              {hasDocIssue && (
                <span style={{ padding: '3px 11px', borderRadius: 'var(--r-full)', background: 'rgba(192,57,43,0.1)', color: 'var(--destructive)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600 }}>
                  Action requise sur un document
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTIONS ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 1 — Projet immobilier */}
        <SectionCard title="Projet immobilier" icon={<Building2 size={18} />} iconBg="rgba(99,2,16,0.08)" accent="var(--primary)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 4 }}>
            <div style={GRID2}>
              <FieldGroup label="Type de demande">
                <FSelect value={form.typeProjet} onChange={set('typeProjet')} disabled={!isEditing}
                  options={[{ value: 'financement', label: 'Financement immobilier' }, { value: 'acquisition', label: "Aide à l'acquisition" }, { value: 'construction', label: 'Prêt à la construction' }, { value: 'renovation', label: 'Prêt à la rénovation' }]}
                />
              </FieldGroup>
              <FieldGroup label="Nature du projet">
                <FSelect value={form.natureProjet} onChange={set('natureProjet')} disabled={!isEditing}
                  options={[{ value: 'construction', label: 'Construction neuve' }, { value: 'acquisition', label: 'Acquisition immobilière' }, { value: 'renovation', label: 'Rénovation / Extension' }, { value: 'viabilisation', label: 'Viabilisation de terrain' }]}
                />
              </FieldGroup>
            </div>
            <div style={GRID2}>
              <FieldGroup label="Montant demandé (FCFA)" required
                hint={isEditing ? 'Montant du financement souhaité, en FCFA.' : undefined}
                error={attempted && !form.montant.trim() ? 'Ce champ est requis.' : undefined}
                valid={isEditing && !!form.montant.trim()}>
                <FInput value={form.montant} onChange={set('montant')} placeholder="Ex. 25 000 000" disabled={!isEditing}
                  icon={<Banknote size={15} />} error={attempted && !form.montant.trim()} valid={isEditing && !!form.montant.trim()} />
              </FieldGroup>
              <FieldGroup label="Durée souhaitée">
                <FSelect value={form.duree} onChange={set('duree')} disabled={!isEditing}
                  options={[5,7,10,12,15,20,25].map(n => ({ value: String(n), label: `${n} ans` }))}
                />
              </FieldGroup>
              <FieldGroup label="Apport personnel (FCFA)"
                hint={isEditing ? 'Laissez 0 si vous n\'avez pas d\'apport.' : undefined}>
                <FInput value={form.apport} onChange={set('apport')} placeholder="0 si aucun" disabled={!isEditing}
                  icon={<Banknote size={15} />} />
              </FieldGroup>
            </div>
            <div style={{ background: 'var(--secondary)', borderRadius: 'var(--r-md)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                <MapPin size={13} style={{ color: 'var(--muted-foreground)' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Localisation du projet</span>
              </div>
              <div style={GRID2}>
                <FieldGroup label="Région">
                  <FSelect value={form.region} onChange={set('region')} disabled={!isEditing}
                    options={['Dakar','Thiès','Saint-Louis','Kaolack','Ziguinchor','Diourbel','Fatick','Kaffrine','Kédougou','Kolda','Louga','Matam','Sédhiou','Tambacounda'].map(r => ({ value: r, label: r }))}
                  />
                </FieldGroup>
                <FieldGroup label="Commune / Ville" required
                  error={attempted && !form.commune.trim() ? 'Ce champ est requis.' : undefined}
                  valid={isEditing && !!form.commune.trim()}>
                  <FInput value={form.commune} onChange={set('commune')} placeholder="Votre commune" disabled={!isEditing}
                    icon={<MapPin size={15} />} error={attempted && !form.commune.trim()} valid={isEditing && !!form.commune.trim()} />
                </FieldGroup>
                <FieldGroup label="Adresse ou localisation" required
                  error={attempted && !form.adresseProjet.trim() ? 'Ce champ est requis.' : undefined}
                  valid={isEditing && !!form.adresseProjet.trim()}>
                  <FInput value={form.adresseProjet} onChange={set('adresseProjet')} placeholder="Ex. Lot 47…" disabled={!isEditing}
                    icon={<MapPin size={15} />} error={attempted && !form.adresseProjet.trim()} valid={isEditing && !!form.adresseProjet.trim()} />
                </FieldGroup>
              </div>
            </div>
            <FieldGroup label="Description du projet">
              <textarea value={form.description} disabled={!isEditing} onChange={e => set('description')(e.target.value)} rows={3}
                style={{ ...INPUT_BASE, background: !isEditing ? 'var(--muted)' : '#ffffff', color: !isEditing ? 'var(--muted-foreground)' : 'var(--foreground)', resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
              />
            </FieldGroup>
          </div>
        </SectionCard>

        {/* Bandeau d'envoi — bouton principal, après le formulaire */}
        {!submitted && (
          <div style={{ background: 'var(--card)', border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)' }}>Prêt à envoyer votre demande ?</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                {!canSubmit && <AlertCircle size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                  {canSubmit
                    ? 'Votre conseiller CPI étudiera votre projet dès réception.'
                    : 'Renseignez le montant, la commune et l\'adresse du projet pour pouvoir envoyer.'}
                </span>
              </div>
            </div>
            <button onClick={handleSubmitDemande} disabled={sending} aria-busy={sending || undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 28px', borderRadius: 'var(--r-full)', border: 'none', background: canSubmit ? 'var(--primary)' : 'var(--muted)', color: canSubmit ? 'var(--primary-foreground)' : 'var(--muted-foreground)', cursor: sending ? 'wait' : canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700, boxShadow: canSubmit && !sending ? 'var(--shadow-hover)' : 'none', opacity: sending ? 0.92 : 1, whiteSpace: 'nowrap', transition: 'background var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)' }}>
              {sending
                ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Envoi en cours…</>
                : <><Send size={16} /> Envoyer ma demande</>}
            </button>
          </div>
        )}

        {/* 2 — Documents requis — dépôt directement ici */}
        <SectionCard title="Documents requis" icon={<FolderOpen size={18} />} iconBg="rgba(200,146,26,0.1)" accent="var(--accent)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: '0 0 4px', lineHeight: 1.6 }}>
              Déposez ici les pièces nécessaires à l'étude de votre dossier. Votre conseiller CPI les vérifie une à une — vous suivez leur validation dans « Mon dossier ».
            </p>
            {docsLoading && (
              <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(i => <div key={i} className="cpi-skeleton" style={{ height: 62, borderRadius: 'var(--r-md)' }} />)}
              </div>
            )}
            {!docsLoading && docsError && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.18)', borderRadius: 'var(--r-md)', flexWrap: 'wrap' }}>
                <AlertCircle size={14} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 180, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{docsError}</span>
                <button onClick={retryDocs} style={{ padding: '6px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--destructive)', background: 'transparent', color: 'var(--destructive)', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Réessayer</button>
              </div>
            )}
            {!docsLoading && !docsError && requisDocs.map(doc => {
              const cfg = DOC_STATUS_CFG[doc.status];
              const needsDepot = doc.status === 'en-attente' || doc.status === 'refuse' || doc.status === 'a-remplacer';
              const isOpen = depotDocId === doc.id;
              // Pièce validée = verrouillée : plus de dépôt possible, mais elle
              // reste consultable et téléchargeable (le lien signé est fourni
              // par l'API). `verrouille` sert aussi à l'expliquer à l'écran.
              const verrouille = doc.status === 'accepte';
              // Le lien signé expire vite : on le relit à chaque rendu plutôt
              // que de le mémoriser.
              const fichier = doc.fileUrl;
              const enEvidence = surligneDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  ref={enEvidence ? docSurligneRef : undefined}
                  style={{
                    border: `1px solid ${enEvidence ? 'var(--destructive)' : needsDepot ? 'rgba(192,57,43,0.16)' : 'var(--border)'}`,
                    boxShadow: enEvidence ? '0 0 0 3px rgba(192,57,43,0.15)' : 'none',
                    transition: 'box-shadow var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out)',
                    borderRadius: 'var(--r-md)', overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{doc.label}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{DOC_DESCRIPTIONS[doc.id] ?? ''}</div>
                      {doc.commentaire && (doc.status === 'refuse' || doc.status === 'a-remplacer') && (
                        <div style={{ marginTop: 5, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--destructive)', fontStyle: 'italic' }}>"{doc.commentaire}"</div>
                      )}
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 'var(--r-full)', background: cfg.bg, color: cfg.color, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {verrouille && <Lock size={11} />}{cfg.label}
                    </span>

                    {/* Consultation : possible dès qu'un fichier existe, y compris
                        sur une pièce validée — c'est tout ce qui lui reste. */}
                    {fichier && (
                      <>
                        <a href={fichier} target="_blank" rel="noopener noreferrer" title={`Visualiser ${doc.label}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          <Eye size={13} /> Visualiser
                        </a>
                        <a href={fichier} download={doc.submittedLabel ?? doc.label} title={`Télécharger ${doc.label}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          <Download size={13} /> Télécharger
                        </a>
                      </>
                    )}

                    {needsDepot && !isOpen && (
                      <button onClick={() => setDepotDocId(doc.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        <FileUp size={13} />
                        {doc.status === 'refuse' ? 'Renvoyer le document'
                          : doc.status === 'a-remplacer' ? 'Remplacer'
                          : 'Déposer'}
                      </button>
                    )}
                  </div>

                  {/* Pourquoi il n'y a plus de bouton de dépôt : une pièce validée
                      est verrouillée, on le dit plutôt que de laisser un vide. */}
                  {verrouille && (
                    <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <CheckCircle2 size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        Pièce validée par votre conseiller — elle ne peut plus être remplacée.
                      </span>
                    </div>
                  )}
                  {needsDepot && isOpen && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ paddingTop: 14 }}>
                        <InlineDepot label={doc.label} onDeposit={file => handleDepot(doc.id, file)} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* 3 — Résumé + Historique */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

          {/* Résumé */}
          <div style={{ background: 'var(--card)', border: CARD_BORDER, borderRadius: CARD_RADIUS, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
            <div style={{ padding: SECTION_PAD, borderBottom: '1px solid rgba(99,2,16,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'rgba(99,2,16,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <LayoutGrid size={17} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Résumé de la demande</h3>
            </div>
            <div style={{ padding: '8px 28px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', margin: '16px 0' }}>
                {[
                  { label: 'Montant demandé', value: form.montant || '—', sub: 'FCFA', icon: <Banknote size={14} />, color: 'var(--primary)' },
                  { label: 'Durée', value: form.duree, sub: 'ans', icon: <Timer size={14} />, color: 'var(--accent)' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--card)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ color: item.color }}>{item.icon}</span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>
                      {item.value} <span style={{ fontSize: '0.7em', fontWeight: 500, color: 'var(--muted-foreground)' }}>{item.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
              {[
                { label: 'Référence',        value: submitted ? DEMO_REF : '—',                    icon: <Hash size={13} /> },
                { label: submitted ? 'Date de dépôt' : 'Compte créé le', value: DEMO_DATE,           icon: <Calendar size={13} /> },
                { label: 'Nature du projet', value: NATURE_LABELS[form.natureProjet] ?? form.natureProjet,  icon: <Building2 size={13} /> },
                { label: 'Apport personnel', value: `${form.apport || '0'} FCFA`,                             icon: <Banknote size={13} /> },
                { label: 'Agence',           value: 'CPI Immobilier — Dakar',                                icon: <MapPin size={13} /> },
                { label: 'Conseiller',       value: client.conseiller === 'Non assigné' ? '— (à assigner)' : client.conseiller, icon: <User2 size={13} /> },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(99,2,16,0.06)' : 'none', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted-foreground)' }}>
                    {row.icon}
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{row.label}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 'var(--r-md)', background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Statut actuel</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: sc.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} /> {sc.label}
                </span>
              </div>
            </div>
          </div>

          {/* Historique (réel — actions de votre conseiller CPI) */}
          <div style={{ background: 'var(--card)', border: CARD_BORDER, borderRadius: CARD_RADIUS, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
            <div style={{ padding: SECTION_PAD, borderBottom: '1px solid rgba(99,2,16,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'rgba(200,146,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Clock size={17} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Historique de traitement</h3>
            </div>
            <div style={{ padding: '20px 28px 24px' }}>
              {recentHistory.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: 0 }}>
                  Aucune action pour le moment. Les validations de votre conseiller apparaîtront ici.
                </p>
              ) : recentHistory.map((ev, i) => {
                const Icon = HISTO_ICON[ev.type] ?? FileText;
                const color = HISTO_COLOR[ev.type] ?? 'var(--muted-foreground)';
                return (
                  <div key={ev.id} style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--secondary)', border: `1.5px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                        <Icon size={16} />
                      </div>
                      {i < recentHistory.length - 1 && (
                        <div style={{ width: 1.5, flex: 1, minHeight: 16, background: 'var(--border)', marginTop: 4 }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < recentHistory.length - 1 ? 22 : 0, flex: 1, minWidth: 0, paddingTop: 4 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.4 }}>
                        {ev.action}
                      </div>
                      <span style={{ display: 'inline-block', marginTop: 5, padding: '2px 8px', borderRadius: 'var(--r-xs)', background: 'var(--secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                        {ev.date} · {ev.heure}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4 — Actions disponibles */}
        <div style={{ background: 'var(--card)', border: CARD_BORDER, borderRadius: CARD_RADIUS, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
          <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(99,2,16,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={15} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Actions disponibles</h3>
          </div>

          <div style={{ padding: '8px 0' }}>
            {/* Action prioritaire — reflète l'état réel du dossier.
                Tant qu'une pièce bloque : elle mène droit à cette pièce.
                Une fois tout validé : elle devient un état, pas un bouton —
                un clic qui ne mènerait nulle part n'a pas lieu d'être. */}
            {dossierComplet ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 28px', borderBottom: '1px solid rgba(99,2,16,0.06)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,107,68,0.1)', border: '1px solid rgba(26,107,68,0.22)' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)', marginBottom: 1 }}>Dossier complet</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    Vos {totalDocs} pièces obligatoires ont été validées par votre conseiller.
                  </div>
                </div>
              </div>
            ) : docsAAgir.length > 0 && (
              <button onClick={allerAuDocABloquer} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 28px', background: 'rgba(192,57,43,0.04)', border: 'none', borderBottom: '1px solid rgba(99,2,16,0.06)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.22)' }}>
                  <AlertCircle size={16} style={{ color: 'var(--destructive)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--destructive)', marginBottom: 1 }}>Compléter les informations</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    {hasDocIssue
                      ? 'Une pièce a été refusée — la renvoyer débloque votre dossier'
                      : `${docsAAgir.length} pièce${docsAAgir.length > 1 ? 's' : ''} à envoyer`}
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
              </button>
            )}

            <button onClick={() => navigate('mon-dossier')} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 28px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(99,2,16,0.06)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,146,26,0.12)', border: '1px solid rgba(200,146,26,0.2)' }}>
                <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 1 }}>Suivre mon dossier</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Consulter l'état de vos pièces et vos documents CPI</div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0, opacity: 0.5 }} />
            </button>

            <button
              onClick={() => recapMutation.mutate()}
              disabled={recapMutation.isPending}
              aria-busy={recapMutation.isPending || undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 28px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(99,2,16,0.06)', cursor: recapMutation.isPending ? 'wait' : 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--secondary)' }}>
                {recapMutation.isPending
                  ? <Loader2 size={16} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
                  : <Printer size={16} style={{ color: 'var(--primary)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 1 }}>Télécharger le récapitulatif</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                  {recapMutation.isPending ? 'Génération du PDF en cours…' : 'Exporter le résumé complet de votre demande en PDF'}
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0, opacity: 0.5 }} />
            </button>

            <button onClick={() => navigate('support')} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 28px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--secondary)' }}>
                <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 1 }}>Contacter mon conseiller</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{client.conseiller === 'Non assigné' ? 'Envoyer un message au support CPI' : `Envoyer un message direct à ${client.conseiller}`}</div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0, opacity: 0.5 }} />
            </button>
          </div>

          {/* ── Bandeau bas — contextuel ── */}
          {submitted && (
            statut === 'validee' ? (
              <div style={{ margin: '0 20px 20px', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(26,107,68,0.07)', border: '1px solid rgba(26,107,68,0.18)', borderRadius: 'var(--r-md)' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--success)', fontWeight: 700 }}>Dossier complet.</strong> Tous les documents obligatoires ont été validés par votre conseiller.
                </p>
              </div>
            ) : hasDocIssue ? (
              <div style={{ margin: '0 20px 20px', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.18)', borderRadius: 'var(--r-md)' }}>
                <AlertCircle size={15} style={{ color: 'var(--destructive)', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.65 }}>
                  <strong style={{ color: 'var(--destructive)', fontWeight: 700 }}>Action requise</strong> — un ou plusieurs documents ont été refusés par votre conseiller. Remplacez-les dans la section « Documents requis » ci-dessus.
                </p>
              </div>
            ) : (
              <div style={{ margin: '0 20px 20px', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(200,146,26,0.07)', border: '1px solid rgba(200,146,26,0.2)', borderRadius: 'var(--r-md)' }}>
                <AlertCircle size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.6 }}>
                  Votre demande est en cours d'étude par votre conseiller CPI.
                </p>
              </div>
            )
          )}
        </div>

      </div>

      {/* ── Toast stack ──────────────────────────────────────── */}
      <ToastStack toasts={toasts} />

    </div>
  );
}
