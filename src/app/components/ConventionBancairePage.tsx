import { Home, Info } from 'lucide-react';

// Harmonisé au système CPI : fond clair, en-têtes bordeaux, accent or (var(--accent)).
const GOLD = 'var(--accent)';

interface Row {
  label: string;
  value: string;
  highlight?: 'bordeaux' | 'green';
}

const CLASSIQUE_ROWS: Row[] = [
  { label: 'Cible',             value: 'Fonctionnaires & Décisionnaires', highlight: 'bordeaux' },
  { label: 'Revenus min.',      value: '350 000 FCFA/mois' },
  { label: 'Cap. endettement',  value: '45 % à 60 % selon revenus' },
  { label: 'Taux d\'intérêt HT', value: '6,8 % (sans rachat)' },
  { label: 'Durée max.',        value: '300 mois (25 ans)' },
  { label: 'Apport',            value: 'Financement à 100 % possible' },
  { label: 'Garantie',          value: 'Hypothèque 1er rang\n+ délégation assurance' },
];

const AMSAKAR_ROWS: Row[] = [
  { label: 'Cible',             value: 'Fonctionnaires (titres précaires)', highlight: 'green' },
  { label: 'Revenus min.',      value: '250 000 FCFA/mois' },
  { label: 'Cap. endettement',  value: '45 % à 60 % selon revenus' },
  { label: 'Taux d\'intérêt HT', value: '8,5 % (<15 ans) / 9 % (15-25 ans)' },
  { label: 'Durée max.',        value: '300 mois (25 ans)' },
  { label: 'Apport',            value: 'Financement à 100 % possible' },
  { label: 'Titres acceptés',   value: 'Permis d\'occuper, délibération\ncommunale, attribution domaines' },
];

function ProductCard({
  number,
  title,
  subtitle,
  rows,
  accent,
  headerBg,
  icon,
}: {
  number: string;
  title: string;
  subtitle: string;
  rows: Row[];
  accent: string;
  headerBg: string;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{
      flex: '1 1 280px',
      minWidth: 260,
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      overflow: 'hidden',
      background: 'var(--card)',
      boxShadow: 'var(--elev-sm)',
    }}>
      {/* Card header */}
      <div style={{
        background: headerBg,
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '22px', height: '22px',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.6875rem', fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>{number}</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9375rem', fontWeight: 700,
            color: 'white',
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
          }}>{title}</span>
          {icon}
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.65)',
          marginLeft: '32px',
          fontStyle: 'italic',
        }}>{subtitle}</p>
      </div>

      {/* Comparison rows */}
      {rows.map((row, i) => (
        <div key={row.label} style={{
          display: 'flex',
          borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
          padding: '11px 20px',
          background: i % 2 === 0 ? 'white' : '#FAFAF9',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
            color: 'var(--muted-foreground)',
            fontWeight: 500,
            width: '148px',
            flexShrink: 0,
          }}>{row.label}</span>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
            fontWeight: row.highlight ? 700 : 500,
            color: row.highlight === 'bordeaux'
              ? 'var(--primary)'
              : row.highlight === 'green'
              ? '#1A6B44'
              : 'var(--foreground)',
            whiteSpace: 'pre-line' as const,
            lineHeight: 1.5,
          }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ConventionBancairePage() {
  return (
    <div style={{
      minHeight: '100%',
      background: 'var(--background)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
    }}>
      {/* Inner content */}
      <div style={{ padding: '32px 32px 40px' }}>

        {/* Breadcrumb / chapter tag */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '10px',
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.6875rem', fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: GOLD,
          }}>
            Convention de financement
          </span>
        </div>

        {/* Page heading */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          fontWeight: 800,
          color: 'var(--foreground)',
          lineHeight: 1.2,
          marginBottom: '28px',
          letterSpacing: '-0.01em',
        }}>
          Les Deux Produits Financiers Clés
        </h1>

        {/* Cards row */}
        <div style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          <ProductCard
            number="①"
            title="Crédit Immobilier Classique"
            subtitle="Avec Titre Foncier ou Bail"
            rows={CLASSIQUE_ROWS}
            accent="var(--primary)"
            headerBg="var(--sidebar)"
          />
          <ProductCard
            number="②"
            title="Offre AM SA KER"
            subtitle="Pour fonctionnaires sans Titre Foncier (titres précaires)"
            rows={AMSAKAR_ROWS}
            accent="#1A6B44"
            headerBg="var(--primary)"
            icon={<Home size={15} style={{ color: 'rgba(255,255,255,0.8)', flexShrink: 0 }} />}
          />
        </div>

        {/* Info note */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginTop: '24px',
          padding: '10px 16px',
          background: 'var(--secondary)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border)',
        }}>
          <Info size={13} style={{ color: GOLD, flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
          }}>
            Convention de financement · Articles I &amp; II · Taux susceptibles d'évoluer selon conditions marché
          </span>
        </div>

      </div>
    </div>
  );
}
