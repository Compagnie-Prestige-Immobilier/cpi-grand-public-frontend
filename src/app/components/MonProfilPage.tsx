import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, MapPin, Briefcase, Banknote,
  Edit3, CheckCircle, Camera, Phone, Mail, Building2, Calendar, Clock,
  Copy, Check, TrendingUp, TrendingDown, Minus,
  AlertCircle, Shield, BadgeCheck, Loader2,
  LogOut, KeyRound, Monitor, Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '../App';
import { auth, clientApi } from '../api/endpoints';
import { apiErrorMessage, SILENCIEUX } from '../api/client';
import { toast } from 'sonner';
import { useClientData } from '../data/useClientData';
import { useDocState } from '../data/docStateContext';
import { MY_PROFILE_QUERY_KEY } from '../data/clientRegistry';
import { toActivityEntries, useHistoriqueQuery } from '../data/activityLog';
import { formatFCFA, parseFrDate } from '../lib/format';

interface MonProfilPageProps {
  user: AuthUser;
  onLogout?: () => void;
}


// ─── Primitives ───────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      title="Copier"
      style={{
        background: 'none', border: 'none', padding: '2px 4px',
        cursor: 'pointer', color: copied ? '#1A6B44' : 'var(--muted-foreground)',
        display: 'inline-flex', alignItems: 'center', transition: 'color 0.15s',
        borderRadius: 'var(--r-xs)',
      }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = 'var(--primary)'; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = 'var(--muted-foreground)'; }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function FieldRow({
  label,
  value,
  icon: Icon,
  mono = false,
  copyable = false,
  link,
  accent = false,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  mono?: boolean;
  copyable?: boolean;
  link?: string;
  accent?: boolean;
}) {
  const valueEl = link ? (
    <a
      href={link}
      style={{
        fontFamily: mono ? 'monospace' : 'var(--font-sans)',
        fontSize: '0.9375rem', fontWeight: 500,
        color: 'var(--primary)', textDecoration: 'none',
      }}
    >
      {value}
    </a>
  ) : (
    <span style={{
      fontFamily: mono ? 'monospace' : 'var(--font-sans)',
      fontSize: '0.9375rem', fontWeight: accent ? 600 : 500,
      color: accent ? 'var(--primary)' : 'var(--foreground)',
      letterSpacing: mono ? '0.04em' : undefined,
    }}>
      {value}
    </span>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 0' }}>
      {Icon && (
        <div style={{
          width: '32px', height: '32px', borderRadius: 'var(--r-sm)',
          background: 'var(--secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: '1px',
        }}>
          <Icon size={14} style={{ color: 'var(--primary)' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '0.6875rem', fontWeight: 600,
          letterSpacing: '0.07em', textTransform: 'uppercase',
          color: 'var(--muted-foreground)', marginBottom: '3px',
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {valueEl}
          {copyable && <CopyButton value={value} />}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border)', margin: '0 24px' }} />;
}

function SectionCard({
  children,
  icon: Icon,
  title,
  subtitle,
  onEdit,
  editing,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onEdit?: () => void;
  editing?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: 'var(--r-sm)',
            background: 'var(--secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem', fontWeight: 700,
              color: 'var(--foreground)',
            }}>{title}</div>
            {subtitle && (
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.8125rem', color: 'var(--muted-foreground)',
              }}>{subtitle}</div>
            )}
          </div>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: 'var(--r-sm)',
              border: `1px solid ${editing ? 'var(--primary)' : 'var(--border)'}`,
              background: editing ? 'var(--secondary)' : 'transparent',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
              color: editing ? 'var(--primary)' : 'var(--muted-foreground)',
              cursor: 'pointer', transition: 'all var(--dur-1) var(--ease-out)',
            }}
            onMouseEnter={e => {
              if (!editing) {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.background = 'var(--secondary)';
              }
            }}
            onMouseLeave={e => {
              if (!editing) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--muted-foreground)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Edit3 size={13} />
            {editing ? 'Fermer' : 'Modifier'}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      padding: '0 24px',
    }}>
      {children}
    </div>
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ value, size = 56, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-border)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

// ─── Édition du profil ────────────────────────────────────────────────────────

/**
 * Champs réellement modifiables par le client.
 *
 * La liste est calquée sur `ClientController::updateMyProfile` : le serveur
 * n'accepte que ces clés. Tout autre champ du profil (date de naissance, CNI,
 * revenus…) n'existe ni dans ClientData ni en base — il s'affiche « — » et
 * n'est pas proposé à l'édition, faute de quoi la saisie serait perdue.
 */
