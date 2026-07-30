/**
 * NavigationContext — global programmatic navigation for the Client Dashboard.
 *
 * Any component anywhere in the tree can call `useNavigate()` to change the
 * active page without threading callbacks through props.
 *
 * Usage:
 *   const { navigate, activeNav, activeSub } = useNavigate();
 *   navigate('mon-dossier');
 *   navigate('mon-dossier', 'bancaires');   // opens dossier → relevés bancaires sub
 *   navigate('mon-chantier', 'tranche-2'); // opens chantier → tranche detail
 */

import { createContext, useContext, useState } from 'react';

export interface NavTarget {
  page: string;
  sub?: string;
}

interface NavigationContextValue {
  activeNav: string;
  activeSub?: string;
  navigate: (page: string, sub?: string) => void;
  /** Convenience: go back to the previous page */
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({
  children,
  defaultPage = 'dashboard',
}: {
  children: React.ReactNode;
  defaultPage?: string;
}) {
  const [history, setHistory] = useState<NavTarget[]>([{ page: defaultPage }]);
  const current = history[history.length - 1];

  function navigate(page: string, sub?: string) {
    setHistory(prev => [...prev, { page, sub }]);
  }

  function goBack() {
    setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  return (
    <NavigationContext.Provider
      value={{ activeNav: current.page, activeSub: current.sub, navigate, goBack }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigate() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigate must be used within NavigationProvider');
  return ctx;
}
