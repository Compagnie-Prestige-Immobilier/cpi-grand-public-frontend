/**
 * Modales et boîtes de confirmation — bâties sur Radix.
 *
 * L'application comptait seize surfaces modales écrites à la main, sous la
 * forme d'un `<div style={{ position: 'fixed', inset: 0 }}>`. Deux seulement
 * portaient `role="dialog"`, aucune n'avait de piège de focus, et **aucune** ne
 * se fermait par <kbd>Échap</kbd>. Concrètement :
 *
 *   - la tabulation sortait de la modale et parcourait la page derrière, que
 *     l'utilisateur ne voyait pas ;
 *   - un lecteur d'écran continuait d'annoncer le contenu masqué ;
 *   - à la fermeture, le focus repartait en haut du document au lieu de revenir
 *     sur le bouton qui avait ouvert la modale ;
 *   - la seule sortie était de viser la croix à la souris.
 *
 * `@radix-ui/react-dialog` fournit tout cela : `role="dialog"`, `aria-modal`,
 * piège de focus, fermeture par <kbd>Échap</kbd> et par clic extérieur,
 * restitution du focus, `aria-hidden` sur le reste de la page, et blocage du
 * défilement d'arrière-plan.
 *
 * L'apparence est celle d'avant, au pixel près : même voile, même carte, mêmes
 * rayons, mêmes animations `.cpi-backdrop-enter` / `.cpi-scale-in`.
 */

import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { X, AlertTriangle } from 'lucide-react';

/** Voile par défaut : le prune de la marque, pas un noir neutre. */
const VOILE = 'rgba(28,8,16,0.5)';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Nom de la modale, annoncé à l'ouverture. Toujours requis : une modale sans
   * nom n'est pas identifiable. Il est rendu hors écran — les panneaux gardent
   * leur propre titre visible, inchangé.
   */
  titre: string;
  /** Précision annoncée après le titre. À défaut, le titre est réutilisé. */
  description?: string;
  /** Largeur maximale du panneau (défaut 520 px). */
  largeur?: number | string;
  /** Empilement — voir `--z-modal` dans globals.css. */
  zIndex?: number;
  /** Voile personnalisé (certaines modales de lecture en veulent un plus dense). */
  voile?: string;
  flou?: boolean;
  /** Masque la croix de fermeture (le pied du panneau porte alors l'action). */
  sansCroix?: boolean;
  /** Style additionnel du panneau. */
  style?: React.CSSProperties;
  className?: string;
  /** Classe du voile — certaines modales ont des règles mobiles qui la ciblent. */
  classNameVoile?: string;
  /** Style additionnel du voile. */
  styleVoile?: React.CSSProperties;
  children: React.ReactNode;
}

const CACHE_VISUELLEMENT: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

export function Modal({
  open, onClose, titre, description,
  largeur = 520, zIndex = 300, voile = VOILE, flou = true,
  sansCroix = false, style, className, classNameVoile, styleVoile, children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={ouvert => { if (!ouvert) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`cpi-backdrop-enter ${classNameVoile ?? ''}`.trim()}
          style={{
            position: 'fixed', inset: 0, zIndex,
            background: voile,
            backdropFilter: flou ? 'blur(4px)' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, overflowY: 'auto',
            ...styleVoile,
          }}
        >
          <Dialog.Content
            className={`cpi-scale-in ${className ?? ''}`.trim()}
            style={{
              position: 'relative',
              width: '100%', maxWidth: largeur, maxHeight: '90vh', overflowY: 'auto',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-xl)',
              fontFamily: 'var(--font-sans)', color: 'var(--foreground)',
              ...style,
            }}
          >
            <Dialog.Title style={CACHE_VISUELLEMENT}>{titre}</Dialog.Title>
            {/* Toujours rendue : sans elle, Radix avertit en console à chaque
                ouverture, et le bruit finit par masquer les vrais problèmes. */}
            <Dialog.Description style={CACHE_VISUELLEMENT}>{description ?? titre}</Dialog.Description>

            {!sansCroix && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fermer"
                  style={{
                    position: 'absolute', top: 14, right: 14, zIndex: 1,
                    display: 'grid', placeItems: 'center', width: 32, height: 32,
                    border: 'none', borderRadius: 'var(--r-sm)',
                    background: 'var(--secondary)', color: 'var(--muted-foreground)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            )}
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  titre: string;
  /** Ce que l'action fait réellement, et ce qui ne pourra pas être défait. */
  description: React.ReactNode;
  /** Libellé du bouton d'action. Doit nommer l'acte : « Décaisser », pas « OK ». */
  libelleConfirmer: string;
  libelleAnnuler?: string;
  /** Rouge pour une destruction, prune pour un acte engageant mais non destructeur. */
  ton?: 'destructif' | 'engageant';
  enCours?: boolean;
  onConfirmer: () => void;
}

/**
 * Confirmation d'une action lourde de conséquences.
 *
 * `AlertDialog` et non `Dialog` : il n'est pas fermable par clic extérieur, et
 * le focus part sur le bouton d'annulation. Une action irréversible ne doit pas
 * pouvoir être déclenchée ou esquivée par un geste distrait.
 */
export function ConfirmDialog({
  open, onOpenChange, titre, description,
  libelleConfirmer, libelleAnnuler = 'Annuler',
  ton = 'destructif', enCours = false, onConfirmer,
}: ConfirmDialogProps) {
  const couleur = ton === 'destructif' ? 'var(--destructive)' : 'var(--primary)';
  const fond = ton === 'destructif' ? 'var(--destructive-surface)' : 'var(--secondary)';

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="cpi-backdrop-enter"
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: VOILE, backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <AlertDialog.Content
            className="cpi-scale-in"
            style={{
              width: '100%', maxWidth: 460,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-xl)',
              padding: 24, fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span
                aria-hidden="true"
                style={{ display: 'grid', placeItems: 'center', flexShrink: 0, width: 38, height: 38, borderRadius: 'var(--r-full)', background: fond, color: couleur }}
              >
                <AlertTriangle size={18} />
              </span>
              <div style={{ minWidth: 0 }}>
                <AlertDialog.Title style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 800, color: 'var(--foreground)' }}>
                  {titre}
                </AlertDialog.Title>
                <AlertDialog.Description asChild>
                  <div style={{ marginTop: 8, fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
                    {description}
                  </div>
                </AlertDialog.Description>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, flexWrap: 'wrap' }}>
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  disabled={enCours}
                  style={{
                    padding: '10px 18px', borderRadius: 'var(--r-full)',
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--foreground)', fontFamily: 'var(--font-sans)',
                    fontSize: '0.875rem', fontWeight: 600, cursor: enCours ? 'not-allowed' : 'pointer',
                    minHeight: 'var(--tap-min)',
                  }}
                >
                  {libelleAnnuler}
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  disabled={enCours}
                  aria-busy={enCours || undefined}
                  onClick={event => {
                    // La modale reste ouverte pendant l'appel réseau : c'est
                    // l'appelant qui la ferme au succès. Sinon, un échec
                    // laissait l'utilisateur croire que l'action avait abouti.
                    event.preventDefault();
                    onConfirmer();
                  }}
                  style={{
                    padding: '10px 18px', borderRadius: 'var(--r-full)', border: 'none',
                    background: couleur, color: '#ffffff',
                    fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700,
                    cursor: enCours ? 'progress' : 'pointer', opacity: enCours ? 0.75 : 1,
                    minHeight: 'var(--tap-min)',
                  }}
                >
                  {enCours ? 'En cours…' : libelleConfirmer}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
