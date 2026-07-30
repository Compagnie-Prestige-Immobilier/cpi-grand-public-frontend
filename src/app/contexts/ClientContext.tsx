import React, { createContext, useContext, useState } from 'react';
import type { ClientSummary } from '../data/demoStore';

export type { ClientSummary };

interface ClientContextValue {
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  allClients: ClientSummary[];
  isLocked: boolean;
}

const ClientContext = createContext<ClientContextValue>({
  selectedClientId: 'c-none',
  setSelectedClientId: () => {},
  allClients: [],
  isLocked: false,
});

interface ProviderProps {
  children: React.ReactNode;
  initialId?: string;
  locked?: boolean;
  allClients: ClientSummary[];
}

export function ClientProvider({ children, initialId = 'c-none', locked = false, allClients }: ProviderProps) {
  const [selectedClientId, setSelectedClientIdRaw] = useState(initialId);

  const setSelectedClientId = (id: string) => {
    if (!locked) setSelectedClientIdRaw(id);
  };

  return (
    <ClientContext.Provider value={{ selectedClientId, setSelectedClientId, allClients, isLocked: locked }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext(): ClientContextValue {
  return useContext(ClientContext);
}
