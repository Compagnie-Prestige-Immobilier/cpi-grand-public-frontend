import { useState } from 'react';
import {
  Clock, CheckCircle2, ShieldCheck, Users, FolderOpen,
  Mail, AlertCircle, LogOut, RefreshCw, Send,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { auth, type AuthPayload, type StatutCompte } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import cpiLogo from '../../assets/image.png';

/**
 * Écran affiché à la place du tableau de bord tant qu'un compte client n'est
 * pas validé — reste délibérément « sur la page de connexion » plutôt que
 * d'entrer dans l'espace applicatif : entrer dans `AppShell` déclencherait des
 * appels vers des routes que `compte.valide` referme (403 en boucle), pour un
 * compte qui n'a de toute façon rien à y faire.
 *
 * Trois états distincts, jamais mélangés :
 *   - e-mail pas encore vérifié → l'action attendue est de cliquer le lien reçu ;
 *   - en file d'attente → rien à faire, un administrateur doit agir ;
 *   - refusé → la personne corrige et resoumet elle-même.
 */

interface Props {
  email: string;
  statutCompte: StatutCompte;
  motifRejet: string | null;
  /** Distingue « je viens de m'inscrire » de « je me reconnecte » — seule la phrase d'accroche change. */
  contexte: 'inscription' | 'connexion';
  onLogout: () => void;
  /** Reçoit la réponse d'authentification à jour (après correction, ou après actualisation). */
  onEtatMisAJour: (payload: AuthPayload) => void;
}

const CARD_STYLE: React.CSSProperties = {
  width: '100%', maxWidth: 560,
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.08)', padding: '36px 40px',
};

function Etape({ icon: Icon, label, fait, actif }: { icon: LucideIcon; label: string; fait: boolean; actif: boolean }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: fait ? 'var(--success)' : actif ? 'var(--primary)' : 'var(--muted)',
        color: fait || actif ? '#fff' : 'var(--muted-foreground)',
      }}>
        {fait ? <CheckCircle2 size={16} /> : <Icon size={14} />}
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.9375rem',
        fontWeight: actif ? 700 : 500,
        color: fait ? 'var(--foreground)' : actif ? 'var(--foreground)' : 'var(--muted-foreground)',
      }}>
        {label}
      </span>
    </li>
  );
}