type ChampProfil = 'name' | 'phone' | 'adresse' | 'employer' | 'fonction';

interface DefChamp { cle: ChampProfil; label: string; type?: string; placeholder?: string }

function PanneauEdition({
  champs, valeurs, onClose,
}: {
  champs: DefChamp[];
  valeurs: Record<ChampProfil, string>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(champs.map(c => [c.cle, valeurs[c.cle] === '—' ? '' : valeurs[c.cle]])));

  const mutation = useMutation({
    // Cet écran affiche lui-même le message d'erreur : pas de toast en double.
    meta: SILENCIEUX,
    mutationFn: (payload: Record<string, string | null>) => clientApi.updateProfile(payload),
    onSuccess: () => {
      // Le registre client dérive de cette requête : sans invalidation, l'écran
      // continuerait d'afficher l'ancienne valeur jusqu'au prochain chargement.
      void queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY });
      onClose();
    },
  });

  const enregistrer = () => {
    // Un champ vidé est envoyé à null (le serveur accepte nullable) plutôt que
    // comme chaîne vide, qui se relirait ensuite comme une valeur renseignée.
    const payload: Record<string, string | null> = {};
    for (const c of champs) {
      const v = form[c.cle]?.trim() ?? '';
      if (c.cle === 'name' && v === '') continue; // le nom ne peut pas être effacé
      payload[c.cle] = v === '' ? null : v;
    }
    mutation.mutate(payload);
  };

  return (
    <div style={{ margin: '0 24px 20px', padding: '18px 20px', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {champs.map(c => (
          <label key={c.cle} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
              {c.label}
            </span>
            <input
              type={c.type ?? 'text'}
              value={form[c.cle] ?? ''}
              placeholder={c.placeholder}
              onChange={e => setForm(f => ({ ...f, [c.cle]: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)' }}
            />
          </label>
        ))}
      </div>

      {mutation.isError && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--destructive)' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {apiErrorMessage(mutation.error, "L'enregistrement de votre profil a échoué.")}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={enregistrer} disabled={mutation.isPending} aria-busy={mutation.isPending || undefined}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, cursor: mutation.isPending ? 'wait' : 'pointer' }}>
          {mutation.isPending ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Enregistrement…</> : <><Check size={13} /> Enregistrer</>}
        </button>
        <button onClick={onClose} disabled={mutation.isPending}
          style={{ padding: '9px 20px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    </div>
  );
}


// ─── Photo de profil ─────────────────────────────────────────────────────────

/**
 * Envoi et retrait de la photo de profil (`POST` / `DELETE /auth/avatar`).
 *
 * Ce mécanisme n'existait que sur le profil du personnel. Côté client, le
 * bouton appareil photo posé sur l'avatar n'avait AUCUN gestionnaire : cliquer
 * dessus ne faisait rien, sans le moindre retour. La route existe pourtant, et
 * `UserData.avatarUrl` sert déjà l'image dans toute l'application.
 *
 * Les contraintes reproduites ici sont celles de l'API (5 Mo, jpg/jpeg/png/
 * webp) : elles évitent un aller-retour réseau pour un refus prévisible. Le
 * serveur reste l'autorité — son message est affiché tel quel s'il refuse.
 */
const AVATAR_TAILLE_MAX = 5 * 1024 * 1024;
const AVATAR_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

function useAvatar(initial: string | null | undefined) {
  const [avatar, setAvatar] = useState<string | null>(initial ?? null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const choisir = async (file: File) => {
    if (!AVATAR_FORMATS.includes(file.type)) {
      toast.error('Format non accepté. Choisissez une image JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > AVATAR_TAILLE_MAX) {
      toast.error('Image trop lourde : 5 Mo au maximum.');
      return;
    }
    setEnvoiEnCours(true);
    try {
      const updated = await auth.updateAvatar(file);
      setAvatar(updated.avatarUrl ?? null);
      toast.success('Photo de profil mise à jour.');
    } catch (e) {
      toast.error(apiErrorMessage(e, "L'envoi de la photo a échoué."));
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const retirer = async () => {
    setEnvoiEnCours(true);
    try {
      await auth.removeAvatar();
      setAvatar(null);
      toast.success('Photo retirée.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'La suppression de la photo a échoué.'));
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return { avatar, envoiEnCours, choisir, retirer };
}

/** Pastille appareil photo posée sur l'avatar — un vrai champ de fichier. */
function BoutonPhoto({ onPick, disabled, id }: { onPick: (f: File) => void; disabled?: boolean; id: string }) {
  return (
    <>
      <label
        htmlFor={id}
        title="Changer la photo de profil"
        style={{
          position: 'absolute', bottom: '2px', right: '2px',
          width: '26px', height: '26px', borderRadius: '50%',
          background: 'var(--accent)', border: '2px solid var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: disabled ? 'wait' : 'pointer',
        }}
      >
        {disabled ? <Loader2 size={12} style={{ color: '#fff', animation: 'spin 0.8s linear infinite' }} /> : <Camera size={12} style={{ color: '#fff' }} />}
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Changer la photo de profil</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ''; }}
      />
    </>
  );
}

/**
 * Ancienneté du compte, calculée depuis la date d'inscription réelle.
 *
 * La jauge à cinq segments était figée sur `i < 3` : elle affichait trois
 * segments allumés pour tout le monde, y compris pour un compte créé la
 * veille. Une donnée inventée présentée comme un fait.
 */
function anciennete(dateInscription: string | undefined): { label: string; segments: number } | null {
  const debut = parseFrDate(dateInscription);
  if (!debut) return null;
  const mois = Math.max(0, Math.round((Date.now() - debut.getTime()) / (30.44 * 86_400_000)));
  const annees = Math.floor(mois / 12);
  const label =
    mois < 1 ? "Depuis aujourd'hui"
    : mois < 12 ? `${mois} mois`
    : annees === 1 ? '1 an'
    : `${annees} ans`;
  // Un segment par année révolue, le premier étant l'année en cours.
  return { label, segments: Math.min(5, annees + 1) };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MonProfilPage({ user, onLogout }: MonProfilPageProps) {
  // Le personnel CPI (Admin / Agent) a un profil de compte professionnel, pas un
  // profil client (ni CNI, ni revenus, ni dossier).
  if (user.role === 'admin' || user.role === 'agent-cpi') {
    return <StaffProfile user={user} onLogout={onLogout} />;
  }
  return <ClientProfile user={user} />;
}

function ClientProfile({ user }: { user: AuthUser }) {
  const clientData = useClientData();
  const { requisDocs } = useDocState();

  // Compteur RÉEL de pièces déposées (aucune valeur inventée).
  const docsTotalReal = requisDocs.length;
  const docsDeposesReal = requisDocs.filter(d => d.status !== 'en-attente').length;
  const docsLabel = docsTotalReal ? `${docsDeposesReal} / ${docsTotalReal}` : '—';

  // Profil réel du client : les informations connues viennent de son compte,
  // le reste reste à compléter (aucune donnée fictive).
  const PROFILE = {
    nom: clientData.name.split(' ').slice(1).join(' ').toUpperCase() || '—',
    prenom: clientData.name.split(' ')[0] || '—',
    dateNaissance: '—',
    lieuNaissance: '—',
    nationalite: '—',
    sexe: '—',
    situationMatrimoniale: '—',
    numeroPiece: '—',
    expirationPiece: '—',
    telPrincipal: clientData.phone,
    telSecondaire: '—',
    email: clientData.email,
    adresse: clientData.address,
    ville: '—',
    region: '—',
    pays: '—',
    codePostal: '—',
    typeProfile: user.role === 'client-fonctionnaire' ? 'Fonctionnaire' : 'Secteur privé / Autre',
    employeur: clientData.employer,
    ministere: '—',
    fonction: clientData.fonction,
    typeContrat: '—',
    dateEmbauche: '—',
    secteur: '—',
    revenus: 0,
    autresRevenus: 0,
    charges: 0,
    banque: clientData.banque,
    iban: '—',
    modePaiement: '—',
    clientNumber: clientData.ref,
    dossierNumber: clientData.ref,
    dateInscription: clientData.adhesionDate,
    progression: clientData.progression,
    docsDeposes: docsDeposesReal,
    docsTotal: docsTotalReal,
    lastLogin: '—',
  };
  const hasPiece = PROFILE.numeroPiece !== '—';

  const [editing, setEditing] = useState<string | null>(null);
  const toggle = (s: string) => setEditing(prev => prev === s ? null : s);

  // Valeurs courantes des seuls champs que le serveur sait enregistrer.
  const valeursEditables: Record<ChampProfil, string> = {
    name: clientData.name,
    phone: clientData.phone,
    adresse: clientData.address,
    employer: clientData.employer,
    fonction: clientData.fonction,
  };

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const photo = useAvatar(user.avatarUrl);
  // Ancienneté réelle du compte ; `null` tant que la date d'inscription est
  // inconnue — auquel cas la ligne entière disparaît plutôt que d'afficher
  // une jauge décorative.
  const anc = anciennete(clientData.adhesionDate);
  const revenuTotal = PROFILE.revenus + PROFILE.autresRevenus;
  const capacite = revenuTotal - PROFILE.charges;
  const tauxEndettement = revenuTotal > 0 ? Math.round((PROFILE.charges / revenuTotal) * 100) : 0;

  // Aucun revenu déclaré ⇒ on n'affiche NI montant NI taux.
  //
  // Sans ce garde-fou, les compteurs valaient « 0 FCFA » et le taux
  // d'endettement « 0 % » en vert : une absence de donnée se lisait comme une
  // évaluation financière favorable. Un tiret dit la vérité — la donnée manque.
  const hasFinance = revenuTotal > 0;
  const montant = (v: number) => (hasFinance ? formatFCFA(v) : '—');

  return (
    <div style={{
      width: '100%',
      display: 'flex', flexDirection: 'column', gap: '20px',
      fontFamily: 'var(--font-sans)',
      paddingBottom: '48px',
    }}>

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--primary)',
        borderRadius: 'var(--r-xl)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Decorative arc */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '260px', height: '260px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '40px', right: '60px',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'rgba(200,146,26,0.08)',
          pointerEvents: 'none',
        }} />

        {/* Main row */}
        <div style={{
          padding: '32px 36px 28px',
          display: 'flex', alignItems: 'flex-start',
          gap: '28px', flexWrap: 'wrap',
          position: 'relative',
        }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: '88px', height: '88px', borderRadius: '50%',
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.12)',
              border: '2.5px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {photo.avatar
                ? <img src={photo.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.75rem', fontWeight: 800, color: '#fff',
                  }}>{initials}</span>}
            </div>
            <BoutonPhoto id="photo-profil-client" onPick={photo.choisir} disabled={photo.envoiEnCours} />
          </div>

          {/* Identity block */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem', fontWeight: 800, color: '#fff',
                margin: 0, lineHeight: 1.2,
              }}>
                {PROFILE.prenom} <span style={{ opacity: 0.85 }}>{PROFILE.nom}</span>
              </h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'rgba(110,240,168,0.18)', color: '#6EF0A8',
                fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 'var(--r-full)',
              }}>
                <BadgeCheck size={11} />
                Compte actif
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(200,146,26,0.22)', color: 'var(--accent-on-dark)',
                fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
                fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 'var(--r-full)',
              }}>
                {PROFILE.typeProfile}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>·</span>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.55)', fontWeight: 400,
              }}>
                {PROFILE.fonction}
              </span>
            </div>

            {/* Meta chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: 'N° Client', value: PROFILE.clientNumber },
                { label: 'N° Dossier', value: PROFILE.dossierNumber },
                { label: 'Depuis', value: PROFILE.dateInscription },
              ].map(m => (
                <div key={m.label} style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--r-sm)', padding: '6px 12px',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: '0.5625rem',
                    fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.42)', marginBottom: '2px',
                  }}>{m.label}</div>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                    fontWeight: 600, color: 'rgba(255,255,255,0.88)',
                  }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress + edit */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
            {/* Progress ring */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.42)',
                }}>Dossier</div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '1.375rem',
                  fontWeight: 800, color: 'var(--accent-on-dark)', lineHeight: 1,
                }}>{PROFILE.progression}%</div>
              </div>
              <ProgressRing value={PROFILE.progression} size={52} stroke={4} />
            </div>

            <button
              onClick={() => setEditing('identite')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '9px 16px', borderRadius: 'var(--r-sm)',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
                color: '#fff', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
              }}
            >
              <Edit3 size={13} />
              Modifier mon profil
            </button>
          </div>
        </div>

        {/* Stats footer */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          borderTop: '1px solid rgba(255,255,255,0.09)',
          padding: '0 36px',
        }}>
          {[
            { label: 'Dernière connexion', value: '—', icon: Clock },
            { label: 'Documents déposés', value: docsLabel, icon: Shield },
            { label: 'Progression dossier', value: `${PROFILE.progression} %`, icon: TrendingUp },
            { label: 'Conseiller', value: clientData.conseiller, icon: User },
          ].map((s, i, arr) => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '16px 0',
              borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.09)' : 'none',
              paddingRight: i < arr.length - 1 ? '24px' : '0',
              paddingLeft: i > 0 ? '24px' : '0',
            }}>
              <s.icon size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              <div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.625rem',
                  fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.38)',
                }}>{s.label}</div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.875rem',
                  fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── IDENTITÉ ──────────────────────────────────────────────────────── */}
      <SectionCard
        icon={User}
        title="Identité"
        subtitle="Informations personnelles et pièce d'identité"
        onEdit={() => toggle('identite')}
        editing={editing === 'identite'}
      >
        <FieldsGrid>
          <FieldRow label="Nom de famille" value={PROFILE.nom} accent />
          <FieldRow label="Prénom(s)" value={PROFILE.prenom} accent />
          <FieldRow label="Date de naissance" value={PROFILE.dateNaissance} icon={Calendar} />
          <FieldRow label="Lieu de naissance" value={PROFILE.lieuNaissance} icon={MapPin} />
          <FieldRow label="Nationalité" value={PROFILE.nationalite} />
          <FieldRow label="Sexe" value={PROFILE.sexe} />
          <FieldRow label="Situation matrimoniale" value={PROFILE.situationMatrimoniale} />
        </FieldsGrid>

        <Divider />

        {/* ID card block */}
        <div style={{ padding: '16px 24px 20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: '260px',
            background: 'var(--secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: 'var(--r-sm)',
              background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Shield size={20} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: 'var(--muted-foreground)', marginBottom: '4px',
              }}>Carte Nationale d'Identité</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: '0.9375rem',
                  fontWeight: 600, color: 'var(--foreground)', letterSpacing: '0.05em',
                }}>
                  {PROFILE.numeroPiece}
                </span>
                <CopyButton value={PROFILE.numeroPiece} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {hasPiece ? (
                  <>
                    <span style={{
                      background: 'rgba(26,107,68,0.1)', color: '#1A6B44',
                      fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                      fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: 'var(--r-full)',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}>
                      <CheckCircle size={9} /> Valide
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                      color: 'var(--muted-foreground)',
                    }}>expire le {PROFILE.expirationPiece}</span>
                  </>
                ) : (
                  <span style={{
                    background: 'var(--muted)', color: 'var(--muted-foreground)',
                    fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                    fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 'var(--r-full)',
                  }}>Non renseignée</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {editing === 'identite' && (
          <>
            <div style={{
              margin: '0 24px 12px',
              padding: '12px 16px',
              background: 'rgba(200,146,26,0.07)',
              border: '1px solid rgba(200,146,26,0.2)',
              borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <AlertCircle size={14} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                color: 'var(--accent-text)', fontWeight: 500,
              }}>
                Les pièces d'identité (CNI, date et lieu de naissance) sont renseignées par votre conseiller CPI à partir des documents déposés.
              </span>
            </div>
            <PanneauEdition
              champs={[{ cle: 'name', label: 'Nom complet', placeholder: 'Prénom et nom' }]}
              valeurs={valeursEditables}
              onClose={() => setEditing(null)}
            />
          </>
        )}
      </SectionCard>

      {/* ─── COORDONNÉES ───────────────────────────────────────────────────── */}
      <SectionCard
        icon={MapPin}
        title="Coordonnées"
        subtitle="Contact et adresse de résidence"
        onEdit={() => toggle('coords')}
        editing={editing === 'coords'}
      >
        {/* Contact rapide */}
        <div style={{ padding: '20px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
          {[
            { icon: Phone, label: 'Tél. principal', value: PROFILE.telPrincipal, href: `tel:${PROFILE.telPrincipal}` },
            { icon: Phone, label: 'Tél. secondaire', value: PROFILE.telSecondaire, href: `tel:${PROFILE.telSecondaire}` },
            { icon: Mail, label: 'Email', value: PROFILE.email, href: `mailto:${PROFILE.email}` },
          ].map(c => (
            <a
              key={c.label}
              href={c.href}
              style={{
                flex: '1', minWidth: '180px',
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                textDecoration: 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--card)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--secondary)';
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: 'var(--r-sm)',
                background: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <c.icon size={14} style={{ color: '#fff' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                }}>{c.label}</div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.875rem',
                  fontWeight: 600, color: 'var(--foreground)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.value}</div>
              </div>
            </a>
          ))}
        </div>

        {/* Address grid */}
        <FieldsGrid>
          <FieldRow label="Adresse" value={PROFILE.adresse} icon={MapPin} />
          <FieldRow label="Ville" value={PROFILE.ville} />
          <FieldRow label="Région" value={PROFILE.region} />
          <FieldRow label="Pays" value={PROFILE.pays} />
          <FieldRow label="Code postal" value={PROFILE.codePostal} />
          <div style={{ padding: '14px 0' }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
              fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--muted-foreground)', marginBottom: '6px',
            }}>Localisation GPS</div>
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: 'var(--r-sm)',
              border: '1px dashed var(--border)', background: 'transparent',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
              fontWeight: 600, color: 'var(--primary)', cursor: 'pointer',
            }}>
              <MapPin size={12} />
              Activer la localisation
            </button>
          </div>
        </FieldsGrid>

        {editing === 'coords' && (
          <PanneauEdition
            champs={[
              { cle: 'phone', label: 'Téléphone principal', type: 'tel', placeholder: '+221 77 000 00 00' },
              { cle: 'adresse', label: 'Adresse de résidence', placeholder: 'Quartier, ville' },
            ]}
            valeurs={valeursEditables}
            onClose={() => setEditing(null)}
          />
        )}
      </SectionCard>

      {/* ─── PROFIL PROFESSIONNEL ───────────────────────────────────────────── */}
      <SectionCard
        icon={Briefcase}
        title="Profil professionnel"
        subtitle="Emploi, contrat et ancienneté"
        onEdit={() => toggle('pro')}
        editing={editing === 'pro'}
      >
        {/* Type badge banner */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            padding: '10px 18px',
            background: 'var(--secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--primary)', flexShrink: 0,
            }} />
            <div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
              }}>Type de profil</div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '1rem',
                fontWeight: 700, color: 'var(--primary)',
              }}>{PROFILE.typeProfile}</div>
            </div>
          </div>

          {anc && (
            <>
              <div style={{ height: '40px', width: '1px', background: 'var(--border)', flexShrink: 0 }} />

              <div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--muted-foreground)', marginBottom: '2px',
                }}>Ancienneté</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: '1rem',
                    fontWeight: 700, color: 'var(--foreground)',
                  }}>{anc.label}</div>
                  {/* Un segment par année révolue — et non trois, quoi qu'il arrive. */}
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }} aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} style={{
                        width: '20px', height: '5px', borderRadius: 'var(--r-full)',
                        background: i < anc.segments ? 'var(--primary)' : 'var(--muted)',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <FieldsGrid>
          <FieldRow label="Employeur" value={PROFILE.employeur} icon={Building2} />
          <FieldRow label="Ministère / Structure" value={PROFILE.ministere} />
          <FieldRow label="Fonction" value={PROFILE.fonction} />
          <FieldRow label="Type de contrat" value={PROFILE.typeContrat} />
          <FieldRow label="Date d'embauche" value={PROFILE.dateEmbauche} icon={Calendar} />
          <FieldRow label="Secteur d'activité" value={PROFILE.secteur} />
        </FieldsGrid>

        {editing === 'pro' && (
          <PanneauEdition
            champs={[
              { cle: 'employer', label: 'Employeur', placeholder: 'Nom de votre employeur' },
              { cle: 'fonction', label: 'Fonction', placeholder: 'Votre poste' },
            ]}
            valeurs={valeursEditables}
            onClose={() => setEditing(null)}
          />
        )}
      </SectionCard>

      {/* ─── INFORMATIONS FINANCIÈRES ───────────────────────────────────────── */}
      <SectionCard
        icon={Banknote}
        title="Informations financières"
        subtitle="Revenus, charges et coordonnées bancaires"
        // Pas de bouton « Modifier » ici : aucun champ financier n'existe côté
        // serveur (ni dans ClientData, ni en base). Un bouton d'édition aurait
        // ouvert une saisie que rien n'aurait pu enregistrer.
      >
        {/* Financial summary cards */}
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', borderBottom: '1px solid var(--border)' }}>
          {[
            {
              label: 'Revenus totaux',
              value: montant(revenuTotal),
              icon: TrendingUp,
              color: hasFinance ? '#1A6B44' : 'var(--muted-foreground)',
              bg: hasFinance ? 'rgba(26,107,68,0.08)' : 'var(--muted)',
              iconColor: hasFinance ? '#1A6B44' : 'var(--muted-foreground)',
            },
            {
              label: 'Charges mensuelles',
              value: montant(PROFILE.charges),
              icon: TrendingDown,
              color: hasFinance ? 'var(--accent-text)' : 'var(--muted-foreground)',
              bg: hasFinance ? 'rgba(200,146,26,0.08)' : 'var(--muted)',
              iconColor: hasFinance ? 'var(--accent-text)' : 'var(--muted-foreground)',
            },
            {
              label: 'Capacité de remboursement',
              value: montant(capacite),
              icon: Minus,
              color: hasFinance ? 'var(--primary)' : 'var(--muted-foreground)',
              bg: hasFinance ? 'var(--secondary)' : 'var(--muted)',
              iconColor: hasFinance ? 'var(--primary)' : 'var(--muted-foreground)',
            },
            {
              label: "Taux d'endettement",
              // Pas de revenus connus ⇒ pas de taux, et surtout pas de vert.
              value: hasFinance ? `${tauxEndettement} %` : '—',
              icon: TrendingUp,
              color: !hasFinance ? 'var(--muted-foreground)' : tauxEndettement > 33 ? 'var(--destructive)' : '#1A6B44',
              bg: !hasFinance ? 'var(--muted)' : tauxEndettement > 33 ? 'rgba(192,57,43,0.07)' : 'rgba(26,107,68,0.08)',
              iconColor: !hasFinance ? 'var(--muted-foreground)' : tauxEndettement > 33 ? 'var(--destructive)' : '#1A6B44',
            },
          ].map(card => (
            <div key={card.label} style={{
              background: card.bg,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: '14px 16px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                }}>{card.label}</div>
                <card.icon size={14} style={{ color: card.iconColor }} />
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '1rem',
                fontWeight: 700, color: card.color,
              }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Revenue breakdown bar — masquée tant qu'aucun revenu n'est déclaré :
            une barre « Disponible 100 % / Charges 0 % » serait une lecture
            financière inventée de toutes pièces. */}
        {!hasFinance ? (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
              Aucun revenu déclaré — votre conseiller CPI renseigne ces éléments lors de l'étude du dossier.
            </span>
          </div>
        ) : (
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
              fontWeight: 600, color: 'var(--muted-foreground)',
            }}>Répartition revenus / charges</span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
              fontWeight: 600, color: 'var(--foreground)',
            }}>{formatFCFA(revenuTotal)}</span>
          </div>
          <div style={{ height: '8px', borderRadius: 'var(--r-full)', background: 'var(--muted)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 'var(--r-full)',
              background: `linear-gradient(90deg, var(--primary) ${100 - tauxEndettement}%, #C8921A ${100 - tauxEndettement}%)`,
              width: '100%',
            }} />
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--primary)' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                Disponible ({100 - tauxEndettement}%)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#C8921A' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                Charges ({tauxEndettement}%)
              </span>
            </div>
          </div>
        </div>
        )}

        {/* Detail fields */}
        <FieldsGrid>
          <FieldRow label="Revenus salariaux" value={montant(PROFILE.revenus)} icon={TrendingUp} accent />
          <FieldRow label="Autres revenus" value={montant(PROFILE.autresRevenus)} />
          <FieldRow label="Charges mensuelles" value={montant(PROFILE.charges)} />
          <FieldRow label="Mode de paiement" value={PROFILE.modePaiement} />
        </FieldsGrid>

        <Divider />

        {/* Bank block */}
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: '280px',
            background: 'var(--secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: 'var(--r-md)',
              background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Building2 size={22} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: 'var(--muted-foreground)', marginBottom: '2px',
              }}>Banque principale</div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.9375rem',
                fontWeight: 700, color: 'var(--foreground)', marginBottom: '6px',
              }}>{PROFILE.banque}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: '0.8125rem',
                  fontWeight: 500, color: 'var(--muted-foreground)',
                  letterSpacing: '0.04em',
                }}>{PROFILE.iban}</span>
                <CopyButton value={PROFILE.iban.replace(/\s/g, '')} />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

    </div>
  );
}

