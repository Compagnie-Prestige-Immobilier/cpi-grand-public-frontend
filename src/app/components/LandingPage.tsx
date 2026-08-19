import { useState } from 'react';
import {
  Shield, Users, ChevronRight, CheckCircle2,
  Star, ArrowRight, Phone, Mail, MapPin, Menu, X,
  TrendingUp, Clock, FileText, Award
} from 'lucide-react';
// lucide-react 1.x ne fournit plus les icônes de marque (voir BrandIcons.tsx).
import { Facebook, Instagram, Linkedin } from './BrandIcons';
import { replierImage } from '../lib/images';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

const CPI_PRIMARY = '#630210';
const CPI_DARK = '#3A010A';
const CPI_LIGHT = '#F5ECEE';
const CPI_BORDER = 'rgba(99,2,16,0.12)';
const CPI_MUTED = '#6B4A52';
const GOLD = '#C8921A';
const GOLD_LIGHT = '#F0B840';

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stats = [
    { value: '3 500+', label: 'Familles propriétaires', icon: FileText },
    { value: '20+ ans', label: "D'expérience immobilière", icon: TrendingUp },
    { value: '72h', label: 'Délai de réponse moyen', icon: Clock },
    { value: '2003', label: 'Année de fondation', icon: Award },
  ];

  const fonctionnaireFeatures = [
    "Taux préférentiel réservé aux fonctionnaires",
    "Conditions négociées avec nos banques partenaires",
    "Traitement prioritaire de votre dossier",
    "Frais de dossier réduits",
    "Accompagnement personnalisé",
    "Accès à l'offre AM SA KER (Ma maison)",
  ];

  const publicFeatures = [
    "Ouvert à tout salarié du secteur privé ou profession libérale",
    "Financement immobilier à taux compétitif",
    "Villas et parcelles à Thiès",
    "Dossier 100% en ligne",
    "Conseil et accompagnement gratuits",
    "Éligibilité vérifiée selon votre profil",
  ];

  const partners = [
    {
      name: 'CPI',
      full: 'Compagnie Prestige Immobilier',
      desc: 'Promoteur immobilier, fondée en 2003 par Mme Aminata Sall SY',
      color: CPI_PRIMARY,
    },
    {
      name: 'Banques partenaires',
      full: 'Institutions financières agréées',
      desc: 'Conventions de financement actives',
      color: GOLD,
    },
  ];

  const process = [
    { step: '01', title: 'Choisissez votre profil', desc: 'Fonctionnaire, salarié du privé ou profession libérale — chaque parcours est adapté à votre situation.' },
    { step: '02', title: 'Constituez votre dossier', desc: 'Déposez vos pièces en ligne. Notre plateforme vous guide étape par étape.' },
    { step: '03', title: 'Analyse & décision', desc: 'Les équipes CPI et notre banque partenaire étudient votre demande.' },
    { step: '04', title: 'Financement débloqué', desc: 'Votre financement est accordé et les clés de votre bien vous sont remises.' },
  ];

  const properties = [
    {
      type: 'Villa R+1',
      location: 'Cité CPI, Thiès',
      img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop&auto=format',
      surface: '120 m²',
      rooms: '4 chambres',
      tag: 'Disponible',
    },
    {
      type: 'Parcelle constructible',
      location: 'Lotissement CPI, Thiès',
      img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=400&fit=crop&auto=format',
      surface: '200 m²',
      rooms: 'Terrain nu viabilisé',
      tag: 'Disponible',
    },
    {
      type: 'Villa F4',
      location: 'Résidence CPI, Thiès',
      img: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=400&fit=crop&auto=format',
      surface: '95 m²',
      rooms: '3 chambres',
      tag: 'Prochainement',
    },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b" style={{ borderColor: CPI_BORDER }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src="https://cpi.sn/logos/cpi-logo.png"
                alt="CPI — Compagnie Prestige Immobilier"
                className="h-10 w-auto"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            <div className="hidden md:flex items-center gap-8">
              {[['#offres', 'Nos offres'], ['#programme', 'Programme'], ['#partenaires', 'Partenaires'], ['#contact', 'Contact']].map(([href, label]) => (
                <a key={href} href={href} className="transition-colors" style={{ color: CPI_MUTED, fontSize: '0.875rem', fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.color = CPI_PRIMARY)}
                  onMouseLeave={e => (e.currentTarget.style.color = CPI_MUTED)}>
                  {label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={onLogin}
                className="px-4 py-2 border transition-colors"
                style={{ borderColor: CPI_PRIMARY, color: CPI_PRIMARY, fontSize: '0.875rem', fontWeight: 600 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = CPI_LIGHT; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                Se connecter
              </button>
              <button
                onClick={onRegister}
                className="px-4 py-2 text-white transition-colors"
                style={{ background: CPI_PRIMARY, fontSize: '0.875rem', fontWeight: 600 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = CPI_DARK; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = CPI_PRIMARY; }}
              >
                Déposer un dossier
              </button>
            </div>

            <button className="md:hidden p-2" style={{ color: '#1C0810' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white px-6 py-4 flex flex-col gap-4" style={{ borderColor: CPI_BORDER }}>
            {[['#offres', 'Nos offres'], ['#programme', 'Programme'], ['#partenaires', 'Partenaires'], ['#contact', 'Contact']].map(([href, label]) => (
              <a key={href} href={href} style={{ color: '#1C0810', fontSize: '0.875rem', fontWeight: 500 }}>{label}</a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: CPI_BORDER }}>
              <button onClick={onLogin} className="px-4 py-2 border text-sm font-semibold" style={{ borderColor: CPI_PRIMARY, color: CPI_PRIMARY }}>Se connecter</button>
              <button onClick={onRegister} className="px-4 py-2 text-white text-sm font-semibold" style={{ background: CPI_PRIMARY }}>Déposer un dossier</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-16 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${CPI_DARK} 0%, ${CPI_PRIMARY} 60%, #8E1526 100%)` }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.6) 40px, rgba(255,255,255,0.6) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.6) 40px, rgba(255,255,255,0.6) 41px)' }} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-28 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 border mb-6" style={{ background: 'rgba(200,146,26,0.18)', borderColor: 'rgba(200,146,26,0.4)', fontSize: '0.75rem', fontWeight: 700, color: GOLD_LIGHT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Award className="w-3 h-3" />
                Programme Immobilier · Travailleurs du Sénégal
              </div>
              <h1 className="text-white mb-6" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1 }}>
                Accédez à la propriété.
                <span style={{ color: GOLD_LIGHT }}> Simplement.</span>
              </h1>
              <p className="mb-8" style={{ color: '#DFC0C8', fontSize: '1.0625rem', lineHeight: 1.7 }}>
                CPI et ses banques partenaires réunissent leurs forces pour faciliter l'accès à la propriété immobilière aux travailleurs du Sénégal. Villas et parcelles à Thiès — financement sur mesure.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onRegister}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-white transition-colors"
                  style={{ background: GOLD, fontWeight: 700, fontSize: '0.9375rem' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#b07d15'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = GOLD; }}
                >
                  Déposer mon dossier <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onLogin}
                  className="flex items-center justify-center gap-2 px-6 py-3 border transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 600, fontSize: '0.9375rem' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  Accéder à mon espace
                </button>
              </div>

              {/* Convention badges */}
              <div className="flex flex-wrap gap-3 mt-8">
                <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#86EFAC' }} />
                  <span style={{ fontSize: '0.75rem', color: '#DFC0C8', fontWeight: 500 }}>Dossier garanti CPI</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#86EFAC' }} />
                  <span style={{ fontSize: '0.75rem', color: '#DFC0C8', fontWeight: 500 }}>Partenaire bancaire agréé</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem' }}>
                    <Icon className="w-5 h-5 mb-3" style={{ color: GOLD_LIGHT }} />
                    <div className="text-white mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800 }}>{s.value}</div>
                    <div style={{ color: '#DFC0C8', fontSize: '0.8125rem' }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#FAF7F7]" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
      </section>

      {/* Mobile stats */}
      <div className="lg:hidden py-8 px-6" style={{ background: '#FAF7F7' }}>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white p-4" style={{ border: `1px solid ${CPI_BORDER}` }}>
                <Icon className="w-4 h-4 mb-2" style={{ color: GOLD }} />
                <div className="mb-0.5" style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: '#1C0810' }}>{s.value}</div>
                <div style={{ color: CPI_MUTED, fontSize: '0.75rem' }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dual pathway */}
      <section id="offres" className="py-20" style={{ background: '#FAF7F7' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="mb-3" style={{ color: GOLD, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Choisissez votre parcours</div>
            <h2 className="mb-4" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 800, color: '#1C0810' }}>
              Un portail, deux parcours adaptés
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: CPI_MUTED, fontSize: '1rem', lineHeight: 1.7 }}>
              Fonctionnaire, salarié du privé ou profession libérale — la plateforme s'adapte à votre profil et vous oriente vers les meilleures conditions disponibles.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Fonctionnaire Card */}
            <div className="p-8 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${CPI_DARK} 0%, ${CPI_PRIMARY} 100%)` }}>
              <div className="absolute top-0 right-0 w-48 h-48" style={{ opacity: 0.06, background: `radial-gradient(circle, ${GOLD} 0%, transparent 70%)` }} />
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6" style={{ background: 'rgba(200,146,26,0.25)', fontSize: '0.6875rem', fontWeight: 700, color: GOLD_LIGHT, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                <Star className="w-3 h-3" />
                Réservé aux fonctionnaires
              </div>
              <h3 className="text-white mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 800 }}>AM SA KER</h3>
              <p style={{ color: '#DFC0C8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>« Ma maison » — L'offre dédiée aux fonctionnaires</p>
              <ul className="space-y-3 mb-8">
                {fonctionnaireFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD_LIGHT }} />
                    <span style={{ color: '#DFC0C8', fontSize: '0.875rem' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onRegister}
                className="w-full flex items-center justify-center gap-2 py-3 text-white transition-colors"
                style={{ background: GOLD, fontWeight: 700, fontSize: '0.9375rem' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#b07d15'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = GOLD; }}
              >
                Je suis fonctionnaire <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Public Card */}
            <div className="bg-white p-8 relative overflow-hidden" style={{ border: `1px solid ${CPI_BORDER}` }}>
              <div className="absolute top-0 right-0 w-48 h-48" style={{ opacity: 0.03, background: `radial-gradient(circle, ${CPI_PRIMARY} 0%, transparent 70%)` }} />
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6" style={{ background: CPI_LIGHT, fontSize: '0.6875rem', fontWeight: 700, color: CPI_PRIMARY, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                <Users className="w-3 h-3" />
                Ouvert à tous les profils
              </div>
              <h3 className="mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 800, color: '#1C0810' }}>Parcours Standard</h3>
              <p style={{ color: CPI_MUTED, fontSize: '0.875rem', marginBottom: '1.5rem' }}>Secteur privé & autres profils</p>
              <ul className="space-y-3 mb-8">
                {publicFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#1A6B44' }} />
                    <span style={{ color: '#3D2030', fontSize: '0.875rem' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onRegister}
                className="w-full flex items-center justify-center gap-2 py-3 transition-colors"
                style={{ border: `2px solid ${CPI_PRIMARY}`, color: CPI_PRIMARY, fontWeight: 700, fontSize: '0.9375rem', background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = CPI_LIGHT; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                Déposer mon dossier <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Properties */}
      <section id="programme" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="mb-3" style={{ color: GOLD, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Nos biens à Thiès</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 800, color: '#1C0810' }}>
              Villas & Parcelles disponibles
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((p) => (
              <div key={p.type} className="bg-white overflow-hidden" style={{ border: `1px solid ${CPI_BORDER}` }}>
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  <img src={p.img} alt={`${p.type} — ${p.location}`} className="w-full h-full object-cover" onError={replierImage} />
                  <div className="absolute top-3 left-3 px-2 py-1" style={{ background: p.tag === 'Disponible' ? '#1A6B44' : CPI_PRIMARY, fontSize: '0.6875rem', fontWeight: 700, color: 'white', letterSpacing: '0.05em' }}>
                    {p.tag}
                  </div>
                </div>
                <div className="p-5">
                  <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: '#1C0810', marginBottom: '4px' }}>{p.type}</h4>
                  <div className="flex items-center gap-1 mb-3" style={{ color: CPI_MUTED, fontSize: '0.8125rem' }}>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {p.location}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 text-center" style={{ background: '#FAF7F7', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#1C0810' }}>{p.surface}</div>
                      <div style={{ color: CPI_MUTED }}>Surface</div>
                    </div>
                    <div className="p-2 text-center" style={{ background: '#FAF7F7', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#1C0810' }}>{p.rooms}</div>
                      <div style={{ color: CPI_MUTED }}>Type</div>
                    </div>
                  </div>
                  <button
                    onClick={onRegister}
                    className="mt-4 w-full py-2.5 transition-colors"
                    style={{ background: CPI_LIGHT, color: CPI_PRIMARY, fontWeight: 700, fontSize: '0.8125rem' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = CPI_PRIMARY; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = CPI_LIGHT; (e.currentTarget as HTMLElement).style.color = CPI_PRIMARY; }}
                  >
                    Je suis intéressé(e)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20" style={{ background: '#FAF7F7' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="mb-3" style={{ color: GOLD, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Comment ça marche</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 800, color: '#1C0810' }}>
              Un processus clair et transparent
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {process.map((p, _i) => (
              <div key={p.step} className="relative">
                <div className="relative z-10">
                  <div className="w-12 h-12 flex items-center justify-center mb-5 text-white" style={{ background: CPI_PRIMARY, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>
                    {p.step}
                  </div>
                  <h4 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.0625rem', color: '#1C0810' }}>{p.title}</h4>
                  <p style={{ color: CPI_MUTED, fontSize: '0.875rem', lineHeight: 1.6 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section id="partenaires" className="py-16 bg-white" style={{ borderTop: `1px solid ${CPI_BORDER}` }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="mb-3" style={{ color: GOLD, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Nos partenaires</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 3vw, 1.875rem)', fontWeight: 800, color: '#1C0810' }}>
              Des institutions, une vision commune
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {partners.map((p) => (
              <div key={p.name} className="bg-white p-6 text-center" style={{ border: `1px solid ${CPI_BORDER}` }}>
                <div className="w-16 h-16 mx-auto flex items-center justify-center mb-4" style={{ background: `${p.color}14`, border: `2px solid ${p.color}30` }}>
                  <Shield className="w-7 h-7" style={{ color: p.color }} />
                </div>
                <div className="mb-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem', color: '#1C0810' }}>{p.name}</div>
                <div className="mb-2" style={{ color: CPI_MUTED, fontSize: '0.75rem', lineHeight: 1.5 }}>{p.full}</div>
                <div style={{ color: p.color, fontSize: '0.6875rem', fontWeight: 600 }}>{p.desc}</div>
              </div>
            ))}
          </div>

          {/* Founder note */}
          <div className="mt-12 max-w-2xl mx-auto text-center p-8" style={{ background: '#FAF7F7', border: `1px solid ${CPI_BORDER}` }}>
            <div className="w-14 h-14 mx-auto flex items-center justify-center mb-4 text-white" style={{ background: CPI_PRIMARY, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem' }}>AS</div>
            <blockquote className="mb-3" style={{ color: '#3D2030', fontSize: '0.9375rem', lineHeight: 1.7, fontStyle: 'italic' }}>
              "Notre mission depuis 2003 : démocratiser l'accès à la propriété foncière et immobilière au Sénégal."
            </blockquote>
            <div style={{ color: '#1C0810', fontWeight: 700, fontSize: '0.875rem' }}>Mme Aminata Sall SY</div>
            <div style={{ color: CPI_MUTED, fontSize: '0.75rem' }}>Commissaire Principale · Fondatrice de CPI</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16" style={{ background: `linear-gradient(90deg, ${CPI_DARK} 0%, ${CPI_PRIMARY} 100%)` }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-white mb-4" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 800 }}>
            Prêt à réaliser votre projet immobilier ?
          </h2>
          <p className="mb-8" style={{ color: '#DFC0C8', fontSize: '1rem', lineHeight: 1.7 }}>
            Créez votre compte gratuitement et commencez votre demande en quelques minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onRegister}
              className="flex items-center justify-center gap-2 px-8 py-3 text-white transition-colors"
              style={{ background: GOLD, fontWeight: 700 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#b07d15'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = GOLD; }}
            >
              Commencer maintenant <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLogin}
              className="flex items-center justify-center gap-2 px-8 py-3 border transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 600 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              J'ai déjà un compte
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" style={{ background: '#1C0810' }} className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <img src="https://cpi.sn/logos/cpi-logo.png" alt="CPI" className="h-12 w-auto mb-4 brightness-200 contrast-75"
                onError={e => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = 'none';
                  const fb = document.createElement('div');
                  fb.className = 'text-white font-bold text-xl mb-4';
                  fb.style.fontFamily = 'var(--font-display)';
                  fb.textContent = 'CPI';
                  el.parentNode?.insertBefore(fb, el);
                }}
              />
              <p style={{ color: '#6B3040', fontSize: '0.8125rem', lineHeight: 1.7 }}>
                Compagnie Prestige Immobilier — Fondée en 2003 par Mme Aminata Sall SY.
              </p>
              <div className="flex items-center gap-3 mt-4">
                {[
                  { Icon: Facebook, href: 'https://facebook.com/cpiimmobilier' },
                  { Icon: Instagram, href: 'https://instagram.com/cpiimmobilier' },
                  { Icon: Linkedin, href: 'https://linkedin.com/company/cpi-immobilier' },
                ].map(({ Icon, href }) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#6B3040' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DFC0C8'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6B3040'; }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-4" style={{ color: '#DFC0C8', fontWeight: 700, fontSize: '0.875rem' }}>Offres</div>
              <ul className="space-y-2">
                {/* Ces entrées énumèrent l'offre ; elles ne mènent nulle part.
                    Écrites en <a href="#">, elles se présentaient comme des
                    liens : au clavier elles se sélectionnaient, et les activer
                    remontait la page en tête. Un texte qui décrit reste un
                    texte. */}
                {['AM SA KER (Fonctionnaires)', 'Villas à Thiès', 'Parcelles à Thiès', 'Simulateur en ligne'].map(i => (
                  <li key={i} style={{ color: '#6B3040', fontSize: '0.8125rem' }}>{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-4" style={{ color: '#DFC0C8', fontWeight: 700, fontSize: '0.875rem' }}>Partenaires</div>
              <ul className="space-y-2">
                {['Banques partenaires', 'Institutions financières agréées'].map(i => (
                  <li key={i} style={{ color: '#6B3040', fontSize: '0.8125rem' }}>{i}</li>
                ))}
                {/* Seul le site institutionnel a une destination réelle. */}
                <li><a href="https://cpi.sn" target="_blank" rel="noreferrer" style={{ color: '#6B3040', fontSize: '0.8125rem' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DFC0C8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6B3040'; }}>cpi.sn</a></li>
              </ul>
            </div>
            <div>
              <div className="mb-4" style={{ color: '#DFC0C8', fontWeight: 700, fontSize: '0.875rem' }}>Contact</div>
              <div className="space-y-2">
                {[
                  { Icon: MapPin, text: 'Ngor, Lot N°8 (près station Shell), Dakar' },
                  { Icon: Phone, text: '+221 33 820 25 07 / +221 33 842 60 17' },
                  { Icon: Phone, text: 'WhatsApp : +221 77 664 94 00' },
                  { Icon: Mail, text: 'contact@cpi.sn' },
                ].map(({ Icon, text }) => (
                  <div key={text} className="flex items-start gap-2" style={{ color: '#6B3040', fontSize: '0.8125rem' }}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{text}</span>
                  </div>
                ))}
                <div style={{ color: '#6B3040', fontSize: '0.75rem', marginTop: '8px' }}>
                  Lun–Ven : 08h–18h · Sam : 09h–13h
                </div>
              </div>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col sm:flex-row justify-between items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#3D1525', fontSize: '0.75rem' }}>
              © 2026 Compagnie Prestige Immobilier. Tous droits réservés.
            </div>
            <div className="flex gap-4">
              {/* Les trois mentions renvoyaient sur « # ». Elles pointent
                  désormais sur les conditions d'utilisation, qui existent
                  vraiment (route /conditions). */}
              {['Mentions légales', 'Politique de confidentialité', 'CGU'].map(i => (
                <a key={i} href="/conditions" style={{ color: '#3D1525', fontSize: '0.75rem' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6B3040'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3D1525'; }}>{i}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