export default function CompteEnAttentePage({ email, statutCompte, motifRejet, contexte, onLogout, onEtatMisAJour }: Props) {
  const [envoi, setEnvoi] = useState<'idle' | 'loading' | 'done'>('idle');
  const [erreur, setErreur] = useState('');
  const [actualisation, setActualisation] = useState(false);

  const actualiser = async () => {
    setActualisation(true);
    setErreur('');
    try {
      onEtatMisAJour(await auth.me());
    } catch (err) {
      setErreur(apiErrorMessage(err, "Impossible d'actualiser votre statut pour le moment."));
    } finally {
      setActualisation(false);
    }
  };

  const renvoyerEmail = async () => {
    setEnvoi('loading');
    setErreur('');
    try {
      await auth.resendVerificationEmail();
      setEnvoi('done');
    } catch (err) {
      setErreur(apiErrorMessage(err, "L'envoi a échoué. Réessayez dans quelques minutes."));
      setEnvoi('idle');
    }
  };

  const shell = (contenu: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
      background: 'var(--background)',
    }}>
      <img src={cpiLogo} alt="CPI — Compagnie Prestige Immobilier"
        style={{ height: 64, width: 64, objectFit: 'cover', borderRadius: '50%', marginBottom: 24 }} />
      <div style={CARD_STYLE} className="cpi-animate-in">{contenu}</div>
      <button type="button" onClick={onLogout} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 20,
        background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted-foreground)',
      }}>
        <LogOut size={14} /> Se déconnecter
      </button>
    </div>
  );

  const banniereErreur = erreur && (
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '10px 14px',
      borderRadius: 'var(--radius)', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
      fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--destructive)', fontWeight: 600,
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      {erreur}
    </div>
  );

  // ── E-mail pas encore vérifié ──────────────────────────────────────────
  if (statutCompte === 'email-a-verifier') {
    return shell(<>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Mail size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
          Vérifiez votre adresse e-mail
        </h1>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'var(--muted-foreground)', lineHeight: 1.65, margin: '0 0 24px' }}>
        {contexte === 'inscription'
          ? <>Merci pour votre inscription (<strong style={{ color: 'var(--foreground)' }}>{email}</strong>). Un lien de vérification vient de vous être envoyé — cliquez dessus pour confirmer votre adresse.</>
          : <>Votre compte (<strong style={{ color: 'var(--foreground)' }}>{email}</strong>) est bien créé, mais votre adresse e-mail n'est pas encore vérifiée.</>}
        {' '}Un administrateur CPI validera ensuite votre compte avant de vous attribuer un conseiller.
      </p>

      <ol style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <Etape icon={CheckCircle2} label="Inscription enregistrée" fait actif={false} />
        <Etape icon={Mail} label="Vérification de votre adresse e-mail" fait={false} actif />
        <Etape icon={ShieldCheck} label="Validation du compte par l'administrateur" fait={false} actif={false} />
        <Etape icon={Users} label="Attribution d'un conseiller CPI" fait={false} actif={false} />
        <Etape icon={FolderOpen} label="Accès à votre espace et dépôt des pièces" fait={false} actif={false} />
      </ol>

      <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
        <button type="button" onClick={renvoyerEmail} disabled={envoi === 'loading'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: envoi === 'loading' ? 'wait' : 'pointer' }}>
          <Send size={15} /> {envoi === 'loading' ? 'Envoi…' : envoi === 'done' ? 'Lien renvoyé ✓' : "Renvoyer l'e-mail"}
        </button>
        <button type="button" onClick={actualiser} disabled={actualisation}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: actualisation ? 'wait' : 'pointer' }}>
          <RefreshCw size={15} style={actualisation ? { animation: 'spin 0.8s linear infinite' } : undefined} /> J'ai vérifié — actualiser
        </button>
      </div>
      {banniereErreur}
    </>);
  }

  // ── Refusé : correction + resoumission ─────────────────────────────────
  if (statutCompte === 'rejete') {
    return shell(<CorrectionRejete email={email} motif={motifRejet} onEtatMisAJour={onEtatMisAJour} banniereErreur={banniereErreur} setErreur={setErreur} />);
  }

  // ── En file d'attente d'un administrateur ──────────────────────────────
  return shell(<>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Clock size={20} style={{ color: 'var(--primary)' }} />
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
        Compte en attente de validation
      </h1>
    </div>
    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'var(--muted-foreground)', lineHeight: 1.65, margin: '0 0 24px' }}>
      {contexte === 'inscription'
        ? <>Merci pour votre inscription (<strong style={{ color: 'var(--foreground)' }}>{email}</strong>).</>
        : <>Bonjour, votre compte (<strong style={{ color: 'var(--foreground)' }}>{email}</strong>) est toujours en attente.</>}
      {' '}Votre compte doit d'abord être validé par un administrateur CPI, qui vous attribuera ensuite un conseiller.
      Vous pourrez accéder à votre espace et déposer vos pièces dès que votre compte sera validé.
    </p>

    <ol style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <Etape icon={CheckCircle2} label="Inscription enregistrée" fait actif={false} />
      <Etape icon={ShieldCheck} label="Validation du compte par l'administrateur" fait={false} actif />
      <Etape icon={Users} label="Attribution d'un conseiller CPI" fait={false} actif={false} />
      <Etape icon={FolderOpen} label="Accès à votre espace et dépôt des pièces" fait={false} actif={false} />
    </ol>

    <button type="button" onClick={actualiser} disabled={actualisation} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 22,
      padding: '11px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      background: 'transparent', color: 'var(--foreground)',
      fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: actualisation ? 'wait' : 'pointer',
    }}>
      <RefreshCw size={15} style={actualisation ? { animation: 'spin 0.8s linear infinite' } : undefined} />
      {actualisation ? 'Actualisation…' : 'Actualiser mon statut'}
    </button>
    {banniereErreur}
  </>);
}

// ── Compte refusé : formulaire de correction ──────────────────────────────

function CorrectionRejete({ email, motif, onEtatMisAJour, banniereErreur, setErreur }: {
  email: string;
  motif: string | null;
  onEtatMisAJour: (payload: AuthPayload) => void;
  banniereErreur: React.ReactNode;
  setErreur: (e: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [employer, setEmployer] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const resoumettre = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      const payload = await auth.updateMonCompte({
        phone: phone.trim() || undefined,
        employer: employer.trim() || undefined,
      });
      onEtatMisAJour(payload);
    } catch (err) {
      setErreur(apiErrorMessage(err, "La resoumission a échoué. Vérifiez vos informations et réessayez."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(192,57,43,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertCircle size={20} style={{ color: 'var(--destructive)' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
          Compte refusé
        </h1>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'var(--muted-foreground)', lineHeight: 1.65, margin: '0 0 4px' }}>
        Votre compte (<strong style={{ color: 'var(--foreground)' }}>{email}</strong>) a été refusé par un administrateur CPI :
      </p>
      {motif && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--destructive)', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.18)', borderRadius: 'var(--radius)', padding: '10px 14px', margin: '10px 0 20px' }}>
          « {motif} »
        </p>
      )}
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: '0 0 18px' }}>
        Corrigez les informations concernées puis renvoyez votre demande — un administrateur l'examinera à nouveau.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Téléphone</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 77 000 00 00"
            style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employeur</span>
          <input value={employer} onChange={e => setEmployer(e.target.value)} placeholder="Nom de votre employeur"
            style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem' }} />
        </label>
      </div>

      <button type="button" onClick={resoumettre} disabled={envoi} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20,
        padding: '11px 22px', borderRadius: 'var(--radius)', border: 'none',
        background: 'var(--primary)', color: 'var(--primary-foreground)',
        fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, cursor: envoi ? 'wait' : 'pointer',
      }}>
        <Send size={15} /> {envoi ? 'Envoi…' : 'Renvoyer ma demande'}
      </button>
      {banniereErreur}
    </>
  );
}
