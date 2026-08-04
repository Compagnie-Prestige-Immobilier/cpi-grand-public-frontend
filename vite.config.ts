import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: any) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(import.meta.dirname, 'src/assets', filename)
      }
    },
  }
}

/**
 * Adresse publique du site, en UN SEUL endroit : elle alimente l'URL canonique,
 * les balises de partage social, les données structurées et sitemap.xml.
 *
 * ⚠️ À faire pointer sur le domaine de production. Une URL canonique fausse est
 * pire que pas d'URL du tout — les moteurs suivraient une adresse inexistante.
 * Se définit aussi au build : `VITE_SITE_URL=https://… npm run build`.
 */
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://monespace.cpi.sn').replace(/\/+$/, '')

/**
 * Identifiant de mesure Google Analytics (« G-XXXXXXXXXX »).
 *
 * Tant qu'il n'est pas défini, AUCUN script de suivi n'est injecté : pas de
 * requête vers Google, rien à consentir, et aucune balise morte dans la page.
 * Le jour où l'identifiant est connu : `VITE_GTAG_ID=G-… npm run build`.
 */
const GTAG_ID = process.env.VITE_GTAG_ID ?? ''

/**
 * Backend Laravel visé par le serveur de développement.
 *
 * Le client API appelle `/api` en relatif : le proxy ci-dessous réécrit vers
 * cette adresse, donc le navigateur ne voit qu'une seule origine et la question
 * du CORS ne se pose jamais. Changer d'adresse de backend = changer cette
 * valeur (ou `VITE_API_PROXY_TARGET`), rien d'autre.
 */
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://192.168.1.241:8000'

/**
 * SEO : résout `__SITE_URL__` dans index.html, génère robots.txt et
 * sitemap.xml, et injecte le marqueur d'analytique si un identifiant existe.
 *
 * robots.txt et sitemap.xml sont produits ici plutôt que déposés dans public/ :
 * ils contiennent l'adresse du site, et les fichiers de public/ sont copiés tels
 * quels, sans substitution — un jeton non résolu s'y retrouverait en production.
 */
function seoAndAnalytics() {
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

// Base « / » par défaut (Hostinger / hébergement racine).
//
// `DEPLOY_TARGET=gh-pages` bascule sur le sous-chemin du dépôt. Plus aucun
// workflow ne le définit : l'application a besoin de l'API Laravel, qu'un
// hébergement statique comme GitHub Pages ne peut pas fournir. La bascule reste
// là pour un déploiement en sous-répertoire, mais attention si vous la
// réactivez — le retour OAuth Google teste `/auth/google/callback` en chemin
// absolu et ne fonctionnerait pas sous un préfixe.
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/cpi-immobilier/' : '/'

export default defineConfig({
  base,
  plugins: [
    figmaAssetResolver(),
    seoAndAnalytics(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src/app'),
    },
  },
  server: {
    // Écoute sur toutes les interfaces : le backend est joignable sur l'adresse
    // réseau de la machine, le serveur de développement doit l'être aussi pour
    // qu'un autre poste ou un téléphone du réseau puisse ouvrir l'application.
    host: true,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
