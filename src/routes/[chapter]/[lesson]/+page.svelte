<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { getLessonByNumber, getNextLesson, getPreviousLesson } from '$lib/curriculum/index';
  import { progressStore } from '$lib/curriculum/progress';
  import { progressKey } from '$lib/curriculum/types';

  const chapterNum = $derived(Number(page.params.chapter));
  const lessonNum = $derived(Number(page.params.lesson));

  const result = $derived(getLessonByNumber(chapterNum, lessonNum));
  const chapter = $derived(result?.chapter);
  const lesson = $derived(result?.lesson);

  const next = $derived(getNextLesson(chapterNum, lessonNum));
  const prev = $derived(getPreviousLesson(chapterNum, lessonNum));

  const nextHref = $derived(next ? `${base}/${next.chapterNum}/${next.lesson.number}` : undefined);
  const prevHref = $derived(prev ? `${base}/${prev.chapterNum}/${prev.lesson.number}` : undefined);

  $effect(() => {
    if (chapter && lesson) {
      progressStore.markVisited(progressKey(chapter.number, lesson.number));
    }
  });
</script>

<svelte:head>
  {#if lesson && chapter}
    <title>{lesson.title} — {chapter.title} — Learning Python</title>
  {:else}
    <title>Lesson Not Found — Learning Python</title>
  {/if}
</svelte:head>

{#if lesson && chapter}
  <article class="mx-auto max-w-4xl px-6 py-10">
    <!-- Lesson header -->
    <div class="mb-8">
      <p class="mb-1 text-sm font-medium text-teal-600">
        Chapter {chapter.number} · Lesson {lesson.number}
      </p>
      <h1 class="text-3xl font-bold text-gray-900 sm:text-4xl">{lesson.title}</h1>
      <p class="mt-2 text-lg text-gray-600">{lesson.description}</p>
    </div>

    <!-- Placeholder content -->
    <div class="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
      <p class="text-lg font-medium text-gray-400">Lesson content coming soon</p>
      <p class="mt-2 text-sm text-gray-400">
        This lesson will be authored in MDsveX with embedded Karel environments
      </p>
    </div>

    <!-- Prev / Next navigation -->
    <nav class="mt-12 flex items-center justify-between border-t border-gray-200 pt-6">
      {#if prevHref && prev}
        <a
          href={prevHref}
          class="group flex items-center gap-2 text-sm text-gray-500 transition hover:text-teal-600"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>
            <span class="block text-xs text-gray-400">Previous</span>
            <span class="font-medium group-hover:text-teal-600">{prev.lesson.title}</span>
          </span>
        </a>
      {:else}
        <div></div>
      {/if}

      {#if nextHref && next}
        <a
          href={nextHref}
          class="group flex items-center gap-2 text-right text-sm text-gray-500 transition hover:text-teal-600"
        >
          <span>
            <span class="block text-xs text-gray-400">Next</span>
            <span class="font-medium group-hover:text-teal-600">{next.lesson.title}</span>
          </span>
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </a>
      {:else}
        <div></div>
      {/if}
    </nav>
  </article>
{:else}
  <div class="flex min-h-[50vh] items-center justify-center">
    <div class="text-center">
      <h1 class="mb-2 text-2xl font-bold text-gray-900">Lesson Not Found</h1>
      <p class="mb-4 text-gray-600">
        Lesson {lessonNum} in Chapter {chapterNum} doesn't exist.
      </p>
      <a href="{base}/{chapterNum}" class="text-teal-600 hover:underline"> ← Back to chapter </a>
    </div>
  </div>
{/if}
