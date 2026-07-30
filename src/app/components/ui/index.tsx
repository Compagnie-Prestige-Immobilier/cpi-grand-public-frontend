/**
 * CPI Immobilier — Design System
 * Shared component library for the entire Client Dashboard.
 * All pages import from this file for visual consistency.
 */

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Clock, AlertCircle, AlertTriangle, Info,
  ChevronRight, ArrowUpRight, Upload, X, Eye, Download,
  Loader2, Inbox, FileX, WifiOff, Search,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// All values reference CSS variables so the design system respects the
// team's theme.css / global.css tokens automatically.
// ─────────────────────────────────────────────────────────────────────────────

export const DS = {
  // Aligné sur les tokens CSS du Design System (src/styles/globals.css) — source unique.
  radius: {
    sm:   'var(--r-sm)',
    md:   'var(--r-md)',
    lg:   'var(--r-lg)',
    xl:   'var(--r-xl)',
    full: 'var(--r-full)',
  },
  shadow: {
    sm:  'var(--elev-sm)',
    md:  'var(--elev-md)',
    lg:  'var(--elev-lg)',
    xl:  'var(--elev-xl)',
    hover: 'var(--shadow-hover)',
  },
  transition: {
    fast:   'all var(--dur-1) var(--ease-out)',
    base:   'all var(--dur-2) var(--ease-out)',
    slow:   'all var(--dur-3) var(--ease-out)',
    spring: 'all var(--dur-2) var(--ease-spring)',
  },
  status: {
    success: { color: 'var(--success)',           bg: 'rgba(26,107,68,0.10)'     },
    warning: { color: 'var(--accent)',             bg: 'rgba(200,146,26,0.10)'   },
    danger:  { color: 'var(--destructive)',        bg: 'rgba(192,57,43,0.10)'    },
    info:    { color: 'var(--chart-4)',            bg: 'rgba(46,110,196,0.10)'   },
    muted:   { color: 'var(--muted-foreground)',   bg: 'var(--muted)'            },
    primary: { color: 'var(--primary)',            bg: 'var(--secondary)'        },
  } as Record<string, { color: string; bg: string }>,
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'primary';

export function StatusBadge({
  children,
  variant = 'muted',
  dot = false,
  size = 'md',
}: {
  children: React.ReactNode;
  variant?: StatusVariant;
  dot?: boolean;
  size?: 'sm' | 'md';
}) {
  const { color, bg } = DS.status[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: size === 'sm' ? '2px 8px' : '4px 10px',
      borderRadius: DS.radius.full,
      background: bg, color,
      fontFamily: 'var(--font-sans)',
      fontSize: size === 'sm' ? '0.625rem' : '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON LIBRARY
// ─────────────────────────────────────────────────────────────────────────────

export type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'icon';

export function Btn({
  children,
  variant = 'ghost',
  size = 'md',
  icon,
  iconRight,
  disabled = false,
  loading = false,
  onClick,
  fullWidth = false,
  type,
  ariaLabel,
  style: extraStyle,
}: {
  children?: React.ReactNode;
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isOff = disabled || loading;

  const sizePad = { sm: '7px 14px', md: '10px 18px', lg: '12px 22px' }[size];
  const sizeFont = { sm: '0.8125rem', md: '0.875rem', lg: '0.9375rem' }[size];
  const iconSize = { sm: 13, md: 15, lg: 17 }[size];

  const bases: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: hov && !isOff ? 'var(--primary-hover)' : 'var(--primary)',
      color: 'var(--primary-foreground)', border: 'none',
      boxShadow: hov && !isOff ? DS.shadow.hover : DS.shadow.sm,
    },
    secondary: {
      background: hov && !isOff ? 'var(--muted)' : 'var(--secondary)',
      color: 'var(--primary)', border: '1px solid var(--border)',
    },
    outline: {
      background: hov && !isOff ? 'var(--secondary)' : 'transparent',
      color: hov && !isOff ? 'var(--primary)' : 'var(--foreground)',
      border: `1.5px solid ${hov && !isOff ? 'var(--primary)' : 'var(--border)'}`,
    },
    ghost: {
      background: hov && !isOff ? 'var(--secondary)' : 'transparent',
      color: hov && !isOff ? 'var(--primary)' : 'var(--foreground)',
      border: '1px solid transparent',
    },
    danger: {
      background: hov && !isOff ? 'rgba(185,28,28,0.12)' : 'rgba(185,28,28,0.07)',
      color: 'var(--destructive)',
      border: '1px solid rgba(185,28,28,0.22)',
    },
    success: {
      background: hov && !isOff ? 'rgba(26,107,68,0.14)' : 'rgba(26,107,68,0.09)',
      color: 'var(--success)',
      border: '1px solid rgba(26,107,68,0.22)',
    },
    icon: {
      background: hov && !isOff ? 'var(--secondary)' : 'transparent',
      color: hov && !isOff ? 'var(--primary)' : 'var(--muted-foreground)',
      border: '1px solid transparent',
      padding: size === 'sm' ? '6px' : size === 'md' ? '8px' : '10px',
      borderRadius: DS.radius.md,
    },
  };

  return (
    <button
      onClick={isOff ? undefined : onClick}
      disabled={isOff}
      type={type}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: children ? '7px' : '0',
        padding: variant === 'icon' ? undefined : sizePad,
        borderRadius: variant === 'primary' ? DS.radius.full : DS.radius.md,
        fontFamily: 'var(--font-sans)', fontSize: sizeFont, fontWeight: 600,
        cursor: isOff ? (loading ? 'progress' : 'not-allowed') : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: DS.transition.fast,
        transform: pressed && !isOff ? 'scale(0.97)' : 'scale(1)',
        width: fullWidth ? '100%' : undefined,
        whiteSpace: 'nowrap',
        ...bases[variant],
        ...extraStyle,
      }}
    >
      {loading
        ? <Loader2 size={iconSize} style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
        : icon && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>}
      {children}
      {!loading && iconRight && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 2 }}>{iconRight}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD — champ de formulaire moderne (icône, helper, focus/error/success)
// ─────────────────────────────────────────────────────────────────────────────

export function Field({
  label, value, onChange, placeholder, type = 'text', icon, helper, error, success,
  disabled = false, required = false, name, autoComplete, inputMode, id, style,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  helper?: string;
  error?: string;
  success?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search';
  id?: string;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const state: 'error' | 'success' | 'default' = error ? 'error' : success ? 'success' : 'default';
  const borderColor =
    state === 'error' ? 'var(--destructive)'
    : state === 'success' ? 'var(--success)'
    : focused ? 'var(--primary)' : 'var(--border)';
  const ring =
    state === 'error' ? '0 0 0 3px rgba(185,28,28,0.14)'
    : state === 'success' ? '0 0 0 3px rgba(26,107,68,0.14)'
    : focused ? 'var(--ring-focus)' : 'none';
  const autoId = id ?? name ?? label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label htmlFor={autoId} style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-label)', fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)',
        }}>
          {label}{required && <span style={{ color: 'var(--destructive)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        background: disabled ? 'var(--muted)' : 'var(--input-background)',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 'var(--r-md)',
        padding: '11px 13px',
        boxShadow: ring,
        transition: 'border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
        opacity: disabled ? 0.65 : 1,
      }}>
        {icon && <span style={{ display: 'flex', color: focused ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0, transition: 'color var(--dur-1) var(--ease-out)' }}>{icon}</span>}
        <input
          id={autoId} name={name} type={type} value={value} placeholder={placeholder}
          disabled={disabled} required={required} autoComplete={autoComplete} inputMode={inputMode}
          aria-invalid={state === 'error' || undefined}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', color: 'var(--foreground)',
          }}
        />
        {state === 'success' && <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />}
        {state === 'error' && <AlertCircle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} />}
      </div>
      {(error || success || helper) && (
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', lineHeight: 1.4,
          color: error ? 'var(--destructive)' : success ? 'var(--success)' : 'var(--muted-foreground)',
        }}>
          {error || success || helper}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART CARD
