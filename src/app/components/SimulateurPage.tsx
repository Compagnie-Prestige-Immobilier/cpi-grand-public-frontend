import { useState, useMemo } from 'react';
import {
  Calculator, ChevronLeft, ChevronRight, BarChart3, Table2, Printer,
  TrendingDown, Info,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { AuthUser } from '../App';

// ─── Finance ──────────────────────────────────────────────────────────────────

function calcPMT(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0 || principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

interface AmoRow {
  period: number;
  date: string;
  balanceStart: number;
  interest: number;
  capital: number;
  balanceEnd: number;
  payment: number;
}

function generateSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  firstDate: Date,
): AmoRow[] {
  if (months <= 0 || principal <= 0) return [];
  const r = annualRatePct / 100 / 12;
  const rawPMT = calcPMT(principal, annualRatePct, months);
  const rows: AmoRow[] = [];
  let balance = principal;
  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    const capital = i === months ? balance : rawPMT - interest;
    const balanceEnd = Math.max(0, balance - capital);
    const d = new Date(firstDate);
    d.setMonth(firstDate.getMonth() + (i - 1));
    rows.push({
      period: i,
      date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      balanceStart: Math.round(balance),
      interest: Math.round(interest),
      capital: Math.round(capital),
      balanceEnd: Math.round(balanceEnd),
      payment: Math.round(interest + capital),
    });
    balance = balanceEnd;
  }
  return rows;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

// ─── Injected styles (range thumb + responsive) ───────────────────────────────

const CSS = `
  .sim-range { -webkit-appearance: none; appearance: none; outline: none; cursor: pointer; border-radius: 99px; }
  .sim-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--primary); border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(99,2,16,0.35);
    cursor: pointer; transition: transform 0.12s;
  }
  .sim-range::-webkit-slider-thumb:hover { transform: scale(1.18); }
  .sim-range::-moz-range-thumb {
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--primary); border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(99,2,16,0.35); cursor: pointer;
  }
  .sim-grid { display: grid; grid-template-columns: 360px 1fr; gap: 20px; align-items: start; }
  .sim-grid > * { min-width: 0; }
  .sim-left-sticky { position: sticky; top: 16px; }
  .sim-tr:hover td { background: var(--secondary) !important; }
  @media (max-width: 900px) {
    .sim-grid { grid-template-columns: 1fr; }
    .sim-left-sticky { position: static; }
  }
  @media print {
    .sim-no-print { display: none !important; }
    .sim-print-full { max-width: 100% !important; }
  }
`;

// ─── Range slider ─────────────────────────────────────────────────────────────

function Slider({ value, min, max, step = 1, onChange }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="sim-range"
      style={{
        width: '100%', height: '6px',
        background: `linear-gradient(to right, var(--primary) ${pct}%, var(--muted) ${pct}%)`,
      }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 12; // 1 year per page

export default function SimulateurPage({ user: _user }: { user: AuthUser }) {
  const [montant, setMontant] = useState(6_500_000);
  const [montantRaw, setMontantRaw] = useState('6 500 000');
  const [taux, setTaux] = useState(8.5);
  const [dureeAns, setDureeAns] = useState(25);
  const [dateDebut, setDateDebut] = useState('2026-08-01');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [page, setPage] = useState(0);

  const dureeMonths = dureeAns * 12;

  const firstDate = useMemo(() => {
    const d = new Date(dateDebut + 'T00:00:00');
    return isNaN(d.getTime()) ? new Date() : d;
  }, [dateDebut]);

  const schedule = useMemo(
    () => generateSchedule(montant, taux, dureeMonths, firstDate),
    [montant, taux, dureeMonths, firstDate],
  );

  const mensualite = Math.round(calcPMT(montant, taux, dureeMonths));
  const totalPaye = mensualite * dureeMonths;
  const totalInterets = Math.max(0, totalPaye - montant);
  const pctCapital = montant / totalPaye;
  const pctInterets = totalInterets / totalPaye;

  // Annual chart data (year 0 → year N)
  const chartData = useMemo(() => {
    const data: { year: string; capitalRestant: number; cumulInterets: number; cumulCapital: number }[] = [];
    data.push({ year: 'Départ', capitalRestant: montant, cumulInterets: 0, cumulCapital: 0 });
    for (let y = 1; y <= dureeAns; y++) {
      const monthIdx = y * 12 - 1;
      const row = schedule[Math.min(monthIdx, schedule.length - 1)];
      if (!row) continue;
      const slice = schedule.slice(0, y * 12);
      data.push({
        year: `An ${y}`,
        capitalRestant: row.balanceEnd,
        cumulInterets: slice.reduce((s, r) => s + r.interest, 0),
        cumulCapital: slice.reduce((s, r) => s + r.capital, 0),
      });
    }
    return data;
  }, [schedule, montant, dureeAns]);

  const totalPages = Math.ceil(schedule.length / ROWS_PER_PAGE);
  const pageRows = schedule.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const handleMontantCommit = (raw: string) => {
    const n = parseInt(raw.replace(/\s/g, '').replace(/[^0-9]/g, ''), 10);
    if (!isNaN(n) && n >= 500_000 && n <= 100_000_000) {
      setMontant(n);
      setMontantRaw(n.toLocaleString('fr-FR'));
    } else {
      setMontantRaw(montant.toLocaleString('fr-FR'));
    }
  };

  const handleMontantSlider = (v: number) => {
    setMontant(v);
    setMontantRaw(v.toLocaleString('fr-FR'));
  };

  const setDuree = (v: number) => { setDureeAns(v); setPage(0); };

  // Responsive custom tooltip for chart
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
            <span style={{ color: p.color }}>{
              p.dataKey === 'capitalRestant' ? 'Capital restant' :
              p.dataKey === 'cumulInterets' ? 'Cumul intérêts' : 'Cumul capital'
            }</span>
            <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{fmt(p.value)} FCFA</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ width: '100%', fontFamily: 'var(--font-sans)' }} className="sim-print-full">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="sim-no-print" style={{
          background: 'linear-gradient(120deg, var(--primary) 0%, #8E1526 100%)',
          borderRadius: 'var(--r-lg)', padding: '26px 32px', marginBottom: '22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <Calculator size={16} style={{ color: 'rgba(255,255,255,0.55)' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                CPI · Outil financier
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem,2.5vw,1.6rem)', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
              Simulateur de prêt immobilier
            </h1>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)', marginTop: '5px' }}>
              Mensualités · Tableau d'amortissement complet · Durée jusqu'à 25 ans
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Durée max.', value: '25 ans', sub: '300 mensualités' },
              { label: 'Taux banque', value: '8,50%', sub: 'Référence marché' },
              { label: 'Périodicité', value: 'Mensuelle', sub: '12 paiements/an' },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 'var(--r-md)', padding: '12px 18px', textAlign: 'center', minWidth: '100px',
              }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: '#FFC65A' }}>{value}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="sim-grid">

          {/* ── LEFT: Inputs ────────────────────────────────────────────── */}
          <div className="sim-left-sticky" style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: '24px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px',
              paddingBottom: '16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--r-sm)', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calculator size={15} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>Paramètres</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Ajustez les paramètres de votre prêt</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>

              {/* Montant */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Montant du prêt
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      value={montantRaw}
                      onChange={e => setMontantRaw(e.target.value)}
                      onBlur={e => handleMontantCommit(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleMontantCommit((e.target as HTMLInputElement).value); }}
                      style={{
                        fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800,
                        color: 'var(--primary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)', padding: '5px 10px', background: 'var(--secondary)',
                        width: '128px', textAlign: 'right', outline: 'none',
                      }}
                    />
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)' }}>FCFA</span>
                  </div>
                </div>
                <Slider value={montant} min={500_000} max={50_000_000} step={500_000} onChange={handleMontantSlider} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: 'var(--muted-foreground)' }}>500 000</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: 'var(--muted-foreground)' }}>50 000 000</span>
                </div>
              </div>

              {/* Taux */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Taux d'intérêt annuel
                  </label>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {taux.toFixed(2)} %
                  </span>
                </div>
                <Slider value={taux * 10} min={60} max={140} step={5} onChange={v => setTaux(v / 10)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: 'var(--muted-foreground)' }}>6%</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: 'var(--muted-foreground)' }}>14%</span>
                </div>
                {/* Quick preset buttons */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '9px' }}>
                  {[7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12].map(r => (
                    <button
                      key={r}
                      onClick={() => setTaux(r)}
                      style={{
                        fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600,
                        padding: '3px 9px', borderRadius: 'var(--r-xs)', cursor: 'pointer', border: 'none',
                        background: taux === r ? 'var(--primary)' : 'var(--secondary)',
                        color: taux === r ? '#fff' : 'var(--muted-foreground)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Durée
                  </label>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {dureeAns} ans
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginLeft: '6px' }}>
                      ({dureeMonths} mois)
                    </span>
                  </div>
                </div>
                <Slider value={dureeAns} min={1} max={25} step={1} onChange={setDuree} />
                {/* Year tick marks */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                  {[1, 5, 10, 15, 20, 25].map(y => (
                    <span
                      key={y}
                      onClick={() => setDuree(y)}
                      style={{
                        fontFamily: 'var(--font-sans)', fontSize: '0.625rem', cursor: 'pointer',
                        color: dureeAns === y ? 'var(--primary)' : 'var(--muted-foreground)',
                        fontWeight: dureeAns === y ? 800 : 400,
                        textDecoration: dureeAns === y ? 'none' : 'none',
                        transition: 'color 0.1s',
                      }}
                    >
                      {y}a
                    </span>
                  ))}
                </div>
                {/* Quick year presets */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '9px' }}>
                  {[5, 10, 15, 20, 25].map(y => (
                    <button
                      key={y}
                      onClick={() => setDuree(y)}
                      style={{
                        fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600,
                        padding: '3px 9px', borderRadius: 'var(--r-xs)', cursor: 'pointer', border: 'none',
                        background: dureeAns === y ? 'var(--primary)' : 'var(--secondary)',
                        color: dureeAns === y ? '#fff' : 'var(--muted-foreground)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {y} ans
                    </button>
                  ))}
                </div>
              </div>

              {/* Premier paiement */}
              <div>
                <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '9px' }}>
                  Date du 1er paiement
                </label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={e => { setDateDebut(e.target.value); setPage(0); }}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border)', background: 'var(--input-background)',
                    fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)',
                    outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Fixed params */}
              <div style={{
                background: 'var(--secondary)', borderRadius: 'var(--r-sm)', padding: '13px 16px',
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
              }}>
                {[
                  { label: 'Périodicité', value: 'Mensuelle' },
                  { label: 'Paiements/an', value: '12' },
                  { label: 'Type de taux', value: 'Fixe' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: '3px' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Info box */}
              <div style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'rgba(99,2,16,0.06)', borderRadius: 'var(--r-sm)', border: '1px solid rgba(99,2,16,0.1)' }}>
                <Info size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
                  Le paiement calculé est basé sur un taux d'amortissement constant. La dernière échéance peut légèrement différer par arrondi.
                </span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Results ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Big mensualité */}
            <div style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, #4A0110 55%, #3A010A 100%)',
              borderRadius: 'var(--r-md)', padding: '26px 28px',
              display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: '7px' }}>
                  Mensualité calculée
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,2.875rem)', fontWeight: 900, color: '#FFC65A', lineHeight: 1 }}>
                    {fmt(mensualite)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>FCFA</span>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  par mois · taux {taux.toFixed(2)}% · {dureeAns} ans
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                {[
                  { label: 'Capital', value: fmt(montant) + ' FCFA' },
                  { label: 'Total intérêts', value: fmt(totalInterets) + ' FCFA' },
                  { label: 'Coût total', value: fmt(totalPaye) + ' FCFA' },
                  { label: 'Nb mensualités', value: `${dureeMonths}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: 'Capital emprunté', value: fmt(montant), color: 'var(--primary)', bg: 'var(--secondary)' },
                { label: 'Total intérêts', value: fmt(totalInterets), color: 'var(--accent)', bg: 'rgba(200,146,26,0.08)' },
                { label: 'Coût total crédit', value: fmt(totalPaye), color: 'var(--success)', bg: 'rgba(26,107,68,0.07)' },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>{k.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.625rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>FCFA</div>
                </div>
              ))}
            </div>

            {/* Capital / Intérêts ratio bar */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '12px' }}>
                Répartition Capital / Intérêts
              </div>
              <div style={{ height: '11px', borderRadius: 'var(--r-full)', overflow: 'hidden', display: 'flex', marginBottom: '10px' }}>
                <div style={{ width: `${pctCapital * 100}%`, background: 'var(--primary)', transition: 'width 0.45s cubic-bezier(.4,0,.2,1)' }} />
                <div style={{ flex: 1, background: 'var(--accent)', opacity: 0.82 }} />
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--primary)' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    Capital <strong style={{ color: 'var(--foreground)' }}>{(pctCapital * 100).toFixed(1)}%</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--accent)' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    Intérêts <strong style={{ color: 'var(--foreground)' }}>{(pctInterets * 100).toFixed(1)}%</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Chart / Table section */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>

              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', gap: '0', background: 'var(--card)', overflowX: 'auto' }}>
                {[
                  { id: 'chart', label: "Graphique d'évolution", icon: BarChart3 },
                  { id: 'table', label: "Tableau d'amortissement", icon: Table2 },
                ].map(tab => {
                  const active = view === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setView(tab.id as any)} style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '13px 16px',
                      background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                      borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                      marginBottom: '-1px',
                      fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: active ? 700 : 400,
                      color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                      transition: 'color 0.15s', whiteSpace: 'nowrap',
                    }}>
                      <tab.icon size={14} />{tab.label}
                    </button>
                  );
                })}
                <div style={{ flex: 1, minWidth: '12px' }} />
                <button
                  onClick={() => window.print()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '13px 16px', flexShrink: 0,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
                    color: 'var(--muted-foreground)', transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                  className="sim-no-print"
                >
                  <Printer size={13} />Imprimer
                </button>
              </div>

              {/* ── Chart ────────────────────────────────────────────────── */}
              {view === 'chart' && (
                <div style={{ padding: '24px 20px 16px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>Évolution du capital et des intérêts</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Capital restant dû · Cumul intérêts payés · Cumul capital remboursé</div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gCap" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gInt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gCapR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--success)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" tick={{ fontFamily: 'var(--font-sans)', fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval="preserveStartEnd" />
                      <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontFamily: 'var(--font-sans)', fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }} formatter={v => v === 'capitalRestant' ? 'Capital restant' : v === 'cumulInterets' ? 'Cumul intérêts' : 'Cumul capital remboursé'} />
                      <Area type="monotone" dataKey="capitalRestant" stroke="var(--primary)" strokeWidth={2.5} fill="url(#gCap)" dot={false} activeDot={{ r: 4, fill: 'var(--primary)' }} />
                      <Area type="monotone" dataKey="cumulInterets" stroke="var(--accent)" strokeWidth={2.5} fill="url(#gInt)" dot={false} activeDot={{ r: 4, fill: 'var(--accent)' }} />
                      <Area type="monotone" dataKey="cumulCapital" stroke="var(--success)" strokeWidth={2} fill="url(#gCapR)" dot={false} activeDot={{ r: 4, fill: 'var(--success)' }} strokeDasharray="5 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Table ────────────────────────────────────────────────── */}
              {view === 'table' && (
                <div>
                  {/* Table info bar */}
                  <div style={{
                    padding: '11px 20px', background: 'var(--secondary)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
                  }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                      <strong style={{ color: 'var(--foreground)' }}>{dureeMonths} périodes</strong>
                      {' · '}Mensualité : <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{fmt(mensualite)} FCFA</strong>
                      {' · '}Taux mensuel : <strong style={{ color: 'var(--foreground)' }}>{(taux / 12).toFixed(5)}%</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        Année {page + 1} / {totalPages} · Pér. {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, dureeMonths)}
                      </span>
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ width: '28px', height: '28px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: page === 0 ? 'var(--muted)' : 'var(--card)', cursor: page === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}>
                        <ChevronLeft size={13} />
                      </button>
                      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ width: '28px', height: '28px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: page >= totalPages - 1 ? 'var(--muted)' : 'var(--card)', cursor: page >= totalPages - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Amortization table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                      <thead>
                        <tr style={{ background: 'var(--primary)' }}>
                          {[
                            { label: 'Période', align: 'center' },
                            { label: 'Date', align: 'center' },
                            { label: 'Capital début', align: 'right' },
                            { label: 'Intérêts', align: 'right' },
                            { label: 'Capital remboursé', align: 'right' },
                            { label: 'Capital restant', align: 'right' },
                            { label: 'Échéance', align: 'right' },
                          ].map(({ label, align }) => (
                            <th key={label} style={{
                              fontFamily: 'var(--font-sans)', fontSize: '0.625rem', fontWeight: 700,
                              letterSpacing: '0.06em', textTransform: 'uppercase',
                              color: 'rgba(255,255,255,0.72)',
                              padding: '10px 14px', textAlign: align as any,
                              borderRight: '1px solid rgba(255,255,255,0.07)',
                              whiteSpace: 'nowrap',
                            }}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, i) => {
                          const isYearEnd = row.period % 12 === 0;
                          return (
                            <tr
                              key={row.period}
                              className="sim-tr"
                              style={{
                                background: isYearEnd
                                  ? 'rgba(99,2,16,0.045)'
                                  : i % 2 === 0 ? 'var(--card)' : 'var(--background)',
                                borderBottom: isYearEnd
                                  ? '2px solid var(--border)'
                                  : '1px solid var(--border)',
                              }}
                            >
                              <td style={{ padding: '8px 14px', textAlign: 'center', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: isYearEnd ? 700 : 400, color: isYearEnd ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                                  {row.period}
                                </span>
                                {isYearEnd && (
                                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '1px' }}>
                                    An {row.period / 12}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                                {row.date}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', borderRight: '1px solid var(--border)' }}>
                                {fmt(row.balanceStart)}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)', borderRight: '1px solid var(--border)' }}>
                                {fmt(row.interest)}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--success)', borderRight: '1px solid var(--border)' }}>
                                {fmt(row.capital)}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', borderRight: '1px solid var(--border)' }}>
                                {fmt(row.balanceEnd)}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 900, color: 'var(--primary)' }}>
                                {fmt(row.payment)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--secondary)', borderTop: '2px solid var(--border)' }}>
                          <td colSpan={2} style={{ padding: '9px 14px', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '1px solid var(--border)' }}>
                            Sous-total · Année {page + 1}
                          </td>
                          <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border)' }} />
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 800, color: 'var(--accent)', borderRight: '1px solid var(--border)' }}>
                            {fmt(pageRows.reduce((s, r) => s + r.interest, 0))}
                          </td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 800, color: 'var(--success)', borderRight: '1px solid var(--border)' }}>
                            {fmt(pageRows.reduce((s, r) => s + r.capital, 0))}
                          </td>
                          <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border)' }} />
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 800, color: 'var(--primary)' }}>
                            {fmt(pageRows.reduce((s, r) => s + r.payment, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Pagination — 1 button per year */}
                  <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={() => setPage(0)} disabled={page === 0} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, padding: '5px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--card)', color: page === 0 ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: page === 0 ? 'default' : 'pointer' }}>
                      ← Départ
                    </button>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {Array.from({ length: totalPages }, (_, i) => i).map(p => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          title={`Année ${p + 1} · Pér. ${p * 12 + 1}–${Math.min((p + 1) * 12, dureeMonths)}`}
                          style={{
                            width: '28px', height: '28px', borderRadius: 'var(--r-xs)',
                            border: '1px solid var(--border)',
                            fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
                            fontWeight: page === p ? 800 : 400,
                            background: page === p ? 'var(--primary)' : 'var(--card)',
                            color: page === p ? '#fff' : 'var(--muted-foreground)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.1s',
                          }}
                        >
                          {p + 1}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, padding: '5px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--card)', color: page >= totalPages - 1 ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
                      Fin →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Global recap */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                <TrendingDown size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Récapitulatif · Données du tableau
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px 22px' }}>
                {[
                  { label: 'Montant de départ au paiement 1', value: fmt(montant) + ' FCFA', color: 'var(--primary)' },
                  { label: 'Taux d\'intérêt annuel', value: taux.toFixed(2) + ' %', color: 'var(--foreground)' },
                  { label: 'Durée', value: `${dureeAns} ans (${dureeMonths} mois)`, color: 'var(--foreground)' },
                  { label: 'Nb paiements/an', value: '12', color: 'var(--foreground)' },
                  { label: 'Paiement calculé', value: fmt(mensualite) + ' FCFA', color: 'var(--primary)', bold: true },
                  { label: 'Montant total échéance', value: fmt(mensualite) + ' FCFA', color: 'var(--accent)' },
                  { label: 'Total intérêts versés', value: fmt(totalInterets) + ' FCFA', color: 'var(--accent)' },
                  { label: 'Coût total du crédit', value: fmt(totalPaye) + ' FCFA', color: 'var(--success)' },
                  { label: 'Date dernier paiement', value: schedule[schedule.length - 1]?.date ?? '—', color: 'var(--foreground)' },
                ].map(({ label, value, color, bold }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginBottom: '3px', lineHeight: 1.4 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: bold ? '1.0625rem' : '0.9rem', fontWeight: bold ? 900 : 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
