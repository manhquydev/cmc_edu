// jest-dom matchers (toBeInTheDocument, etc.). Import-only side effect:
// registers matchers via expect.extend, touches no DOM globals at load, so it
// is safe under the node-env logic tests too.
import '@testing-library/jest-dom';

// jsdom does not implement `HTMLDialogElement.showModal`/`close` (Astryx's
// `Dialog` component uses a native `<dialog>` and calls these directly —
// `Dialog.tsx` around the isOpen effect). Stub them as no-ops that reflect
// the `open` attribute so dialog-based screens (create/edit modals) can be
// opened/closed under jsdom component tests. Guarded so this is a no-op under
// the node-env logic tests, where `HTMLDialogElement` is undefined.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
}
