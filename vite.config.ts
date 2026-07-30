import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id : any) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
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
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
