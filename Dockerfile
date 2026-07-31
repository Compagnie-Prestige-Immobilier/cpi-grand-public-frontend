# =============================================================================
# MONESPACE.CPI — production image (SPA statique)
#
#   nginx (edge) ── fichiers statiques Vite + proxy /api → conteneur backend
#
# Deux étages : le build Node reste dans le builder, l'image finale ne contient
# que nginx et le dossier dist/ — ni node_modules, ni sources, ni compilateurs.
# =============================================================================


# =============================================================================
# Étage 1 — builder : npm ci + vite build (tsc --noEmit inclus dans `build`)
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Couche dépendances d'abord : elle ne se reconstruit que si package*.json
# change, les modifications de code réutilisent le cache npm.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Adresse publique du site (URL canonique, sitemap, robots.txt) et identifiant
# Google Analytics — résolus AU BUILD par vite.config.ts. GTAG vide = aucun
# script de suivi injecté.
ARG VITE_SITE_URL=https://monespace.cpi.sn
ARG VITE_GTAG_ID=
ENV VITE_SITE_URL=${VITE_SITE_URL} \
    VITE_GTAG_ID=${VITE_GTAG_ID}

RUN npm run build


# =============================================================================
# Étage 2 — runtime : nginx seul
# =============================================================================
FROM nginx:stable-alpine

# Config principale + server block. Le server block est un TEMPLATE : l'image
# nginx officielle y substitue ${API_ORIGIN} au démarrage (envsubst sur
# /etc/nginx/templates/*.template → /etc/nginx/conf.d/*.conf).
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Origine du backend vers lequel /api est proxifié — le nom de conteneur du
# backend sur le réseau compose partagé. Surchargez-le dans docker-compose.yml.
ENV API_ORIGIN=http://cpi_api:80

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# /up est répondu par nginx lui-même (voir default.conf.template) — le check
# valide que nginx tourne et que la config a été rendue sans erreur.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/up > /dev/null || exit 1
