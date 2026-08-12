import { createRoot } from "react-dom/client";
import { QueryCache, MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { Toaster, toast } from "sonner";
import App from "./app/App.tsx";
import { apiErrorMessage } from "./app/api/client.ts";
import "./styles/index.css";

/**
 * Client React Query.
 *
 * Il était jusqu'ici construit sans aucune option : chaque montage de composant
 * refaisait ses requêtes (`staleTime: 0`), un retour d'onglet relançait tout le
 * tableau de bord, et surtout **aucune erreur n'était signalée**. Une requête
 * qui échouait laissait un écran vide, sans message ni possibilité de comprendre.
 */
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      // Une requête peut prendre en charge son propre affichage d'erreur
      // (AppShell le fait pour le chargement initial). `meta.silencieux`
      // évite alors le doublon : une bannière plein écran *et* un toast.
      if (query.meta?.silencieux) return;
      toastErreur(error);
    },
  }),
  mutationCache: new MutationCache({
    onError(error, _vars, _ctx, mutation) {
      if (mutation.meta?.silencieux) return;
      toastErreur(error);
    },
  }),
  defaultOptions: {
    queries: {
      // 30 s : assez pour qu'une navigation aller-retour ne relance rien,
      // assez court pour qu'un dossier validé par un agent apparaisse vite.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Une seule reprise. Au-delà, l'utilisateur attend sans le savoir ;
      // mieux vaut lui montrer l'erreur et le bouton « Réessayer ».
      retry: 1,
      retryDelay: attempt => Math.min(1_000 * 2 ** attempt, 8_000),
      // Le retour sur l'onglet ne doit pas rejouer l'intégralité des requêtes :
      // sur un tableau de bord agent, c'est une dizaine d'appels pour rien.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      // Une mutation ne se rejoue jamais toute seule : décaisser deux fois une
      // tranche coûte de l'argent réel.
      retry: 0,
    },
  },
});

/** Un message par erreur, jamais deux d'affilée pour la même cause. */
let dernierMessage = '';
let dernierInstant = 0;
function toastErreur(error: unknown) {
  const message = apiErrorMessage(error, "Une erreur est survenue. Réessayez dans un instant.");
  const maintenant = Date.now();
  // Cinq requêtes qui échouent ensemble parce que le serveur est tombé ne
  // doivent pas empiler cinq bandeaux identiques.
  if (message === dernierMessage && maintenant - dernierInstant < 4_000) return;
  dernierMessage = message;
  dernierInstant = maintenant;
  toast.error(message);
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Canal unique de retour utilisateur : succès, erreurs de mutation,
          session expirée. Sans lui, les échecs restaient silencieux. */}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  </BrowserRouter>,
);
