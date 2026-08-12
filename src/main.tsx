  import { createRoot } from "react-dom/client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { Toaster } from "sonner";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  const queryClient = new QueryClient();

  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Canal unique de retour utilisateur : succès, erreurs de mutation,
          session expirée. Sans lui, les échecs restaient silencieux. */}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>,
  );
