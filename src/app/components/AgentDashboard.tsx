import type { AuthUser } from '../App';
import AgentDossiersReels from './AgentDossiersReels';
import DocumentsClientsModule from './DocumentsClientsModule';
import DocumentsAdminModule from './DocumentsAdminModule';
import DecaissementsModule from './DecaissementsModule';
import NotificationsModule from './NotificationsModule';
import HistoriqueModule from './HistoriqueModule';

interface Props { user: AuthUser; activeNav?: string }

// Le dashboard Agent CPI sert les vues dossiers/clients depuis les VRAIES données
// (registre des clients + contextes docState/cpiDocs) via AgentDossiersReels, et
// délègue les modules partagés. Aucune donnée fictive.
export default function AgentDashboard({ user, activeNav = 'dashboard' }: Props) {
  if (activeNav === 'dashboard') return <AgentDossiersReels agentName={user.name} mode="dashboard" />;
  if (activeNav === 'dossiers')  return <AgentDossiersReels agentName={user.name} mode="actifs" />;
  if (activeNav === 'traites')   return <AgentDossiersReels agentName={user.name} mode="traites" />;
  if (activeNav === 'clients')   return <AgentDossiersReels agentName={user.name} mode="clients" />;

  const MODULE_NAVS = ['documents-clients', 'documents-admin', 'decaissements', 'notifications-agent', 'historique'];
  if (MODULE_NAVS.includes(activeNav ?? '')) {
    return <AgentModuleView activeNav={activeNav!} agentName={user.name} />;
  }
  return null;
}

function AgentModuleView({ activeNav, agentName }: { activeNav: string; agentName: string }) {
  // Les modules gèrent l'ensemble des clients (ou choisissent le destinataire
  // dans leur propre formulaire) — pas de sélecteur de client global.
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {activeNav === 'documents-clients'   && <DocumentsClientsModule agentName={agentName} />}
      {activeNav === 'documents-admin'     && <DocumentsAdminModule agentName={agentName} />}
      {activeNav === 'decaissements'       && <DecaissementsModule />}
      {activeNav === 'notifications-agent' && <NotificationsModule agentName={agentName} />}
      {activeNav === 'historique'          && <HistoriqueModule />}
    </div>
  );
}