// ─────────────────────────────────────────────────────────────────────────────

export function SmartCard({
  children,
  style: extraStyle,
  hover = false,
  onClick,
  padding = '20px 24px',
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  hover?: boolean;
  onClick?: () => void;
  padding?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      onMouseEnter={() => hover && setHov(true)}
      onMouseLeave={() => hover && setHov(false)}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: DS.radius.xl,
        padding,
        boxShadow: hov ? DS.shadow.hover : DS.shadow.sm,
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        transition: DS.transition.base,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        ...extraStyle,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  action,
  iconBg,
  iconColor,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon && (
          <div style={{
            width: 36, height: 36, borderRadius: DS.radius.md, flexShrink: 0,
            background: iconBg || 'var(--secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: iconColor || 'var(--primary)',
          }}>
            {icon}
          </div>
        )}
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function CardDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 -24px' }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────────────────────

export function KPICard({
  icon,
  label,
  value,
  sub,
  trend,
  trendLabel,
  accentColor,
  accentBg,
  delay = 0,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accentColor: string;
  accentBg: string;
  delay?: number;
  onClick?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [hov, setHov] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  const trendColor = trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--destructive)' : 'var(--muted-foreground)';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--card)',
        border: `1px solid ${hov ? 'var(--border)' : 'rgba(26,58,110,0.07)'}`,
        borderRadius: DS.radius.xl,
        padding: '20px',
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: hov ? DS.shadow.hover : DS.shadow.sm,
        transition: DS.transition.base,
        opacity: visible ? 1 : 0,
        transform: visible ? (hov ? 'translateY(-3px)' : 'translateY(0)') : 'translateY(12px)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: DS.radius.md,
          background: accentBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accentColor, flexShrink: 0,
        }}>
          {icon}
        </div>
        {trend && trendLabel && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700,
            color: trendColor,
            background: trend === 'up' ? 'rgba(26,107,68,0.08)' : trend === 'down' ? 'rgba(192,57,43,0.08)' : 'var(--muted)',
            padding: '2px 7px', borderRadius: DS.radius.full,
          }}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
          </span>
        )}
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800,
          color: 'var(--foreground)', lineHeight: 1.1, letterSpacing: '-0.01em',
          marginBottom: 4,
        }}>
          {value}
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 600,
          color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 4 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO CARD
