import { test, expect } from '@playwright/test';
import { stubApi, ouvrirSessionClient, DOC_A_SIGNER, DOC_SANS_FICHIER } from './fixtures';

/**
 * Signature électronique — le parcours le plus lourd de conséquences.
 *
 * Ce que ces tests verrouillent, dans l'ordre de gravité du défaut d'origine :
 *
 *  1. Le document affiché est le VRAI fichier (`fileUrl`). L'écran fabriquait
 *     auparavant un texte de contrat par interpolation, côté navigateur, et
 *     c'était ce texte que le client relisait avant de signer.
 *  2. Sans fichier joint, la signature est impossible.
 *  3. La confirmation « Document signé » suit la réponse du serveur. Elle était
 *     déclenchée par un `setTimeout` de 1 100 ms et s'affichait même quand
 *     l'API refusait la signature.
 *
 * Le dernier test consigne une limite CONNUE et non corrigeable côté frontend :
 * l'API ne reçoit que l'identifiant du document. Ni le nom du signataire, ni
 * l'horodatage, ni l'adresse IP, ni l'empreinte du fichier signé ne sont
 * transmis — la persistance de ces éléments demande une migration backend qui
 * n'est pas faite. Le test le constate explicitement pour qu'on ne puisse pas
 * croire le problème résolu, et il échouera le jour où le contrat changera.
 */
test.describe('Signature électronique d’un document CPI', () => {
  test('affiche le fichier réel, puis signe après acceptation du serveur', async ({ page }) => {
    const envois: { method: string; url: string; postData: string | null }[] = [];

    await stubApi(page, {
      espion: r => envois.push({ method: r.method, url: r.url, postData: r.postData }),
      reponses: {
        [`/api/client/mes-documents-cpi/${DOC_A_SIGNER.id}/sign`]: { ...DOC_A_SIGNER, status: 'signe' },
      },
    });

    // Le fichier est hébergé sur un domaine factice : on le sert nous-mêmes,
    // sinon l'iframe resterait vide et le test mesurerait le réseau.
    await page.route('**/contrat-signe.pdf', route =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 contrat' }),
    );

    await ouvrirSessionClient(page, '/dossier');

    await page.getByRole('button', { name: /^signer$/i }).first().click();
    await expect(page.getByText(/signature électronique/i).first()).toBeVisible();

    // ── 1. Le document affiché est bien le fichier du serveur ───────────────
    await page.getByRole('button', { name: /lire le document/i }).click();
    const visionneuse = page.locator(`iframe[title*="${DOC_A_SIGNER.nom}"]`);
    await expect(visionneuse).toHaveAttribute('src', DOC_A_SIGNER.fileUrl!);

    // ── 2. Le consentement conditionne la signature ─────────────────────────
    const signer = page.getByRole('button', { name: /signer le document/i });
    await expect(signer).toBeDisabled();

    const consentement = page.getByRole('checkbox');
    await consentement.focus();
    await page.keyboard.press('Space');
    await expect(signer).toBeEnabled();

    // ── 3. La confirmation vient du serveur ─────────────────────────────────
    await signer.click();
    await expect(page.getByText(/document signé/i)).toBeVisible();

    expect(envois.filter(e => e.method === 'POST' && e.url.includes('/sign'))).toHaveLength(1);
  });

  test('refuse de signer un document sans fichier joint', async ({ page }) => {
    const envois: string[] = [];
    await stubApi(page, {
      espion: r => envois.push(`${r.method} ${new URL(r.url).pathname}`),
      reponses: { '/api/client/mes-documents-cpi': [DOC_SANS_FICHIER] },
    });

    await ouvrirSessionClient(page, '/dossier');
    await page.getByRole('button', { name: /^signer$/i }).first().click();

    await expect(page.getByText(/pas encore de fichier joint|dès que votre conseiller CPI aura joint/i).first())
      .toBeVisible();
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await expect(page.getByRole('button', { name: /signer le document/i })).toBeDisabled();

    expect(envois.filter(e => e.includes('/sign'))).toHaveLength(0);
  });

  test('un refus du serveur n’est jamais présenté comme une signature réussie', async ({ page }) => {
    await stubApi(page, {
      reponses: {
        [`/api/client/mes-documents-cpi/${DOC_A_SIGNER.id}/sign`]: (route: import('@playwright/test').Route) =>
          route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Ce document n’est pas en attente de signature. Statut actuel : brouillon.',
            }),
          }),
      },
    });
    await page.route('**/contrat-signe.pdf', route =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' }),
    );

    await ouvrirSessionClient(page, '/dossier');
    await page.getByRole('button', { name: /^signer$/i }).first().click();
    await page.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: /signer le document/i }).click();

    await expect(page.getByText(/pas en attente de signature/i)).toBeVisible();
    await expect(page.getByText(/document signé/i)).toHaveCount(0);
  });

  test('LIMITE CONNUE : le serveur ne reçoit que l’identifiant du document', async ({ page }) => {
    let corpsSignature: string | null | undefined;

    await stubApi(page, {
      espion: r => { if (r.url.includes('/sign')) corpsSignature = r.postData; },
      reponses: {
        [`/api/client/mes-documents-cpi/${DOC_A_SIGNER.id}/sign`]: { ...DOC_A_SIGNER, status: 'signe' },
      },
    });
    await page.route('**/contrat-signe.pdf', route =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' }),
    );

    await ouvrirSessionClient(page, '/dossier');
    await page.getByRole('button', { name: /^signer$/i }).first().click();
    await page.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: /signer le document/i }).click();
    await expect(page.getByText(/document signé/i)).toBeVisible();

    // Le corps est vide : l'identité du signataire est celle du jeton, et rien
    // d'autre n'est transmis. Tant que la migration backend n'est pas faite —
    // horodatage propre à la signature, adresse IP, empreinte SHA-256 du
    // fichier signé —, la signature n'est PAS opposable. Ce test le documente ;
    // il devra être réécrit en même temps que le contrat d'API.
    expect(corpsSignature ?? '').toBe('');
  });
});
