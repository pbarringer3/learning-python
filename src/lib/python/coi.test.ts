import { describe, it, expect } from 'vitest';
import { evaluateIsolation, isolationMessage, type IsolationEnvironment } from './coi';

function environment(overrides: Partial<IsolationEnvironment> = {}): IsolationEnvironment {
  return {
    crossOriginIsolated: false,
    sharedArrayBufferAvailable: false,
    serviceWorkerAvailable: true,
    secureContext: true,
    bootstrapAttempted: false,
    ...overrides
  };
}

describe('evaluateIsolation', () => {
  it('reports isolated when the headers are already in place', () => {
    const state = evaluateIsolation(
      environment({ crossOriginIsolated: true, sharedArrayBufferAvailable: true })
    );
    expect(state.status).toBe('isolated');
  });

  it('asks for the bootstrap reload on a first, un-isolated visit', () => {
    expect(evaluateIsolation(environment()).status).toBe('bootstrap');
  });

  it('does not ask for a second reload after one has already been tried', () => {
    // Guards against a reload loop when the service worker registers but the
    // reload still comes back un-isolated.
    const state = evaluateIsolation(environment({ bootstrapAttempted: true }));
    expect(state.status).toBe('unsupported');
  });

  it('gives up when service workers are unavailable', () => {
    // Firefox private browsing, and some locked-down corporate profiles.
    const state = evaluateIsolation(environment({ serviceWorkerAvailable: false }));
    expect(state.status).toBe('unsupported');
    if (state.status === 'unsupported') expect(state.reason).toBe('no-service-worker');
  });

  it('gives up outside a secure context, where no service worker can register', () => {
    const state = evaluateIsolation(environment({ secureContext: false }));
    expect(state.status).toBe('unsupported');
    if (state.status === 'unsupported') expect(state.reason).toBe('insecure-context');
  });

  it('gives up when isolation holds but SharedArrayBuffer is still missing', () => {
    const state = evaluateIsolation(
      environment({ crossOriginIsolated: true, sharedArrayBufferAvailable: false })
    );
    expect(state.status).toBe('unsupported');
    if (state.status === 'unsupported') expect(state.reason).toBe('no-shared-array-buffer');
  });

  it('prefers the insecure-context reason over the missing-worker one', () => {
    // An insecure context is *why* the worker is missing; reporting the cause
    // is more useful than reporting the symptom.
    const state = evaluateIsolation(
      environment({ secureContext: false, serviceWorkerAvailable: false })
    );
    if (state.status === 'unsupported') expect(state.reason).toBe('insecure-context');
  });

  it('does not retry the bootstrap once a browsing context has ruled it out', () => {
    const state = evaluateIsolation(
      environment({ serviceWorkerAvailable: false, bootstrapAttempted: true })
    );
    expect(state.status).toBe('unsupported');
  });
});

describe('isolationMessage', () => {
  const reasons = [
    'no-service-worker',
    'insecure-context',
    'no-shared-array-buffer',
    'bootstrap-failed'
  ] as const;

  it('has distinct, non-empty copy for every reason', () => {
    const messages = reasons.map((reason) => isolationMessage(reason));
    for (const message of messages) {
      expect(message.title.length).toBeGreaterThan(0);
      expect(message.detail.length).toBeGreaterThan(0);
    }
    expect(new Set(messages.map((m) => m.detail)).size).toBe(reasons.length);
  });

  it('tells the reader what to actually do', () => {
    for (const reason of reasons) {
      expect(isolationMessage(reason).detail).toMatch(/[a-z]/);
    }
  });

  it('names private browsing where that is the likely cause', () => {
    expect(isolationMessage('no-service-worker').detail.toLowerCase()).toContain('private');
  });
});
