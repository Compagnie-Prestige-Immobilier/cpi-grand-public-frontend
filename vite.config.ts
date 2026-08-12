import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


/**
 * SEO : résout `__SITE_URL__` dans index.html, génère robots.txt et
 * sitemap.xml, et injecte le marqueur d'analytique si un identifiant existe.
 *
 * robots.txt et sitemap.xml sont produits ici plutôt que déposés dans public/ :
 * ils contiennent l'adresse du site, et les fichiers de public/ sont copiés tels
 * quels, sans substitution — un jeton non résolu s'y retrouverait en production.
 */
function seoAndAnalytics(SITE_URL: string, GTAG_ID: string) {
  const robots = `# MONESPACE.CPI — Compagnie Prestige Immobilier
#
# Seuls l'accueil et les écrans de connexion / inscription ont vocation à être
# indexés. Tout le reste est un espace authentifié : les robots n'y accèdent pas
# (l'API répond 401 sans jeton), et ces chemins n'ont rien à faire dans un index.

User-agent: *
Allow: /$
Allow: /auth/
Disallow: /api/
Disallow: /auth/google/callback

Sitemap: ${SITE_URL}/sitemap.xml
`

  // Une seule URL indexable : l'application est un espace authentifié.
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

  return {
    name: 'cpi-seo-analytics',

    transformIndexHtml(html: string) {
      const out = html.replaceAll('__SITE_URL__', SITE_URL)
      if (!GTAG_ID) return out

      const tag = `
    <!-- Google Analytics (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      // anonymize_ip : les journaux ne conservent pas l'adresse IP complète.
      gtag('config', '${GTAG_ID}', { anonymize_ip: true });
    </script>
  `
      return out.replace('</head>', `${tag}</head>`)
    },

    generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },

    // En développement, servir les deux fichiers comme en production.
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: any) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          return res.end(robots)
        }
        if (req.url === '/sitemap.xml') {
          res.setHeader('Content-Type', 'application/xml; charset=utf-8')
          return res.end(sitemap)
        }
        next()
      })
    },
  }
}

// Base « / » par défaut (hébergement à la racine du domaine).
//
// `DEPLOY_TARGET=gh-pages` bascule sur le sous-chemin du dépôt. Plus aucun
// workflow ne le définit : l'application a besoin de l'API Laravel, qu'un
// hébergement statique comme GitHub Pages ne peut pas fournir. La bascule reste
// là pour un déploiement en sous-répertoire, mais attention si vous la
// réactivez — le retour OAuth Google teste `/auth/google/callback` en chemin
// absolu et ne fonctionnerait pas sous un préfixe.
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/cpi-immobilier/' : '/'

/**
 * Toute la configuration d'environnement passe par les fichiers `.env`.
 *
 * `loadEnv` est indispensable ici : `process.env` ne lit PAS les fichiers
 * `.env`. Seul le code applicatif y accède spontanément, via `import.meta.env`.
 * Sans cet appel, `.env.production` serait ignoré par ce fichier et le site
 * partirait en production avec les valeurs de développement.
 *
 * Fichiers lus, par priorité croissante (Vite) :
 *   .env  →  .env.<mode>  →  .env.local  →  .env.<mode>.local
 * `npm run build` utilise le mode « production », `npm run dev` « development ».
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')

  // Adresse publique du site : URL canonique, balises sociales, données
  // structurées, sitemap.xml. Une URL canonique fausse est pire que pas d'URL.
  const SITE_URL = (env.VITE_SITE_URL || 'https://monespace.cpi.sn').replace(/\/+$/, '')

  // Identifiant Google Analytics. Vide ⇒ aucun script injecté, aucune requête
  // vers Google, aucune balise morte dans la page.
  const GTAG_ID = env.VITE_GTAG_ID || ''

  // Backend visé par le proxy du serveur de développement. Sans effet sur le
  // build : en production, c'est VITE_API_URL que lit src/app/api/client.ts.
  const API_PROXY_TARGET = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  return {
    base,
    plugins: [
      seoAndAnalytics(SITE_URL, GTAG_ID),
      // `react()` : Fast Refresh en développement et transformation JSX.
      // `tailwindcss()` : Tailwind 4 s'intègre en greffon Vite, pas en PostCSS.
      // Les deux sont réellement utilisés (utilitaires Tailwind dans AppShell
      // et les grilles responsives, `@apply` dans globals.css).
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src/app'),
      },
    },
    server: {
      // Écoute sur toutes les interfaces : permet d'ouvrir l'application depuis
      // un autre poste ou un téléphone du réseau local.
      host: true,
      proxy: {
        '/api': {
          target: API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  }
})
