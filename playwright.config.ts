import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright était installé avec zéro test. Cette configuration en fait un
 * outil réellement exécutable — `npm run test:e2e` — et couvre les trois
 * parcours dont l'échec coûterait le plus cher : s'inscrire, déposer une
 * pièce, signer un document.
 *
 * ── Les tests ne parlent PAS au backend Laravel ─────────────────────────────
 * Chaque test intercepte `**\/api/**` et sert ses propres réponses
 * (e2e/fixtures.ts). Trois raisons :
 *
 *  1. Ils tournent en intégration continue sans base de données, sans PHP et
 *     sans jeu de données à maintenir.
 *  2. Ils vérifient ce qu'ils prétendent vérifier — le comportement de
 *     l'interface — et non la disponibilité d'un serveur.
 *  3. Ils peuvent affirmer ce que le front ENVOIE : c'est ainsi que le test de
 *     signature constate que la case de consentement et le nom saisi ne sont
 *     transmis nulle part (voir e2e/signature.spec.ts).
 *
 * Le serveur de développement est démarré automatiquement ; `reuseExistingServer`
 * évite d'en lancer un second si l'un tourne déjà en local.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:5173',
    // Trace et capture uniquement sur échec : un échec en CI doit être
    // diagnosticable sans avoir à le reproduire localement.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
