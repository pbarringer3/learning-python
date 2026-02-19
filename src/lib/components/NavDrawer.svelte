<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { chapters } from '$lib/curriculum/index';
  import { progressStore } from '$lib/curriculum/progress';
  import type { SiteProgress } from '$lib/curriculum/types';
  import { getChapterStatus, progressKey } from '$lib/curriculum/types';

  interface Props {
    open: boolean;
    onClose?: () => void;
  }

  let { open = $bindable(false), onClose }: Props = $props();

  let progress: SiteProgress = $state({ version: 1, lessons: {} });

  progressStore.subscribe((p) => {
    progress = p;
  });

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleBackdropClick() {
    handleClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  function statusIcon(status: 'not-started' | 'in-progress' | 'completed'): string {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in-progress':
        return '◐';
      default:
        return '○';
    }
  }

  function statusColor(status: 'not-started' | 'in-progress' | 'completed'): string {
    switch (status) {
      case 'completed':
        return 'text-emerald-500';
      case 'in-progress':
        return 'text-blue-500';
      default:
        return 'text-gray-400';
    }
  }

  function isCurrentPath(path: string): boolean {
    return page.url.pathname === path || page.url.pathname === path + '/';
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 bg-black/30 transition-opacity"
    class:opacity-100={open}
    class:opacity-0={!open}
    onclick={handleBackdropClick}
  ></div>
{/if}

<!-- Drawer -->
<nav
  class="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out"
  class:-translate-x-full={!open}
  class:translate-x-0={open}
  aria-label="Site navigation"
>
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
    <a
      href="{base}/"
      class="text-lg font-bold text-gray-900 hover:text-blue-600"
      onclick={handleClose}
    >
      Learning Python
    </a>
    <button
      class="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      aria-label="Close navigation"
      onclick={handleClose}
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  <!-- Scrollable content -->
  <div class="flex-1 overflow-y-auto px-4 py-4">
    {#each chapters as chapter}
      {@const chapterStatus = getChapterStatus(chapter, progress)}

      <!-- Chapter heading -->
      <div class="mb-1">
        <a
          href="{base}/{chapter.number}"
          class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors"
          class:text-gray-900={!isCurrentPath(`${base}/${chapter.number}`)}
          class:bg-blue-50={isCurrentPath(`${base}/${chapter.number}`)}
          class:text-blue-700={isCurrentPath(`${base}/${chapter.number}`)}
          class:hover:bg-gray-50={!isCurrentPath(`${base}/${chapter.number}`)}
          onclick={handleClose}
        >
          <span class="{statusColor(chapterStatus)} text-xs">{statusIcon(chapterStatus)}</span>
          <span>Chapter {chapter.number}: {chapter.title}</span>
        </a>
      </div>

      <!-- Lessons -->
      <ul class="mb-4 ml-4 border-l border-gray-200 pl-3">
        {#each chapter.lessons as lesson}
          {@const lessonKey = progressKey(chapter.number, lesson.number)}
          {@const lessonStatus = progressStore.getStatus(progress, lessonKey)}
          {@const lessonHref = `${base}/${chapter.number}/${lesson.number}`}
          {@const isCurrent = isCurrentPath(lessonHref)}

          <li>
            <a
              href={lessonHref}
              class="group flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors"
              class:bg-blue-50={isCurrent}
              class:text-blue-700={isCurrent}
              class:font-medium={isCurrent}
              class:text-gray-700={!isCurrent}
              class:hover:bg-gray-50={!isCurrent}
              class:hover:text-gray-900={!isCurrent}
              onclick={handleClose}
            >
              <span class="{statusColor(lessonStatus)} text-xs">{statusIcon(lessonStatus)}</span>
              <span>{lesson.number}. {lesson.title}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/each}

    <!-- Quick links -->
    <div class="mt-2 border-t border-gray-200 pt-4">
      <p class="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-gray-400">
        Quick Links
      </p>
      <a
        href="{base}/karel/playground"
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
        class:bg-blue-50={isCurrentPath(`${base}/karel/playground`)}
        class:text-blue-700={isCurrentPath(`${base}/karel/playground`)}
        onclick={handleClose}
      >
        <span>🎮</span>
        <span>Karel Playground</span>
      </a>
    </div>
  </div>
</nav>
