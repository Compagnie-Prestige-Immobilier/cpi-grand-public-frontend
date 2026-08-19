import { useState, useId } from 'react';
import { Landmark, Briefcase, UserCircle, Lock, Check, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { auth, type UserData, type OnboardingInput } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { schemaOnboarding, erreursDe } from '../lib/schemas';

type ProfilType = 'fonctionnaire' | 'prive' | 'autre';

const PROFIL_OPTIONS: { type: ProfilType; label: string; icon: LucideIcon }[] = [
  { type: 'fonctionnaire', label: 'Fonctionnaire', icon: Landmark },
  { type: 'prive', label: 'Secteur privé', icon: Briefcase },
  { type: 'autre', label: 'Secteur informel', icon: UserCircle },
];

const REVENUS_OPTIONS = [
  { value: '150000-250000', label: '150 000 – 250 000 FCFA / mois' },
  { value: '250000-400000', label: '250 000 – 400 000 FCFA / mois' },
  { value: '400000-600000', label: '400 000 – 600 000 FCFA / mois' },
  { value: '600000-900000', label: '600 000 – 900 000 FCFA / mois' },
  { value: '900000+',       label: 'Plus de 900 000 FCFA / mois' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px',
  border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)',
  background: 'var(--input-background)', fontFamily: 'var(--font-sans)',
  fontSize: '0.9375rem', color: 'var(--foreground)', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)',
};

const normalizeSenegalPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^221/, '').slice(0, 9);
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
};

