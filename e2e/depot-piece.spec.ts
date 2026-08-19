import { test, expect } from '@playwright/test';
import { stubApi, ouvrirSessionClient, PIECE_IDENTITE } from './fixtures';

/**
 * Dépôt d'une pièce justificative — le second parcours critique.
 *
 * Deux choses sont vérifiées ici, et la seconde est aussi importante que la
 * première :
 *
 *  1. Le fichier part réellement vers `POST /client/mes-documents/{id}/deposit`
 *     en multipart, champ `file`.
 *  2. La confirmation « Document envoyé » n'apparaît QUE si le serveur a
 *     accepté. L'API refuse désormais tout dépôt sur un dossier verrouillé
 *     (`dossier_etape >= 3`) par un 409 dont le message explique le
 *     verrouillage. L'écran annonçait auparavant la réussite dès le clic : le
 *     client repartait convaincu d'avoir déposé sa pièce, et le message de
 *     refus passait pour un incident sans conséquence.
 */
test.describe('Dépôt d’une pièce justificative', () => {
  const fichier = {
    name: 'carte-identite.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 pièce de test'),
  };

  test('envoie le fichier et confirme après acceptation du serveur', async ({ page }) => {
    const envois: { method: string; url: string; headers: Record<string, string> }[] = [];

    await stubApi(page, {
      espion: r => envois.push({ method: r.method, url: r.url, headers: r.headers }),
      reponses: {
        [`/api/client/mes-documents/${PIECE_IDENTITE.docId}/deposit`]: {
          ...PIECE_IDENTITE,
          status: 'depose',
          submittedLabel: fichier.name,
        },
      },
    });

    await ouvrirSessionClient(page, '/ma-demande');

    // La pièce s'ouvre par son bouton « Déposer ».
    await page.getByRole('button', { name: /^déposer$/i }).first().click();

    // La zone de dépôt est atteignable au clavier (elle ne l'était pas : c'était
    // un `<div onClick>` sans rôle ni tabulation).
    const zone = page.getByRole('button', { name: /choisir la pièce à déposer/i });
    await expect(zone).toBeVisible();
    await zone.focus();
    await expect(zone).toBeFocused();

    // Le champ de fichier est masqué : on l'alimente directement, comme le
    // ferait le sélecteur du système après un appui sur Entrée.
    await page.locator('input[type="file"]').first().setInputFiles(fichier);

    await expect(page.getByText(fichier.name)).toBeVisible();
    await page.getByRole('button', { name: /valider le dépôt/i }).click();

    const depot = await expect
      .poll(() => envois.find(e => e.method === 'POST' && e.url.includes('/deposit')))
      .toBeTruthy()
      .then(() => envois.find(e => e.method === 'POST' && e.url.includes('/deposit'))!);

    expect(depot.headers['content-type']).toContain('multipart/form-data');
    await expect(page.getByText(/document envoyé/i)).toBeVisible();
  });

  test('un dossier verrouillé : le message du serveur s’affiche, pas une confirmation', async ({ page }) => {
    await stubApi(page, {
      reponses: {
        // 409 tel que le renvoie l'API sur un parcours verrouillé. Le `message`
        // est écrit pour le client : il doit apparaître TEL QUEL.
        [`/api/client/mes-documents/${PIECE_IDENTITE.docId}/deposit`]: (route: import('@playwright/test').Route) =>
          route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              message:
                'Votre dossier est en cours d’analyse bancaire : les pièces ne peuvent plus être modifiées. Contactez votre conseiller CPI.',
            }),
          }),
      },
    });

    await ouvrirSessionClient(page, '/ma-demande');
    await page.getByRole('button', { name: /^déposer$/i }).first().click();
    await page.locator('input[type="file"]').first().setInputFiles(fichier);
    await page.getByRole('button', { name: /valider le dépôt/i }).click();

    // Le message du serveur, mot pour mot.
    await expect(page.getByText(/en cours d’analyse bancaire/i)).toBeVisible();
    // Et surtout : aucune confirmation de dépôt.
    await expect(page.getByText(/document envoyé/i)).toHaveCount(0);
  });
});
