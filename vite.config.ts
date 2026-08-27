import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    // Node 22+ ships an experimental localStorage global that is undefined
    // without --localstorage-file, shadowing jsdom's implementation.
    execArgv: ['--no-experimental-webstorage']
  }
});
