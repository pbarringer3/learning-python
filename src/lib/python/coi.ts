/**
 * Cross-origin isolation bootstrap.
 *
 * `SharedArrayBuffer` — and therefore the whole stepping engine — is only
 * available when the document is served with `Cross-Origin-Opener-Policy:
 * same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. GitHub Pages
 * offers no way to set response headers, so a service worker re-serves the
 * site's own responses with those headers attached (see
 * `static/coi-serviceworker.js` and `PythonInterpreterDesign.md` section 4).
 *
 * The first document load happens before any service worker exists, so it is
 * necessarily un-isolated. We register the worker, wait for it to activate, and
 * reload once; the reload goes through the worker and comes back isolated. That
 * one-time cost is the price of staying on `github.io` without a custom domain.
 *
 * Registration is deliberately *lazy* — only Python routes call this — so a
 * visitor who only ever reads a Karel lesson never sees the reload.
 */

import { base } from '$app/paths';

/** Why isolation could not be established. */
export type IsolationReason =
  | 'no-service-worker'
  | 'insecure-context'
  | 'no-shared-array-buffer'
  | 'bootstrap-failed';

export type IsolationState =
  | { status: 'isolated' }
  | { status: 'bootstrap' }
  | { status: 'unsupported'; reason: IsolationReason };

/** The browser facts the decision depends on, passed in so it stays testable. */
export interface IsolationEnvironment {
  crossOriginIsolated: boolean;
  sharedArrayBufferAvailable: boolean;
  serviceWorkerAvailable: boolean;
  secureContext: boolean;
  /** True if this browsing context already tried the register-and-reload dance. */
  bootstrapAttempted: boolean;
}

/** `sessionStorage` key guarding against a reload loop. */
const BOOTSTRAP_FLAG = 'learning-python-coi-bootstrap';

/**
 * Decide what to do about isolation. Pure, so the branch that matters most —
 * "never reload twice" — can be tested without a browser.
 */
export function evaluateIsolation(environment: IsolationEnvironment): IsolationState {
  if (environment.crossOriginIsolated) {
    return environment.sharedArrayBufferAvailable
      ? { status: 'isolated' }
      : { status: 'unsupported', reason: 'no-shared-array-buffer' };
  }

  // An insecure context is the *cause* of a missing service worker, so report
  // it in preference to the symptom.
  if (!environment.secureContext) {
    return { status: 'unsupported', reason: 'insecure-context' };
  }
  if (!environment.serviceWorkerAvailable) {
    return { status: 'unsupported', reason: 'no-service-worker' };
  }
  if (environment.bootstrapAttempted) {
    return { status: 'unsupported', reason: 'bootstrap-failed' };
  }
  return { status: 'bootstrap' };
}

export interface IsolationMessage {
  title: string;
  detail: string;
}

/**
 * Copy for the failure cases. Per the design doc there is no degraded fallback
 * mode — a second execution path with its own replay semantics and determinism
 * requirements would roughly double the project for a small minority of
 * visitors — so this message is the entire user-facing story. It has to be
 * clear about what happened and what to try instead.
 */
export function isolationMessage(reason: IsolationReason): IsolationMessage {
  switch (reason) {
    case 'no-service-worker':
      return {
        title: 'This browser can’t run the Python visualizer',
        detail:
          'The visualizer needs a service worker, which this browser has turned off. Private browsing windows are the usual reason. Opening this page in a normal window should fix it.'
      };
    case 'insecure-context':
      return {
        title: 'This page needs a secure connection',
        detail:
          'The Python visualizer only runs over HTTPS (or on localhost). Try the https:// version of this address.'
      };
    case 'no-shared-array-buffer':
      return {
        title: 'This browser is missing a feature the visualizer needs',
        detail:
          'SharedArrayBuffer is unavailable here, so the interpreter has no way to pause between steps. A current version of Chrome, Edge, Firefox, or Safari will work.'
      };
    case 'bootstrap-failed':
      return {
        title: 'Couldn’t finish setting up the Python visualizer',
        detail:
          'The setup step ran but the page still isn’t isolated. Reloading usually clears this; if it keeps happening, a browser extension or network filter may be blocking the service worker.'
      };
  }
}

/** Read the current browser state. Client-side only. */
function readEnvironment(): IsolationEnvironment {
  let bootstrapAttempted = false;
  try {
    bootstrapAttempted = sessionStorage.getItem(BOOTSTRAP_FLAG) === '1';
  } catch {
    // sessionStorage can throw outright in some locked-down contexts; treating
    // that as "not yet attempted" keeps the happy path working.
  }

  return {
    crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated,
    sharedArrayBufferAvailable: typeof SharedArrayBuffer !== 'undefined',
    serviceWorkerAvailable: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    secureContext: typeof isSecureContext === 'undefined' ? false : isSecureContext,
    bootstrapAttempted
  };
}

function setBootstrapFlag(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(BOOTSTRAP_FLAG, '1');
    else sessionStorage.removeItem(BOOTSTRAP_FLAG);
  } catch {
    // Non-fatal: without the flag the worst case is one extra reload.
  }
}

/**
 * Make sure this page is cross-origin isolated, registering the header-injecting
 * service worker and reloading once if it isn't.
 *
 * Resolves to `{ status: 'isolated' }` when the engine can start. When it
 * triggers a reload the promise never settles, because the document is going
 * away — callers should render a "setting up" state and expect not to be
 * resumed.
 */
export async function ensureCrossOriginIsolated(): Promise<IsolationState> {
  const state = evaluateIsolation(readEnvironment());

  if (state.status === 'isolated') {
    // Clear the guard so a later hard reload (which bypasses service workers)
    // is allowed to bootstrap again rather than reporting failure.
    setBootstrapFlag(false);
    return state;
  }
  if (state.status === 'unsupported') return state;

  try {
    const registration = await navigator.serviceWorker.register(`${base}/coi-serviceworker.js`, {
      scope: `${base}/`
    });
    await navigator.serviceWorker.ready;
    // A worker only controls clients that loaded *through* it, so this document
    // stays un-isolated no matter how long we wait. The reload is the point.
    if (registration.active) {
      setBootstrapFlag(true);
      location.reload();
      // Never settles: the document is being torn down.
      return new Promise<IsolationState>(() => {});
    }
    return { status: 'unsupported', reason: 'bootstrap-failed' };
  } catch {
    return { status: 'unsupported', reason: 'bootstrap-failed' };
  }
}
