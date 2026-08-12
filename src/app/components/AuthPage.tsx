import { useState, useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaInscription, schemaConnexion, MOT_DE_PASSE_LONGUEUR_MIN, REGLES_MOT_DE_PASSE,
  type Inscription, type Connexion,
} from '../lib/schemas';
import * as Checkbox from '@radix-ui/react-checkbox';
import {
  Eye, EyeOff, Shield, Zap, Headphones, Handshake, Lock,
  ChevronRight, ChevronDown, ArrowLeft, CheckSquare, Square,
  Landmark, Briefcase, UserCircle, ArrowRight, CheckCircle,
  Mail, Building2, AlertCircle, Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPage } from '../App';
import { auth, type AuthPayload } from '../api/endpoints';
import { setToken, apiErrorMessage, apiFieldError } from '../api/client';
import bgWelcome from '../../assets/BG.jpg';
import cpiLogo from '../../assets/image.png';
import ConditionsPage, { ConditionsModal } from './ConditionsPage';
import { fondPhoto } from '../lib/images';

type ProfilType = 'fonctionnaire' | 'prive' | 'autre';

const PROFIL_OPTIONS: {
  type: ProfilType;
  label: string;
  sub: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  cardBg: string;
  textColor: string;
  subColor: string;
  borderColor: string;
}[] = [
  {
    type: 'fonctionnaire',
    label: 'Fonctionnaire',
    sub: 'État, collectivités, établissements publics',
    icon: Landmark,
    color: '#1E4D8C',
    bg: 'rgba(30,77,140,0.08)',
    cardBg: 'var(--card)',
    textColor: 'var(--foreground)',
    subColor: 'var(--muted-foreground)',
    borderColor: 'rgba(30,77,140,0.14)',
  },
  {
    type: 'prive',
    label: 'Secteur privé',
    sub: "CDI, CDD, chef d'entreprise",
    icon: Briefcase,
    color: 'var(--success)',
    bg: 'rgba(26,107,68,0.08)',
    cardBg: 'var(--card)',
    textColor: 'var(--foreground)',
    subColor: 'var(--muted-foreground)',
    borderColor: 'rgba(26,107,68,0.14)',
  },
  {
    type: 'autre',
    label: 'Autre profil',
    sub: 'Profession libérale, indépendant, diaspora',
    icon: UserCircle,
    color: 'var(--accent-text)',
    bg: 'rgba(200,146,26,0.08)',
    cardBg: 'var(--card)',
    textColor: 'var(--foreground)',
    subColor: 'var(--muted-foreground)',
    borderColor: 'rgba(200,146,26,0.14)',
  },
];

interface Props {
  page: AppPage;
  onLogin: (payload: AuthPayload) => void;
  onNavigate: (p: AppPage) => void;
}

// ─── Shared: Field input ──────────────────────────────────────────────────────
function FieldHelp({ id, error, hint }: { id?: string; error?: string; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <span
      id={id}
      // `role="alert"` fait annoncer l'erreur dès son apparition : sans lui, un
      // utilisateur de lecteur d'écran soumettait le formulaire, revenait sur
      // le champ, et n'apprenait jamais ce qui n'allait pas.
      role={error ? 'alert' : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', lineHeight: 1.4, color: error ? 'var(--destructive)' : 'var(--muted-foreground)' }}
    >
      {error ? <AlertCircle size={11} style={{ flexShrink: 0 }} /> : null}{error || hint}
    </span>
  );
}

function Field({ label, type = 'text', placeholder, value, onChange, onBlur, error, valid, hint, icon, autoComplete, required }: {
  label: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void; onBlur?: () => void;
  error?: string; valid?: boolean; hint?: string; icon?: React.ReactNode;
  autoComplete?: string; required?: boolean;
}) {
  // `useId` garantit l'unicité même si le même champ est rendu deux fois
  // (l'écran de connexion affiche deux formulaires, client et professionnel).
  const inputId = useId();
  const helpId = `${inputId}-aide`;
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);
  const isPwd = type === 'password';
  const borderColor = error ? 'var(--destructive)' : focused ? 'var(--primary)' : valid ? 'var(--success)' : hover ? 'var(--muted-foreground)' : 'var(--border)';
  const boxShadow = !focused ? 'none' : error ? '0 0 0 3px rgba(192,57,43,0.14)' : '0 0 0 3px rgba(99,2,16,0.12)';
  const showCheck = valid && !error && !isPwd;
  const rightPad = isPwd ? 42 : showCheck ? 38 : 14;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label htmlFor={inputId} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 'var(--font-weight-medium)' as any, color: 'var(--foreground)' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none', color: focused ? 'var(--primary)' : 'var(--muted-foreground)', transition: 'color var(--dur-1) var(--ease-out)' }}>{icon}</span>
        )}
        <input
          id={inputId}
          type={isPwd && show ? 'text' : type}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? helpId : undefined}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur?.(); }}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 14px', paddingLeft: icon ? 38 : 14, paddingRight: rightPad,
            border: `1.5px solid ${borderColor}`, borderRadius: 'var(--r-sm)',
            background: 'var(--input-background)',
            fontFamily: 'var(--font-sans)', fontSize: '0.9375rem',
            color: 'var(--foreground)', outline: 'none', boxShadow,
            transition: 'border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
          }}
        />
        {isPwd ? (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={show}
            aria-controls={inputId}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 0 }}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : showCheck ? (
          <Check size={15} aria-hidden="true" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--success)', pointerEvents: 'none' }} />
        ) : null}
      </div>
      <FieldHelp id={helpId} error={error} hint={hint} />
    </div>
  );
}

const normalizeSenegalPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^221/, '').slice(0, 9);
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(' ');
};

function PhoneField({ label = 'Téléphone *', value, onChange, error, valid }: {
  label?: string; value: string; onChange: (v: string) => void; error?: string; valid?: boolean;
}) {
  const inputId = useId();
  const helpId = `${inputId}-aide`;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <label htmlFor={inputId} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>{label}</label>
    <div style={{ display: 'flex', alignItems: 'stretch', border: `1.5px solid ${error ? 'var(--destructive)' : valid ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', background: 'var(--input-background)', overflow: 'hidden' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', color: 'var(--muted-foreground)', borderRight: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', whiteSpace: 'nowrap' }}><span aria-label="Sénégal">🇸🇳</span> +221</span>
      <input id={inputId} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="77 000 00 00" value={value} aria-invalid={!!error || undefined} aria-describedby={helpId} onChange={e => onChange(normalizeSenegalPhone(e.target.value))}
        style={{ flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: 0, outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'var(--foreground)' }} />
      {valid && <Check size={15} aria-hidden="true" style={{ alignSelf: 'center', marginRight: 12, color: 'var(--success)' }} />}
    </div>
    <FieldHelp id={helpId} error={error} hint="Format sénégalais : 9 chiffres" />
  </div>;
}

function SelectField({ label, value, onChange, options, placeholder, error, valid, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
  error?: string; valid?: boolean; hint?: string;
}) {
  const selectId = useId();
  const helpId = `${selectId}-aide`;
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);
  const borderColor = error ? 'var(--destructive)' : focused ? 'var(--primary)' : valid ? 'var(--success)' : hover ? 'var(--muted-foreground)' : 'var(--border)';
  const boxShadow = !focused ? 'none' : error ? '0 0 0 3px rgba(192,57,43,0.14)' : '0 0 0 3px rgba(99,2,16,0.12)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label htmlFor={selectId} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 'var(--font-weight-medium)' as any, color: 'var(--foreground)' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          id={selectId}
          value={value}
          aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? helpId : undefined}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 38px 11px 14px',
            border: `1.5px solid ${borderColor}`, borderRadius: 'var(--r-sm)',
            background: 'var(--input-background)',
            fontFamily: 'var(--font-sans)', fontSize: '0.9375rem',
            color: value ? 'var(--foreground)' : 'var(--muted-foreground)', outline: 'none', boxShadow,
            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
            cursor: 'pointer',
            transition: 'border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
          }}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
      </div>
      <FieldHelp id={helpId} error={error} hint={hint} />
    </div>
  );
}

function PrimaryBtn({ children, onClick, type = 'button', fullWidth = true, disabled = false }: {
  children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; fullWidth?: boolean; disabled?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        width: fullWidth ? '100%' : 'auto',
        padding: '13px 24px', background: disabled ? 'var(--muted)' : 'var(--primary)',
        color: disabled ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
        border: 'none', borderRadius: 'var(--r-sm)',
        fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: '0.03em',
        boxShadow: disabled ? 'none' : 'var(--elev-sm)',
        transition: 'background var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out), transform var(--dur-1) var(--ease-out)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      }}
      onMouseEnter={e => { if (!disabled) { const t = e.currentTarget as HTMLElement; t.style.background = 'var(--primary-hover)'; t.style.boxShadow = 'var(--shadow-hover)'; } }}
      onMouseLeave={e => { const t = e.currentTarget as HTMLElement; if (!disabled) { t.style.background = 'var(--primary)'; t.style.boxShadow = 'var(--elev-sm)'; } t.style.transform = 'scale(1)'; }}
      onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
      {children}
    </button>
  );
}

// ─── SCREEN 1 — Welcome ───────────────────────────────────────────────────────
function WelcomeScreen({ onNavigate, onProfileSelect }: {
  onNavigate: (p: AppPage) => void;
  onProfileSelect: (p: ProfilType) => void;
}) {
  const [hovered, setHovered] = useState<ProfilType | null>(null);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      backgroundImage: `url(${bgWelcome})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#f0ede8',
    }}>
      {/* Topbar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px',
      }}>
          <img src={cpiLogo} alt="CPI — Compagnie Prestige Immobilier" style={{ height: '64px', width: '64px', objectFit: 'cover', borderRadius: '50%', clipPath: 'circle(50%)', display: 'block' }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: '99px',
          padding: '6px 14px 6px 10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            width: '26px', height: '26px',
            background: 'var(--secondary)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={13} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3 }}>Plateforme sécurisée</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', color: 'var(--muted-foreground)', lineHeight: 1.3 }}>Vos données sont protégées</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '8px 24px 36px', gap: '0',
      }}>
        {/* Heading */}
        <div className="cpi-animate-in" style={{ textAlign: 'center', marginBottom: '28px', maxWidth: '680px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.9)', border: '1px solid var(--border)',
            borderRadius: '99px', padding: '4px 12px', marginBottom: '14px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '0.04em' }}>
              Ouvert à tous les travailleurs sénégalais
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 3.6vw, 2.25rem)',
            fontWeight: 700, color: 'var(--foreground)',
            lineHeight: 1.22, marginBottom: '12px', letterSpacing: '-0.01em',
          }}>
            Votre projet immobilier,<br />peu importe votre secteur.
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.9375rem', color: 'var(--muted-foreground)', lineHeight: 1.6,
          }}>
            Sélectionnez votre profil pour un accompagnement personnalisé.
          </p>
        </div>

        {/* Profile cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px',
          width: '100%', maxWidth: '720px',
          marginBottom: '20px',
          animationDelay: '80ms',
        }} className="profile-grid cpi-animate-in">
          {PROFIL_OPTIONS.map(p => {
            const Icon = p.icon;
            const isHov = hovered === p.type;
            return (
              <div
                key={p.type}
                onClick={() => onProfileSelect(p.type)}
                onMouseEnter={() => setHovered(p.type)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: p.cardBg,
                  border: `1px solid ${p.borderColor}`,
                  borderRadius: '12px',
                  padding: '22px 20px 18px',
                  cursor: 'pointer',
                  boxShadow: isHov ? '0 12px 36px rgba(0,0,0,0.12)' : '0 2px 10px rgba(0,0,0,0.07)',
                  transform: isHov ? 'translateY(-4px)' : 'none',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  width: '42px', height: '42px',
                  background: p.bg, borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '14px',
                }}>
                  <Icon size={20} style={{ color: p.color }} />
                </div>

                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.9375rem', fontWeight: 700,
                  color: p.textColor, lineHeight: 1.3, marginBottom: '6px',
                }}>
                  {p.label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.75rem', color: p.subColor,
                  lineHeight: 1.5, marginBottom: '14px',
                }}>
                  {p.sub}
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
                  color: 'var(--primary)',
                }}>
                  Commencer <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Already have account */}
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
            Déjà inscrit ?{' '}
          </span>
          <button type="button" onClick={() => onNavigate('login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', padding: 0 }}>
            Accéder à mon espace
          </button>
        </div>

        {/* Trust strip */}
        <div style={{
          display: 'flex',
          width: '100%', maxWidth: '920px',
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.95)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          animationDelay: '160ms',
        }} className="trust-strip cpi-animate-in">
          {([
            { icon: Zap,        label: 'Processus simple',         sub: 'Des étapes claires à chaque stade',       color: '#630210', bg: 'var(--secondary)' },
            { icon: Shield,     label: 'Données sécurisées',       sub: 'Chiffrement SSL — confidentialité totale', color: '#1E4D8C', bg: 'rgba(30,77,140,0.08)' },
            { icon: Headphones, label: 'Support dédié',            sub: "Une équipe disponible à chaque étape",    color: 'var(--success)', bg: 'rgba(26,107,68,0.08)' },
            { icon: Handshake,  label: 'Partenaires officiels',    sub: 'CPI · Banques partenaires',    color: 'var(--accent-text)', bg: 'rgba(200,146,26,0.10)' },
          ] as const).map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={b.label} style={{
                flex: 1,
                display: 'flex', alignItems: 'center', gap: '13px',
                padding: '18px 22px',
                borderLeft: i > 0 ? '1px solid rgba(99,2,16,0.07)' : 'none',
              }}>
                <div style={{
                  width: '40px', height: '40px', flexShrink: 0,
                  background: b.bg,
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} style={{ color: b.color }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3, marginBottom: '3px', whiteSpace: 'nowrap' }}>{b.label}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.725rem', color: 'var(--muted-foreground)', lineHeight: 1.45, whiteSpace: 'nowrap' }}>{b.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accès professionnel CPI */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button type="button" onClick={() => onNavigate('login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', textDecoration: 'underline' }}>
            Espace professionnel CPI (Agent / Administrateur) →
          </button>
        </div>

        <a href="https://cpi.sn" target="_blank" rel="noopener noreferrer"
          style={{ marginTop: '12px', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted-foreground)'; }}>
          ← Retour sur cpi.sn
        </a>
      </main>

      <footer className="welcome-footer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '0 24px 18px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', textAlign: 'center' }}>
        <span>© 2026 CPI SARL · Tous droits réservés</span>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => onNavigate('terms')} style={{ padding: 0, border: 0, background: 'none', color: 'inherit', font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Conditions générales d’utilisation</button>
      </footer>

      <style>{`
        @media (max-width: 600px) {
          .profile-grid { grid-template-columns: 1fr !important; }
          .trust-strip { flex-direction: column !important; border-radius: 12px !important; }
          .trust-strip > div { border-left: none !important; border-top: 1px solid rgba(99,2,16,0.07) !important; padding: 14px 16px !important; }
          .trust-strip > div:first-child { border-top: none !important; }
        }
        @media (min-width: 601px) and (max-width: 860px) {
          .profile-grid { grid-template-columns: repeat(2,1fr) !important; }
          .trust-strip > div { padding: 16px 12px !important; gap: 10px !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Bouton Google ────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// ─── SCREEN 2 — Login ─────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onNavigate }: { onLogin: (p: AuthPayload) => void; onNavigate: (p: AppPage) => void }) {
  const [mode, setMode] = useState<'client' | 'pro'>('client');
  const [error, setError] = useState('');

  /**
   * Un formulaire par espace : les deux sont montés en même temps (l'onglet ne
   * fait que masquer l'autre), et partager un état les ferait se contaminer.
   * `schemaConnexion` n'impose AUCUNE règle de robustesse sur le mot de passe —
   * un compte créé avant le durcissement de la politique doit pouvoir se
   * connecter, précisément pour aller le changer.
   */
  const clientForm = useForm<Connexion>({
    resolver: zodResolver(schemaConnexion),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const proForm = useForm<Connexion>({
    resolver: zodResolver(schemaConnexion),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const actif = mode === 'client' ? clientForm : proForm;
  const loading = actif.formState.isSubmitting;

  // Connexion unifiée : l'API renvoie le rôle (client / agent-cpi / super-admin)
  // et les permissions résolues ; l'app redirige en conséquence.
  const doLogin = async (mail: string, password: string, fallback: string) => {
    setError('');
    try {
      const payload = await auth.login({ email: mail.trim(), password });
      if (payload.token) setToken(payload.token);
      onLogin(payload);
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    }
  };

  const handleClientSubmit = clientForm.handleSubmit(v =>
    doLogin(v.email, v.password, 'Identifiants incorrects.'));

  const handleProSubmit = proForm.handleSubmit(v =>
    doLogin(v.email, v.password, 'Identifiants professionnels incorrects.'));

  const handleGoogle = async () => {
    setError('');
    try {
      const url = await auth.googleRedirect();
      window.location.href = url;
    } catch (err) {
      setError(apiErrorMessage(err, "La connexion Google n'est pas disponible pour le moment."));
    }
  };

  const PHOTO = 'https://images.unsplash.com/photo-1721978536434-3cd55a457672?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200';

  const TabBtn = ({ value, children }: { value: 'client' | 'pro'; children: React.ReactNode }) => (
    <button type="button" onClick={() => { setMode(value); setError(''); }}
      style={{
        flex: 1, padding: '9px 12px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700,
        background: mode === value ? 'var(--primary)' : 'transparent',
        color: mode === value ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
        transition: 'background 0.15s, color 0.15s',
      }}>
      {children}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(360px, 0.9fr) minmax(560px, 1.1fr)' }} className="auth-split">
      {/* Left — photo */}
      <div className="auth-visual" style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '48px 40px',
        // Dégradé de repli sous la photo : si Unsplash ne répond pas, le
        // panneau reste sombre et le texte blanc lisible (voir lib/images.ts).
        backgroundImage: fondPhoto(PHOTO),
        backgroundSize: 'cover', backgroundPosition: 'center top', minHeight: '100vh',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(28,8,16,0.25) 0%, rgba(28,8,16,0.82) 60%, rgba(28,8,16,0.97) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src={cpiLogo} alt="CPI — Compagnie Prestige Immobilier" style={{ height: '72px', width: '72px', objectFit: 'cover', borderRadius: '50%', clipPath: 'circle(50%)', marginBottom: '28px', display: 'block' }} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: '14px' }}>
            Réalisez votre projet<br />immobilier en toute<br />sérénité.
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: '28px', maxWidth: '360px' }}>
            Enseignants, fonctionnaires, salariés du privé — CPI vous accompagne à chaque étape de votre projet immobilier, de la demande jusqu'à la remise des clés.
          </p>
          <button type="button" onClick={() => onNavigate('register')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 22px', background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700, color: 'white', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.35)'; }}>
            Déposer ma demande <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Right — form */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px', background: 'var(--card)' }} className="auth-form-panel">
        <button type="button" onClick={() => onNavigate('welcome')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '32px', padding: 0 }}>
          <ArrowLeft size={16} /> Retour
        </button>

        <div style={{ maxWidth: '360px', width: '100%' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '6px' }}>Connexion</h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'var(--muted-foreground)', marginBottom: '20px' }}>
            {mode === 'client' ? 'Accédez à votre espace personnel.' : 'Espace réservé au personnel CPI.'}
          </p>

          {/* Sélecteur d'espace */}
          <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--input-background)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '22px' }}>
            <TabBtn value="client">Espace client</TabBtn>
            <TabBtn value="pro">Espace professionnel</TabBtn>
          </div>

          {error && (
            <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--destructive)' }}>
              {error}
            </div>
          )}

          {mode === 'client' ? (
            <form onSubmit={handleClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="E-mail" type="email" placeholder="bonjour@email.com" required autoComplete="email"
                value={clientForm.watch('email')} onChange={v => clientForm.setValue('email', v, { shouldValidate: clientForm.formState.submitCount > 0 })}
                error={clientForm.formState.errors.email?.message} icon={<Mail size={15} />} />
              <Field label="Mot de passe" type="password" placeholder="••••••••" required autoComplete="current-password"
                value={clientForm.watch('password')} onChange={v => clientForm.setValue('password', v, { shouldValidate: clientForm.formState.submitCount > 0 })}
                error={clientForm.formState.errors.password?.message} icon={<Lock size={15} />} />
              <div style={{ marginTop: '4px' }}>
                <PrimaryBtn type="submit" disabled={loading}>
                  {loading
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                        Connexion…
                      </span>
                    : 'CONNECTER'}
                </PrimaryBtn>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>ou</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <button type="button" onClick={handleGoogle}
                style={{
                  width: '100%', padding: '12px 24px', background: 'var(--card)',
                  border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--muted-foreground)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
                <GoogleIcon /> Continuer avec Google
              </button>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '4px', textAlign: 'center' }}>
                Pas de compte ?{' '}
                <button type="button" onClick={() => onNavigate('register')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', padding: 0 }}>
                  Créer mon compte
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleProSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="Identifiant professionnel" type="email" placeholder="agent@cpi.sn" required autoComplete="email"
                value={proForm.watch('email')} onChange={v => proForm.setValue('email', v, { shouldValidate: proForm.formState.submitCount > 0 })}
                error={proForm.formState.errors.email?.message} icon={<Mail size={15} />} />
              <Field label="Mot de passe" type="password" placeholder="••••••••" required autoComplete="current-password"
                value={proForm.watch('password')} onChange={v => proForm.setValue('password', v, { shouldValidate: proForm.formState.submitCount > 0 })}
                error={proForm.formState.errors.password?.message} icon={<Lock size={15} />} />
              <div style={{ marginTop: '4px' }}>
                <PrimaryBtn type="submit" disabled={loading}>
                  {loading
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                        Connexion…
                      </span>
                    : 'ACCÉDER À MON ESPACE'}
                </PrimaryBtn>
              </div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '4px', textAlign: 'center', lineHeight: 1.5 }}>
                <Lock size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Accès Agent CPI et Administrateur. Contactez CPI pour vos identifiants.
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .auth-split { grid-template-columns: 1fr !important; }
          .auth-split > :first-child { min-height: 260px !important; }
          .auth-form-panel { padding: 32px 24px !important; }
        }
      `}</style>
    </div>
  );
}

// ─── SCREEN 3 — Register (2 steps) ───────────────────────────────────────────
function RegisterScreen({ onLogin, onNavigate, initialProfile }: {
  onLogin: (p: AuthPayload) => void;
  onNavigate: (p: AppPage) => void;
  initialProfile: ProfilType | null;
}) {
  const [step, setStep] = useState<1 | 2>(initialProfile ? 2 : 1);
  const [profil, setProfil] = useState<ProfilType | null>(initialProfile);
  const [hovered, setHovered] = useState<ProfilType | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState('');

  /**
   * Validation par `schemaInscription`, miroir des règles de
   * `Api/Auth/AuthController::register` et de la politique de mot de passe.
   *
   * Elle était auparavant réécrite à la main en booléens (`pwdOk =
   * form.pwd.length >= 8`) : le formulaire se déclarait valide avec 8
   * caractères, l'API en exige 10 avec lettres et chiffres, et l'utilisateur
   * recevait un 422 sans savoir quelle règle il violait.
   */
  const {
    watch, setValue, handleSubmit: rhfSubmit, formState: { errors, isSubmitting, submitCount },
  } = useForm<Inscription>({
    resolver: zodResolver(schemaInscription),
    // `onTouched` : on ne reproche rien avant que l'utilisateur ait quitté le
    // champ, puis on corrige en direct. Valider à chaque frappe affiche
    // « trop court » dès la première lettre.
    mode: 'onTouched',
    defaultValues: { nom: '', email: '', tel: '', employeur: '', revenus: '', pwd: '', pwd2: '', accepted: false as unknown as true },
  });

  const form = watch();
  const accepted = form.accepted === true;
  const attempted = submitCount > 0;
  const loading = isSubmitting;
  const set = (k: keyof Inscription) => (v: string) =>
    setValue(k, v as Inscription[typeof k], { shouldValidate: attempted, shouldDirty: true });
  const setAccepted = (v: boolean) =>
    setValue('accepted', v as unknown as true, { shouldValidate: attempted, shouldDirty: true });

  const profilInfo = PROFIL_OPTIONS.find(p => p.type === profil);

  // Coche verte « ce champ est bon » : dérivée du schéma, plus d'un doublon
  // de règles écrit à côté.
  const champOk = (k: keyof Inscription) => {
    const v = form[k];
    if (v === undefined || v === '') return false;
    return !errors[k];
  };

  const handleSubmit = rhfSubmit(async form => {
    if (!profil) return;
    setError('');
    try {
      // Crée le compte côté API : rôle client + fiche dossier générée côté serveur.
      const payload = await auth.register({
        name: form.nom.trim(),
        email: form.email.trim(),
        password: form.pwd,
        phone: `+221 ${form.tel.trim()}`,
      });
      if (payload.token) setToken(payload.token);
      try {
        // Complète immédiatement le profil avec les informations déjà saisies.
        const user = await auth.completeOnboarding({
          phone: `+221 ${form.tel.trim()}`,
          employer: form.employeur.trim(),
          profile_type: profil,
          revenus: form.revenus,
        });
        onLogin({ ...payload, user });
      } catch {
        onLogin(payload); // le profil pourra être complété plus tard
      }
    } catch (err) {
      setError(apiFieldError(err, 'email')
        ? 'Cette adresse e-mail est déjà utilisée.'
        : apiErrorMessage(err, 'Impossible de créer votre compte. Réessayez.'));
    }
  });

  const REVENUS_OPTIONS = [
    { value: '150000-250000', label: '150 000 – 250 000 FCFA / mois' },
    { value: '250000-400000', label: '250 000 – 400 000 FCFA / mois' },
    { value: '400000-600000', label: '400 000 – 600 000 FCFA / mois' },
    { value: '600000-900000', label: '600 000 – 900 000 FCFA / mois' },
    { value: '900000+',       label: 'Plus de 900 000 FCFA / mois' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(360px, 0.9fr) minmax(560px, 1.1fr)' }} className="auth-split">
      {/* Left panel — dark */}
      <div className="auth-visual" style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '48px 40px',
        background: 'var(--sidebar)', minHeight: '100vh', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '320px', height: '320px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: '36px' }}>
            <img
              src={cpiLogo}
              alt="CPI"
              style={{ height: '72px', width: '72px', objectFit: 'cover', borderRadius: '50%', clipPath: 'circle(50%)', display: 'block' }}
            />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.375rem, 3vw, 2rem)', fontWeight: 800, color: 'white', lineHeight: 1.25, marginBottom: '16px' }}>
            Accédez au financement<br />qui vous correspond.
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, maxWidth: '320px', marginBottom: '32px' }}>
            Que vous soyez enseignant, fonctionnaire ou employé du secteur privé, CPI vous accompagne dans la réalisation de votre projet immobilier.
          </p>

          {/* Steps indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { n: 1, label: 'Choisissez votre profil' },
              { n: 2, label: "Complétez votre inscription" },
              { n: 3, label: 'Suivez votre dossier en ligne' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: s.n < step ? 1 : s.n === step ? 1 : 0.4 }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.n < step ? 'var(--success)' : s.n === step ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                  border: s.n === step ? '2px solid rgba(255,255,255,0.2)' : 'none',
                }}>
                  {s.n < step
                    ? <CheckCircle size={14} style={{ color: 'white' }} />
                    : <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'white' }}>{s.n}</span>
                  }
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: s.n === step ? 700 : 400, color: s.n === step ? 'white' : 'rgba(255,255,255,0.55)' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>
              Banques partenaires agréées de CPI
            </span>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px', background: 'var(--card)', overflowY: 'auto' }} className="auth-form-panel register-form-panel">
        <div className="auth-mobile-header">
          <img src={cpiLogo} alt="CPI" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: '50%', clipPath: 'circle(50%)' }} />
          <div><strong>Créer votre compte</strong><span>Étape {step} sur 3</span></div>
        </div>

        {step === 1 ? (
          /* ── Step 1: Profile selection ── */
          <div>
            <button type="button" onClick={() => onNavigate('welcome')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '28px', padding: 0 }}>
              <ArrowLeft size={16} /> Retour
            </button>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '6px' }}>
              Quel est votre profil ?
            </h2>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '24px' }}>
              Sélectionnez votre situation professionnelle pour un accompagnement adapté.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {PROFIL_OPTIONS.map(p => {
                const Icon = p.icon;
                const isHov = hovered === p.type;
                return (
                  <div
                    key={p.type}
                    onClick={() => { setProfil(p.type); setStep(2); }}
                    onMouseEnter={() => setHovered(p.type)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      background: p.cardBg,
                      border: `1.5px solid ${isHov ? p.color : p.borderColor}`,
                      borderRadius: '10px',
                      padding: '16px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isHov ? '0 6px 20px rgba(0,0,0,0.10)' : 'none',
                    }}
                  >
                    <div style={{
                      width: '36px', height: '36px',
                      background: p.bg, borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '10px',
                    }}>
                      <Icon size={17} style={{ color: p.color }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: p.textColor, lineHeight: 1.3, marginBottom: '4px' }}>
                      {p.label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: p.subColor, lineHeight: 1.4 }}>
                      {p.sub}
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', textAlign: 'center' }}>
              Déjà inscrit ?{' '}
              <button type="button" onClick={() => onNavigate('login')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', padding: 0 }}>
                Connexion
              </button>
            </p>
          </div>

        ) : (
          /* ── Step 2: Form ── */
          <div>
            <button type="button" onClick={() => setStep(1)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '20px', padding: 0 }}>
              <ArrowLeft size={16} /> Retour
            </button>

            {/* Profile badge */}
            {profilInfo && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '5px 12px 5px 8px',
                background: 'var(--input-background)',
                border: `1px solid ${profilInfo.borderColor}`,
                borderRadius: '99px', marginBottom: '18px',
              }}>
                <div style={{
                  width: '22px', height: '22px',
                  background: profilInfo.bg,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {(() => { const Icon = profilInfo.icon; return <Icon size={11} style={{ color: profilInfo.color }} />; })()}
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {profilInfo.label}
                </span>
              </div>
            )}

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '4px' }}>
              Créez votre compte
            </h2>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '20px' }}>
              Quelques informations pour constituer votre dossier.
            </p>

            {error && (
              <div style={{ maxWidth: '400px', marginBottom: '14px', padding: '10px 12px', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--destructive)' }}>
                {error}
              </div>
            )}

            <div style={{ maxWidth: '560px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Field label="Nom complet *" placeholder="Prénom Nom" value={form.nom} onChange={set('nom')} required autoComplete="name"
                  icon={<UserCircle size={15} />} valid={champOk('nom')} error={errors.nom?.message} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="E-mail *" type="email" placeholder="vous@email.com" value={form.email} onChange={set('email')} required autoComplete="email"
                    icon={<Mail size={15} />} valid={champOk('email')} error={errors.email?.message} />
                  <PhoneField value={form.tel} onChange={set('tel')}
                    valid={champOk('tel')} error={errors.tel?.message} />
                </div>

                <Field
                  label={profil === 'fonctionnaire' ? 'Ministère / Structure *' : "Employeur / Entreprise *"}
                  placeholder={profil === 'fonctionnaire' ? "Ex: Ministère de l'Éducation" : "Ex: Sonatel, Orange SN..."}
                  value={form.employeur}
                  onChange={set('employeur')}
                  icon={<Building2 size={15} />} valid={champOk('employeur')} required autoComplete="organization"
                  error={errors.employeur?.message}
                />

                <SelectField
                  label="Revenus nets mensuels *"
                  value={form.revenus}
                  onChange={set('revenus')}
                  options={REVENUS_OPTIONS}
                  placeholder="Sélectionnez une tranche"
                  valid={champOk('revenus')}
                  error={errors.revenus?.message}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Mot de passe *" type="password" placeholder={`Min. ${MOT_DE_PASSE_LONGUEUR_MIN} caractères`} value={form.pwd} onChange={set('pwd')}
                    required autoComplete="new-password"
                    icon={<Lock size={15} />} valid={champOk('pwd')}
                    error={errors.pwd?.message} />
                  <Field label="Confirmer *" type="password" placeholder="Répétez" value={form.pwd2} onChange={set('pwd2')}
                    required autoComplete="new-password"
                    icon={<Lock size={15} />} valid={champOk('pwd2') && form.pwd2 === form.pwd}
                    error={errors.pwd2?.message} />
                </div>

                {/* Ce que le serveur exige, dit AVANT l'envoi. Le formulaire
                    annonçait « 8 caractères minimum » ; l'API en refusait
                    l'enregistrement sans jamais expliquer pourquoi. */}
                <ul aria-label="Exigences du mot de passe" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', listStyle: 'none', margin: 0, padding: 0 }}>
                  {REGLES_MOT_DE_PASSE.map(regle => {
                    const ok = regle.verifie(form.pwd ?? '');
                    return (
                      <li key={regle.libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: ok ? 'var(--success)' : 'var(--muted-foreground)' }}>
                        <Check size={11} aria-hidden="true" style={{ flexShrink: 0, opacity: ok ? 1 : 0.35 }} />
                        <span>{regle.libelle}</span>
                        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{ok ? '— satisfait' : '— non satisfait'}</span>
                      </li>
                    );
                  })}
                </ul>

                {/* Champ OBLIGATOIRE de l'inscription. Il était rendu en
                    `<div onClick>` : ni focusable, ni actionnable au clavier,
                    sans rôle ARIA. Un utilisateur au clavier ou au lecteur
                    d'écran ne pouvait tout simplement pas créer de compte.
                    Radix fournit le rôle, l'état et la gestion Espace/Entrée. */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <Checkbox.Root
                      id="cgu"
                      checked={accepted}
                      onCheckedChange={valeur => setAccepted(valeur === true)}
                      aria-invalid={Boolean(errors.accepted)}
                      aria-describedby={errors.accepted ? 'cgu-erreur' : undefined}
                      style={{
                        marginTop: '2px', flexShrink: 0, width: 18, height: 18, padding: 0,
                        border: 0, background: 'none', cursor: 'pointer', lineHeight: 0,
                      }}
                    >
                      {accepted
                        ? <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                        : <Square size={18} style={{ color: errors.accepted ? 'var(--destructive)' : 'var(--border)' }} />
                      }
                    </Checkbox.Root>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                      {"J'accepte les "}
                      <button type="button" onClick={() => setShowTerms(true)} style={{ padding: 0, border: 0, background: 'none', color: 'var(--primary)', font: 'inherit', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                        conditions générales d’utilisation (CGU)
                      </button>
                    </span>
                  </div>
                  {errors.accepted?.message && (
                    <div style={{ marginTop: 6, marginLeft: 28 }}><FieldHelp id="cgu-erreur" error={errors.accepted.message} /></div>
                  )}
                </div>

                <div style={{ marginTop: '4px' }}>
                  <PrimaryBtn type="submit" disabled={loading}>
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                          Création en cours…
                        </span>
                      : 'CRÉER MON COMPTE'}
                  </PrimaryBtn>
                </div>
              </form>

              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '16px', textAlign: 'center' }}>
                Déjà un compte ?{' '}
                <button type="button" onClick={() => onNavigate('login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', padding: 0 }}>
                  CONNEXION
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
      {showTerms && <ConditionsModal onClose={() => setShowTerms(false)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .auth-split { grid-template-columns: 1fr !important; }
          .auth-visual { display: none !important; }
          .auth-form-panel { min-height: 100vh !important; padding: 20px 16px 32px !important; justify-content: flex-start !important; align-items: stretch !important; }
          .auth-form-panel > div { width: 100% !important; max-width: none !important; }
          .auth-form-panel form > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .auth-mobile-header { display: flex !important; align-items: center; gap: 12px; margin-bottom: 24px; }
          .auth-mobile-header strong, .auth-mobile-header span { display: block; font-family: var(--font-sans); }
          .auth-mobile-header strong { color: var(--foreground); font-size: .9rem; }
          .auth-mobile-header span { color: var(--muted-foreground); font-size: .75rem; margin-top: 3px; }
          .register-form-panel form { gap: 16px !important; }
        }
        .auth-mobile-header { display: none; }
      `}</style>
    </div>
  );
}

// ─── Root router ──────────────────────────────────────────────────────────────
export default function AuthPage({ page, onLogin, onNavigate }: Props) {
  const [regProfile, setRegProfile] = useState<ProfilType | null>(null);

  const handleProfileSelect = (p: ProfilType) => {
    setRegProfile(p);
    onNavigate('register');
  };

  if (page === 'register') return <RegisterScreen onLogin={onLogin} onNavigate={onNavigate} initialProfile={regProfile} />;
  if (page === 'terms')    return <ConditionsPage onNavigate={onNavigate} />;
  if (page === 'login')    return <LoginScreen    onLogin={onLogin} onNavigate={onNavigate} />;
  return                          <WelcomeScreen  onNavigate={onNavigate} onProfileSelect={handleProfileSelect} />;
}
