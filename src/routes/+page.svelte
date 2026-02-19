<script>
  import { base } from '$app/paths';
  import { chapters } from '$lib/curriculum/index';
</script>

<svelte:head>
  <title>Learning Python — Interactive Python Curriculum</title>
</svelte:head>

<!-- Hero Section -->
<div
  class="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700"
>
  <div class="mx-auto max-w-3xl px-6 text-center">
    <h1 class="mb-4 text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
      Learning Python
    </h1>
    <p class="mx-auto mb-10 max-w-xl text-lg text-white/90 sm:text-xl">
      An interactive, browser-based curriculum that teaches Python from the ground up — no installs,
      no accounts, just code.
    </p>

    <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <a
        href="{base}/1"
        class="rounded-lg bg-white px-7 py-3 text-lg font-semibold text-blue-600 shadow-lg transition hover:bg-blue-50 hover:shadow-xl"
      >
        Start Learning →
      </a>
      <a
        href="{base}/karel/playground"
        class="rounded-lg border-2 border-white/60 px-7 py-3 text-lg font-semibold text-white transition hover:border-white hover:bg-white/10"
      >
        Try the Playground
      </a>
    </div>
  </div>
</div>

<!-- How It Works -->
<section class="mx-auto max-w-5xl px-6 py-20">
  <h2 class="mb-12 text-center text-3xl font-bold text-gray-900">How It Works</h2>

  <div class="grid gap-8 sm:grid-cols-3">
    <div class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div class="mb-3 text-3xl">🌐</div>
      <h3 class="mb-2 text-lg font-semibold text-gray-900">Runs in Your Browser</h3>
      <p class="text-sm leading-relaxed text-gray-600">
        All Python code runs client-side via WebAssembly. No installs, no servers — just open the
        page and start coding.
      </p>
    </div>
    <div class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div class="mb-3 text-3xl">🎯</div>
      <h3 class="mb-2 text-lg font-semibold text-gray-900">Interactive Exercises</h3>
      <p class="text-sm leading-relaxed text-gray-600">
        Every lesson includes hands-on exercises with instant feedback. Write code, run it, and see
        results immediately.
      </p>
    </div>
    <div class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div class="mb-3 text-3xl">📈</div>
      <h3 class="mb-2 text-lg font-semibold text-gray-900">Progressive Curriculum</h3>
      <p class="text-sm leading-relaxed text-gray-600">
        Start with Karel the Robot and build up to data structures & algorithms. Each concept builds
        on the last.
      </p>
    </div>
  </div>
</section>

<!-- Chapters Preview -->
<section class="bg-gray-50 px-6 py-20">
  <div class="mx-auto max-w-5xl">
    <h2 class="mb-12 text-center text-3xl font-bold text-gray-900">Curriculum</h2>

    <div class="grid gap-6 sm:grid-cols-2">
      {#each chapters as chapter}
        <a
          href="{base}/{chapter.number}"
          class="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div class="mb-2 text-sm font-medium text-blue-600">
            Chapter {chapter.number}
          </div>
          <h3
            class="mb-1 text-xl font-bold text-gray-900 transition-colors group-hover:text-blue-600"
          >
            {chapter.title}
          </h3>
          <p class="mb-3 text-sm text-gray-600">{chapter.tagline}</p>
          <p class="text-xs text-gray-400">{chapter.lessons.length} lessons</p>
        </a>
      {/each}

      <!-- Coming soon placeholders -->
      <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
        <div class="mb-2 text-sm font-medium text-gray-400">Chapter 2</div>
        <h3 class="mb-1 text-xl font-bold text-gray-400">Variables & Types</h3>
        <p class="text-sm text-gray-400">Coming soon</p>
      </div>
      <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
        <div class="mb-2 text-sm font-medium text-gray-400">Chapter 3</div>
        <h3 class="mb-1 text-xl font-bold text-gray-400">Functions & Parameters</h3>
        <p class="text-sm text-gray-400">Coming soon</p>
      </div>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="border-t border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
  <p>
    Built with SvelteKit · Python runs via
    <a
      href="https://pyodide.org"
      class="text-blue-600 hover:underline"
      target="_blank"
      rel="noopener">Pyodide</a
    >
    · Inspired by Stanford CS106A
  </p>
</footer>