// ─────────────────────────────────────────────────────────────────────────────

export function HeroCard({
  eyebrow,
  title,
  subtitle,
  badge,
  progress,
  progressLabel,
  progressValue,
  stats,
  actions,
  photo,
  dark = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  progress?: number;
  progressLabel?: string;
  progressValue?: string;
  stats?: Array<{ label: string; value: string; icon?: React.ReactNode }>;
  actions?: React.ReactNode;
  photo?: string;
  dark?: boolean;
}) {
  const textMain = dark ? '#fff' : 'var(--foreground)';
  const textSub = dark ? 'rgba(255,255,255,0.55)' : 'var(--muted-foreground)';

  return (
    <div style={{
      borderRadius: DS.radius.xl, overflow: 'hidden', position: 'relative',
      background: photo ? undefined : 'var(--primary)',
      backgroundImage: photo ? `url(${photo})` : undefined,
      backgroundSize: 'cover', backgroundPosition: 'center',
      boxShadow: DS.shadow.xl,
    }}>
      {photo && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, rgba(11,25,41,0.95) 0%, rgba(26,58,110,0.85) 50%, rgba(26,58,110,0.55) 100%)' }} />
      )}
      {/* Decorative orb */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(200,146,26,0.07)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            {eyebrow && (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: dark ? 'rgba(255,255,255,0.4)' : 'var(--muted-foreground)', marginBottom: 8 }}>
                {eyebrow}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem,2.5vw,1.625rem)', fontWeight: 800, color: textMain, lineHeight: 1.2, margin: 0 }}>
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: textSub, margin: '0 0 20px' }}>
                {subtitle}
              </p>
            )}

            {progress !== undefined && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  {progressLabel && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: dark ? 'rgba(255,255,255,0.5)' : 'var(--muted-foreground)' }}>
                      {progressLabel}
                    </span>
                  )}
                  {progressValue && (
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {progressValue}
                    </span>
                  )}
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.15)', borderRadius: DS.radius.full, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: DS.radius.full, transition: 'width 1.4s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>
            )}

            {actions && <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>{actions}</div>}
          </div>

          {stats && stats.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: DS.radius.md,
                  minWidth: 200,
                  transition: DS.transition.fast,
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                >
                  {s.icon && <span style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{s.icon}</span>}
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', flex: 1 }}>{s.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer stats bar */}
      {stats && stats.length === 0 && null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

export function TimelineItem({
  icon,
  iconColor,
  iconBg,
  title,
  sub,
  date,
  time,
  author,
  last = false,
  delay = 0,
}: {
  icon: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  title: string;
  sub?: string;
  date?: string;
  time?: string;
  author?: string;
  last?: boolean;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div style={{ display: 'flex', gap: 14, opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-8px)', transition: `opacity 0.3s ease ${delay}ms, transform 0.3s ease ${delay}ms` }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: iconBg || 'var(--secondary)',
          border: `1.5px solid ${iconColor ? iconColor + '22' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor || 'var(--primary)',
        }}>
          {icon}
        </div>
        {!last && <div style={{ width: 1.5, flex: 1, minHeight: 14, background: 'var(--border)', marginTop: 4 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 20, flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--foreground)', fontWeight: 500, lineHeight: 1.5 }}>
          {title}
        </div>
        {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {(date || time) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: DS.radius.sm, background: 'var(--secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
              {date}{time ? ` · ${time}` : ''}
            </span>
          )}
          {author && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>
              {author}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION ROW  (list-style action item)
// ─────────────────────────────────────────────────────────────────────────────

export function ActionRow({
  icon,
  label,
  description,
  iconBg,
  iconColor,
  variant = 'default',
  onClick,
  rightSlot,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  iconBg?: string;
  iconColor?: string;
  variant?: 'default' | 'primary' | 'danger';
  onClick?: () => void;
  rightSlot?: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);

  const labelColor = variant === 'primary' ? 'var(--primary)' : variant === 'danger' ? 'var(--destructive)' : 'var(--foreground)';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', textAlign: 'left', padding: '13px 16px',
        borderRadius: DS.radius.lg,
        border: `1px solid ${hov ? (variant === 'primary' ? 'rgba(26,58,110,0.2)' : 'var(--border)') : 'transparent'}`,
        background: hov ? (variant === 'primary' ? 'var(--secondary)' : 'var(--input-background)') : 'transparent',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.99)' : 'scale(1)',
        transition: DS.transition.fast,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: DS.radius.md, flexShrink: 0,
        background: iconBg || (variant === 'primary' ? 'var(--secondary)' : 'var(--input-background)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor || (variant === 'primary' ? 'var(--primary)' : variant === 'danger' ? 'var(--destructive)' : 'var(--muted-foreground)'),
        transition: DS.transition.fast,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 600, color: labelColor, lineHeight: 1.3 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {description}
          </div>
        )}
      </div>
      {rightSlot || (
        <ChevronRight size={14} style={{
          color: 'var(--muted-foreground)', flexShrink: 0,
          opacity: hov ? 1 : 0.35,
          transform: hov ? 'translateX(2px)' : 'translateX(0)',
          transition: DS.transition.fast,
        }} />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD / DOCUMENT CARD
// ─────────────────────────────────────────────────────────────────────────────

export type DocStatus = 'accepte' | 'en-attente' | 'verification' | 'refuse' | 'a-remplacer' | 'non-depose';

const DOC_STATUS_CFG: Record<DocStatus, { label: string; variant: StatusVariant; icon: React.ComponentType<{ size?: number }> }> = {
  'accepte':      { label: 'Validé',       variant: 'success', icon: CheckCircle2 },
  'en-attente':   { label: 'En attente',   variant: 'warning', icon: Clock        },
  'verification': { label: 'En cours',     variant: 'info',    icon: Loader2      },
  'refuse':       { label: 'Refusé',       variant: 'danger',  icon: X            },
  'a-remplacer':  { label: 'À remplacer',  variant: 'danger',  icon: AlertCircle  },
  'non-depose':   { label: 'Non déposé',   variant: 'muted',   icon: Upload       },
};

export function UploadCard({
  label,
  status,
  date,
  size,
  onUpload,
  onPreview,
  onDownload,
}: {
  label: string;
  status: DocStatus;
  date?: string;
  size?: string;
  onUpload?: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const cfg = DOC_STATUS_CFG[status];
  const StatusIcon = cfg.icon;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--card)',
        border: `1px solid ${hov ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: DS.radius.lg,
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: DS.transition.base,
        boxShadow: hov ? DS.shadow.md : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 3 }}>
            {label}
          </div>
          {date && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{date}{size ? ` · ${size}` : ''}</div>}
        </div>
        <StatusBadge variant={cfg.variant} size="sm">
          <StatusIcon size={10} style={{ marginRight: 2 }} />
          {cfg.label}
        </StatusBadge>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {status !== 'non-depose' && onPreview && (
          <Btn variant="ghost" size="sm" icon={<Eye size={12} />} onClick={onPreview}>Aperçu</Btn>
        )}
        {status !== 'non-depose' && onDownload && (
          <Btn variant="ghost" size="sm" icon={<Download size={12} />} onClick={onDownload}>Télécharger</Btn>
        )}
        {onUpload && (
          <Btn
            variant={status === 'a-remplacer' || status === 'refuse' ? 'primary' : 'outline'}
            size="sm"
            icon={<Upload size={12} />}
            onClick={onUpload}
          >
            {status === 'non-depose' ? 'Déposer' : 'Remplacer'}
          </Btn>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA THUMB (Gallery)
// ─────────────────────────────────────────────────────────────────────────────

export function MediaThumb({
  background,
  label,
  tag,
  date,
  onView,
}: {
  background: string;
  label: string;
  tag?: string;
  date?: string;
  onView?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onView}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        aspectRatio: '4/3', borderRadius: DS.radius.lg, overflow: 'hidden',
        background, position: 'relative', cursor: 'pointer',
        transform: hov ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hov ? DS.shadow.xl : 'none',
        transition: DS.transition.base,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: hov ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0)', transition: DS.transition.fast, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hov && <Eye size={22} style={{ color: 'rgba(255,255,255,0.9)' }} />}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {tag && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 4 }}>{tag}</span>}
          {date && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.5625rem', color: 'rgba(255,255,255,0.5)' }}>{date}</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────────────────────────────

type EmptyType = 'empty' | 'no-docs' | 'no-notifs' | 'no-chantier' | 'error' | 'offline' | 'no-results';

const EMPTY_CFG: Record<EmptyType, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; title: string; sub: string }> = {
  'empty':       { icon: Inbox,   title: 'Aucune donnée',           sub: "Rien à afficher pour le moment."                  },
  'no-docs':     { icon: FileX,   title: 'Aucun document',          sub: "Vos documents apparaîtront ici une fois déposés." },
  'no-notifs':   { icon: Inbox,   title: 'Aucune notification',     sub: "Vous êtes à jour. Revenez plus tard."             },
  'no-chantier': { icon: Search,  title: 'Chantier non démarré',    sub: "Le suivi démarre après la signature."             },
  'error':       { icon: AlertTriangle, title: 'Une erreur est survenue', sub: "Veuillez réessayer ou contacter le support." },
  'offline':     { icon: WifiOff, title: 'Connexion indisponible',  sub: "Vérifiez votre connexion internet."               },
  'no-results':  { icon: Search,  title: 'Aucun résultat',          sub: "Essayez d'autres mots-clés."                     },
};

export function EmptyState({
  type = 'empty',
  title: customTitle,
  sub: customSub,
  action,
}: {
  type?: EmptyType;
  title?: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  const { icon: Icon, title, sub } = EMPTY_CFG[type];
  return (
    <div className="cpi-scale-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: DS.radius.lg, background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Icon size={22} style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{customTitle || title}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--muted-foreground)', maxWidth: 280, lineHeight: 1.55 }}>{customSub || sub}</div>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  color = 'var(--primary)',
  height = 7,
  animated = true,
  showLabel = false,
}: {
  value: number;
  color?: string;
  height?: number;
  animated?: boolean;
  showLabel?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height, background: 'var(--muted)', borderRadius: DS.radius.full, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.max(0, Math.min(100, value))}%`,
          background: color, borderRadius: DS.radius.full,
          transition: animated ? 'width 1.2s cubic-bezier(0.4,0,0.2,1)' : 'none',
        }} />
      </div>
      {showLabel && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)', flexShrink: 0, minWidth: 34, textAlign: 'right' }}>
          {value}%
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

export function SectionHeader({
  icon,
  title,
  subtitle,
  action,
  iconBg,
  iconColor,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <div style={{ width: 34, height: 34, borderRadius: DS.radius.md, background: iconBg || 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor || 'var(--primary)', flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{title}</div>
          {subtitle && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE ALERT
// ─────────────────────────────────────────────────────────────────────────────

export function InlineAlert({
  type = 'info',
  children,
}: {
  type?: 'info' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const cfgs = {
    info:    { color: 'var(--chart-4)',   bg: 'rgba(46,110,196,0.08)',  border: 'rgba(46,110,196,0.2)',  icon: Info          },
    success: { color: 'var(--success)',   bg: 'rgba(26,107,68,0.07)',   border: 'rgba(26,107,68,0.2)',   icon: CheckCircle2  },
    warning: { color: 'var(--accent)',    bg: 'rgba(200,146,26,0.07)',  border: 'rgba(200,146,26,0.2)',  icon: AlertTriangle },
    danger:  { color: 'var(--destructive)', bg: 'rgba(192,57,43,0.07)', border: 'rgba(192,57,43,0.2)',  icon: AlertCircle   },
  };
  const { color, bg, border, icon: Icon } = cfgs[type];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: bg, border: `1px solid ${border}`, borderRadius: DS.radius.md }}>
      <div style={{ width: 26, height: 26, borderRadius: DS.radius.sm, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={13} style={{ color }} />
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: 'var(--foreground)', lineHeight: 1.6, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTER ANIMATION HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const lastTarget = useRef<number | null>(null);
  useEffect(() => {
    if (lastTarget.current === target) return;
    lastTarget.current = target;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}