// ─── Profil professionnel (Admin / Agent CPI) ─────────────────────────────────

function deviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux' : 'Appareil';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  return `${br} · ${os}`;
}

function StaffProfile({ user, onLogout }: { user: AuthUser; onLogout?: () => void }) {
  const roleLabel = user.role === 'admin' ? 'Administrateur' : 'Agent CPI';
  // Identité du compte pro : elle vient de /auth/me (pas de /staff/staff/list,
  // réservé à l'administrateur — un agent CPI y recevrait un 403).
  const email = user.email ?? '—';

  const httpsOk = typeof window !== 'undefined' && window.location.protocol === 'https:';
  // Compteur d'actions du compte, lu dans le journal serveur (écran réservé au
  // personnel CPI, seul habilité sur /staff/historique).
  const historiqueQuery = useHistoriqueQuery(true);
  // Filtrage sur l'auteur, pas sur le rôle : « Actions enregistrées » comptait
  // jusqu'ici celles de TOUS les agents CPI et les présentait comme les vôtres.
  const mesActions = toActivityEntries(historiqueQuery.data).filter(e => e.utilisateur === user.name);
  const actionsCount = mesActions.length;
  const derniereAction = mesActions[0];

  // Photo de profil : même mécanisme que le profil client (`useAvatar`), au
  // lieu de deux implémentations divergentes du même appel d'API.
  const photo = useAvatar(user.avatarUrl);
  const avatar = photo.avatar;

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)', paddingBottom: '48px' }}>

      {/* HERO */}
      <div style={{ background: 'var(--primary)', borderRadius: 'var(--r-xl)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ padding: '32px 36px', display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap', position: 'relative' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '88px', height: '88px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.12)', border: '2.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatar
                ? <img src={avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>{initials}</span>}
            </div>
            <BoutonPhoto id="photo-profil-personnel" onPick={photo.choisir} disabled={photo.envoiEnCours} />
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>{user.name}</h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(200,146,26,0.22)', color: 'var(--accent-on-dark)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 'var(--r-full)' }}>
                <Shield size={11} /> {roleLabel}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Mail size={14} style={{ color: 'rgba(255,255,255,0.55)' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)' }}>{email}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)' }}>Compte professionnel CPI</span>
            </div>
          </div>

          {avatar && (
            <button onClick={photo.retirer} disabled={photo.envoiEnCours} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Trash2 size={13} /> Retirer la photo
            </button>
          )}
        </div>
      </div>

      {/* COMPTE */}
      <SectionCard icon={User} title="Compte" subtitle="Informations de votre compte professionnel">
        <FieldsGrid>
          <FieldRow label="Nom" value={user.name} accent />
          <FieldRow label="E-mail / identifiant" value={email} icon={Mail} copyable />
          <FieldRow label="Rôle" value={roleLabel} accent />
          <FieldRow label="Type de compte" value="Compte professionnel CPI" />
          <FieldRow label="Statut" value="Actif" />
        </FieldsGrid>
      </SectionCard>

      {/* SÉCURITÉ */}
      <SectionCard icon={KeyRound} title="Sécurité" subtitle="Accès et protection du compte">
        <div style={{ padding: '8px 24px 16px' }}>
          {/* Mot de passe */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', flexWrap: 'wrap' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><KeyRound size={14} style={{ color: 'var(--primary)' }} /></div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '3px' }}>Mot de passe</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--foreground)', letterSpacing: '0.15em' }}>••••••••</div>
            </div>
            {/* Il n'existe aucune route de changement de mot de passe. Le bouton
                « Modifier » n'ouvrait donc rien et affichait « sera disponible
                une fois le backend connecté » — une phrase écrite pour un
                développeur, dans un écran destiné à un agent CPI. La marche à
                suivre réelle la remplace. */}
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', maxWidth: 260, lineHeight: 1.5 }}>
              Pour le renouveler, adressez-vous à l'administrateur de la plateforme.
            </span>
          </div>
          <Divider />
          {/* Connexion sécurisée */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Shield size={14} style={{ color: 'var(--primary)' }} /></div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '3px' }}>Connexion sécurisée</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 600, color: httpsOk ? '#1A6B44' : 'var(--destructive)' }}>
                <span style={{ width: 7, height: 7, borderRadius: 'var(--r-full)', background: httpsOk ? '#1A6B44' : 'var(--destructive)' }} /> {httpsOk ? 'HTTPS actif' : 'Non sécurisé'}
              </div>
            </div>
          </div>
          <Divider />
          {/* Dernière action enregistrée — lue dans le journal d'audit du
              serveur. L'ancienne ligne annonçait « Dernière connexion » puis
              répondait « Historisée côté serveur », badge « backend » à
              l'appui : trois mots pour dire qu'aucune valeur n'existait. */}
          {derniereAction && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', flexWrap: 'wrap' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Clock size={14} style={{ color: 'var(--primary)' }} /></div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '3px' }}>Dernière action enregistrée</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--foreground)' }}>{derniereAction.date}{derniereAction.heure ? ` à ${derniereAction.heure}` : ''}</div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* JOURNALISATION & DÉCONNEXION */}
      <SectionCard icon={Monitor} title="Session & déconnexion" subtitle="Appareil, activité et fin de session">
        <FieldsGrid>
          <FieldRow label="Appareil actuel" value={deviceLabel()} icon={Monitor} />
          <FieldRow label="Session" value={`Connecté · ${roleLabel}`} />
          <FieldRow label="Actions enregistrées" value={`${actionsCount} dans le journal d'audit`} icon={CheckCircle} />
        </FieldsGrid>
        <div style={{ padding: '4px 24px 22px' }}>
          <button
            onClick={() => onLogout?.()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(192,57,43,0.3)', background: 'rgba(192,57,43,0.06)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--destructive)', cursor: 'pointer' }}>
            <LogOut size={15} /> Se déconnecter
          </button>
        </div>
      </SectionCard>

    </div>
  );
}
