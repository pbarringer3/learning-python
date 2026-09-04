import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * The Python call stack visualizer needs `SharedArrayBuffer`, which is only
 * available in a cross-origin isolated document.
 *
 * In production those headers come from `static/coi-serviceworker.js`, since
 * GitHub Pages cannot set response headers. A local server can simply send
 * them — which also means development runs under the same COEP restrictions as
 * the deployed site, so a cross-origin resource that would be blocked there is
 * blocked here too.
 *
 * These go through middleware rather than Vite's `server.headers` option:
 * SvelteKit's dev handler builds its own response and never picks that option
 * up.
 */
function crossOriginIsolation(): Plugin {
  const attachHeaders = (server: ViteDevServer) => {
    server.middlewares.use((_request, response, next) => {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  };

  return {
    name: 'cross-origin-isolation',
    configureServer: attachHeaders,
    configurePreviewServer: attachHeaders as unknown as Plugin['configurePreviewServer']
  };
}

export default defineConfig({
  plugins: [crossOriginIsolation(), sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    // Node 22+ ships an experimental localStorage global that is undefined
    // without --localstorage-file, shadowing jsdom's implementation.
    execArgv: ['--no-experimental-webstorage']
  }
});