function PhoneField({ id, value, onChange, erreur }: { id: string; value: string; onChange: (v: string) => void; erreur?: string }) {
  const valid = value.replace(/\D/g, '').length === 9;
  const invalid = Boolean(erreur);
  return <div style={{ position: 'relative' }}>
    <div style={{ display: 'flex', alignItems: 'stretch', border: `1.5px solid ${invalid ? 'var(--destructive)' : valid ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', background: 'var(--input-background)', overflow: 'hidden', boxShadow: invalid ? '0 0 0 3px rgba(192,57,43,0.12)' : 'none' }}>
      <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: 'var(--muted-foreground)', borderRight: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem' }}>+221</span>
      <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="77 000 00 00" value={value} onChange={e => onChange(normalizeSenegalPhone(e.target.value))} aria-invalid={invalid || undefined} aria-describedby={`${id}-aide`} style={{ ...inputStyle, border: 0, borderRadius: 0, background: 'transparent' }} />
      {valid && <Check size={15} aria-hidden="true" style={{ alignSelf: 'center', marginRight: 12, color: 'var(--success)' }} />}
    </div>
    <span id={`${id}-aide`} role={invalid ? 'alert' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: invalid ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
      {invalid && <AlertCircle size={11} aria-hidden="true" />} {erreur ?? 'Format sénégalais : 9 chiffres'}
    </span>
  </div>;
}

/**
 * Formulaire de complétion de profil : affiché après une première connexion
 * Google (needs_onboarding=true), avant l'accès au tableau de bord.
 */
export default function OnboardingPage({ userName, onComplete, onLogout }: {
  userName: string;
  onComplete: (user: UserData) => void;
  onLogout: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [employer, setEmployer] = useState('');
  const [profil, setProfil] = useState<ProfilType | null>(null);
  const [revenus, setRevenus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tente, setTente] = useState(false);

  const idPhone = useId();
  const idEmployer = useId();
  const idRevenus = useId();
  const idProfil = useId();

  /**
   * Validation par `schemaOnboarding`, calqué sur
   * `Api/Auth/AuthController::completeOnboarding` (`phone`, `employer`,
   * `profile_type` et `revenus` tous `required`).
   *
   * Le formulaire se contentait auparavant d'un « Veuillez remplir tous les
   * champs » global : l'utilisateur devait deviner lequel manquait.
   */
  const erreurs = tente
    ? erreursDe(schemaOnboarding, { phone, employer, profile_type: profil ?? undefined, revenus })
    : {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTente(true);
    const problemes = erreursDe(schemaOnboarding, { phone, employer, profile_type: profil ?? undefined, revenus });
    if (Object.keys(problemes).length > 0 || !profil) return;
    setError('');
    setLoading(true);
    try {
      const input: OnboardingInput = { phone: `+221 ${phone}`, employer, profile_type: profil, revenus };
      const user = await auth.completeOnboarding(input);
      onComplete(user);
    } catch (err) {
      setError(apiErrorMessage(err, 'Impossible de compléter votre profil. Réessayez.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cpi-onboarding" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '32px 28px', boxShadow: 'var(--elev-sm)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>
          Bienvenue, {userName}
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: 20, lineHeight: 1.5 }}>
          Encore quelques informations pour constituer votre dossier avant d'accéder à votre espace.
        </p>

        {error && (
          <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--destructive)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span id={idProfil} style={labelStyle}>Votre profil *</span>
            <div role="radiogroup" aria-labelledby={idProfil} aria-invalid={Boolean(erreurs.profile_type) || undefined} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PROFIL_OPTIONS.map(p => {
                const Icon = p.icon;
                const active = profil === p.type;
                return (
                  <button key={p.type} type="button" role="radio" aria-checked={active} onClick={() => setProfil(p.type)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '12px 6px', cursor: 'pointer', borderRadius: 'var(--r-sm)',
                      border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      background: active ? 'rgba(99,2,16,0.06)' : 'var(--input-background)',
                      fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600,
                      color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                    }}>
                    <Icon size={16} />
                    {p.label}
                  </button>
                );
              })}
            </div>
            {erreurs.profile_type && (
              <span role="alert" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--destructive)' }}>{erreurs.profile_type}</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label htmlFor={idPhone} style={labelStyle}>Téléphone *</label>
            <PhoneField id={idPhone} value={phone} onChange={setPhone} erreur={erreurs.phone} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label htmlFor={idEmployer} style={labelStyle}>{profil === 'fonctionnaire' ? 'Ministère / Structure *' : 'Employeur / Entreprise *'}</label>
            <input id={idEmployer} autoComplete="organization" required aria-invalid={Boolean(erreurs.employer) || undefined} aria-describedby={erreurs.employer ? `${idEmployer}-err` : undefined} placeholder={profil === 'fonctionnaire' ? "Ex: Ministère de l'Éducation" : 'Ex: Sonatel, Orange SN…'} value={employer} onChange={e => setEmployer(e.target.value)} style={inputStyle} />
            {erreurs.employer && (
              <span id={`${idEmployer}-err`} role="alert" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--destructive)' }}>{erreurs.employer}</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label htmlFor={idRevenus} style={labelStyle}>Revenus nets mensuels *</label>
            <select id={idRevenus} required aria-invalid={Boolean(erreurs.revenus) || undefined} aria-describedby={erreurs.revenus ? `${idRevenus}-err` : undefined} value={revenus} onChange={e => setRevenus(e.target.value)} style={{ ...inputStyle, color: revenus ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              <option value="" disabled>Sélectionnez une tranche</option>
              {REVENUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {erreurs.revenus && (
              <span id={`${idRevenus}-err`} role="alert" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--destructive)' }}>{erreurs.revenus}</span>
            )}
          </div>

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px 24px', marginTop: 4,
              background: loading ? 'var(--muted)' : 'var(--primary)',
              color: loading ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
              border: 'none', borderRadius: 'var(--r-sm)', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '0.03em',
            }}>
            {loading ? 'Enregistrement…' : 'ACCÉDER À MON ESPACE'}
          </button>
        </form>

        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 16, textAlign: 'center' }}>
          <Lock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Vos informations restent confidentielles.{' '}
          <button type="button" onClick={onLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', padding: 0 }}>
            Se déconnecter
          </button>
        </p>
      </div>
    </div>
  );
}
