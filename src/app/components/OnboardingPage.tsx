import { useState } from 'react';
import { Landmark, Briefcase, UserCircle, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { auth, type UserData, type OnboardingInput } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';

type ProfilType = 'fonctionnaire' | 'prive' | 'autre';

const PROFIL_OPTIONS: { type: ProfilType; label: string; icon: LucideIcon }[] = [
  { type: 'fonctionnaire', label: 'Fonctionnaire', icon: Landmark },
  { type: 'prive', label: 'Secteur privé', icon: Briefcase },
  { type: 'autre', label: 'Autre profil', icon: UserCircle },
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

  const formValid = phone.replace(/\D/g, '').length >= 7 && employer.trim().length >= 2 && profil !== null && revenus !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid || !profil) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const input: OnboardingInput = { phone, employer, profile_type: profil, revenus };
      const user = await auth.completeOnboarding(input);
      onComplete(user);
    } catch (err) {
      setError(apiErrorMessage(err, 'Impossible de compléter votre profil. Réessayez.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '32px 28px', boxShadow: 'var(--elev-sm)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>
          Bienvenue, {userName}
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: 20, lineHeight: 1.5 }}>
          Encore quelques informations pour constituer votre dossier avant d'accéder à votre espace.
        </p>

        {error && (
          <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: '#C0392B' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={labelStyle}>Votre profil *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PROFIL_OPTIONS.map(p => {
                const Icon = p.icon;
                const active = profil === p.type;
                return (
                  <button key={p.type} type="button" onClick={() => setProfil(p.type)}
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
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={labelStyle}>Téléphone *</label>
            <input type="tel" placeholder="+221 7X XXX XX XX" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={labelStyle}>{profil === 'fonctionnaire' ? 'Ministère / Structure *' : 'Employeur / Entreprise *'}</label>
            <input placeholder={profil === 'fonctionnaire' ? "Ex: Ministère de l'Éducation" : 'Ex: Sonatel, Orange SN…'} value={employer} onChange={e => setEmployer(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={labelStyle}>Revenus nets mensuels *</label>
            <select value={revenus} onChange={e => setRevenus(e.target.value)} style={{ ...inputStyle, color: revenus ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              <option value="" disabled>Sélectionnez une tranche</option>
              {REVENUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
