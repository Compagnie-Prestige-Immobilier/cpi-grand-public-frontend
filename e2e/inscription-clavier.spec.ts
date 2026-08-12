import { test, expect } from '@playwright/test';
import { stubApi, UTILISATEUR } from './fixtures';

/**
 * FE-04 — l'inscription au clavier, sans jamais toucher la souris.
 *
 * Ce parcours est ici parce qu'il a été CASSÉ : la case « J'accepte les
 * conditions générales d'utilisation » était un `<div onClick>`. Ni focusable,
 * ni actionnable au clavier, sans rôle ARIA. Elle conditionne pourtant l'envoi
 * du formulaire. Résultat : un utilisateur au clavier — donc une partie des
 * utilisateurs de lecteur d'écran, et quiconque n'utilise pas de souris — ne
 * pouvait pas créer de compte. Du tout.
 *
 * Le test n'émet donc AUCUN clic. Tout passe par Tab, Espace et Entrée. C'est
 * la seule façon d'attraper cette régression : à la souris, l'écran a toujours
 * fonctionné, et c'est bien pour cela que le défaut a survécu.
 */
test.describe("Inscription — au clavier uniquement", () => {
  test("crée un compte sans jamais utiliser la souris", async ({ page }) => {
    const envois: { method: string; url: string; postData: string | null }[] = [];

    await stubApi(page, {
      espion: r => envois.push({ method: r.method, url: r.url, postData: r.postData }),
      reponses: {
        '/api/auth/register': { user: UTILISATEUR, role: 'client', permissions: [], token: 'jeton-neuf' },
      },
    });

    await page.goto('/inscription');

    // ── Étape 1 : choix du profil ────────────────────────────────────────────
    // Les trois cartes étaient de simples `<div onClick>`. Elles portent
    // maintenant `role="button"` et `tabIndex`, donc la tabulation les atteint.
    const carteFonctionnaire = page.getByRole('button', { name: /fonctionnaire/i }).first();
    await expect(carteFonctionnaire).toBeVisible();

    await carteFonctionnaire.focus();
    await expect(carteFonctionnaire).toBeFocused();
    await page.keyboard.press('Enter');

    // ── Étape 2 : le formulaire ──────────────────────────────────────────────
    await expect(page.getByRole('button', { name: /créer mon compte/i })).toBeVisible();

    // `fill` place la valeur sans clic, comme le ferait une saisie au clavier.
    await page.getByLabel(/nom complet/i).fill('Awa Ndiaye');
    await page.getByLabel(/e-mail/i).fill(UTILISATEUR.email);
    await page.getByLabel(/téléphone/i).fill('77 000 00 00');
    await page.getByLabel(/ministère|employeur/i).fill('Ministère de l’Éducation');
    await page.getByLabel(/revenus/i).selectOption({ index: 1 });
    await page.getByLabel(/^mot de passe/i).fill('Motdepasse1!');
    await page.getByLabel(/confirmer/i).fill('Motdepasse1!');

    // ── Le point qui a échoué : la case CGU ─────────────────────────────────
    const cgu = page.getByRole('checkbox');
    await expect(cgu).toBeVisible();

    // Atteignable au clavier…
    await cgu.focus();
    await expect(cgu).toBeFocused();
    expect(await cgu.getAttribute('aria-checked')).toBe('false');

    // …et actionnable par la barre d'espace, comme toute case à cocher.
    await page.keyboard.press('Space');
    await expect(cgu).toHaveAttribute('aria-checked', 'true');

    // ── Envoi ────────────────────────────────────────────────────────────────
    const bouton = page.getByRole('button', { name: /créer mon compte/i });
    await bouton.focus();
    await page.keyboard.press('Enter');

    await expect
      .poll(() => envois.filter(e => e.method === 'POST' && e.url.includes('/api/auth/register')).length)
      .toBeGreaterThan(0);

    const inscription = envois.find(e => e.url.includes('/api/auth/register'));
    expect(inscription?.postData).toContain(UTILISATEUR.email);
  });

  test("refuse l'envoi tant que les CGU ne sont pas acceptées", async ({ page }) => {
    const envois: string[] = [];
    await stubApi(page, { espion: r => envois.push(`${r.method} ${new URL(r.url).pathname}`) });

    await page.goto('/inscription');
    await page.getByRole('button', { name: /fonctionnaire/i }).first().focus();
    await page.keyboard.press('Enter');

    await page.getByLabel(/nom complet/i).fill('Awa Ndiaye');
    await page.getByLabel(/e-mail/i).fill(UTILISATEUR.email);
    await page.getByLabel(/téléphone/i).fill('77 000 00 00');
    await page.getByLabel(/ministère|employeur/i).fill('Ministère');
    await page.getByLabel(/revenus/i).selectOption({ index: 1 });
    await page.getByLabel(/^mot de passe/i).fill('Motdepasse1!');
    await page.getByLabel(/confirmer/i).fill('Motdepasse1!');

    // Case volontairement laissée décochée.
    await page.getByRole('button', { name: /créer mon compte/i }).focus();
    await page.keyboard.press('Enter');

    // Le refus doit être EXPLIQUÉ, pas seulement silencieux : un bouton qui ne
    // réagit pas est indiscernable d'une application en panne.
    await expect(page.getByText(/conditions générales/i).last()).toBeVisible();
    expect(envois.filter(e => e.includes('/api/auth/register'))).toHaveLength(0);
  });
});
