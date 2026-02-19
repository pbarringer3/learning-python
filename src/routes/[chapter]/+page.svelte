<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { getChapterByNumber } from '$lib/curriculum/index';
  import { progressStore } from '$lib/curriculum/progress';
  import type { SiteProgress } from '$lib/curriculum/types';
  import { getChapterStatus, progressKey } from '$lib/curriculum/types';

  const chapterNum = $derived(Number(page.params.chapter));
  const chapter = $derived(getChapterByNumber(chapterNum));

  let progress: SiteProgress = $state({ version: 1, lessons: {} });
  progressStore.subscribe((p) => {
    progress = p;
  });

  const chapterStatus = $derived(chapter ? getChapterStatus(chapter, progress) : 'not-started');

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

  function statusBadgeColor(status: 'not-started' | 'in-progress' | 'completed'): string {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  }

  const ctaText = $derived(
    chapterStatus === 'completed'
      ? 'Review Chapter'
      : chapterStatus === 'in-progress'
        ? 'Continue Learning'
        : 'Start Chapter'
  );

  // Find the first incomplete lesson for the CTA link
  const ctaLesson = $derived.by(() => {
    if (!chapter) return undefined;
    for (const lesson of chapter.lessons) {
      const key = progressKey(chapter.number, lesson.number);
      const status = progressStore.getStatus(progress, key);
      if (status !== 'completed') return lesson;
    }
    return chapter.lessons[0]; // All complete → link to first
  });

  // Lookup function for topic → lesson number
  function topicLessonNumber(topicLessonId: string): number {
    return chapter?.lessons.find((l) => l.id === topicLessonId)?.number ?? 1;
  }
</script>

<svelte:head>
  <title>
    {chapter
      ? `Chapter ${chapter.number}: ${chapter.title} — Learning Python`
      : 'Chapter Not Found — Learning Python'}
  </title>
</svelte:head>

{#if chapter}
  <!-- Chapter Hero -->
  <section class="bg-gradient-to-br from-teal-500 to-teal-700 px-6 py-16 text-center text-white">
    <p class="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-200">
      Chapter {chapter.number}
    </p>
    <h1 class="mb-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{chapter.title}</h1>
    <p class="mx-auto mb-8 max-w-xl text-lg text-teal-100">{chapter.tagline}</p>

    <div class="flex flex-wrap items-center justify-center gap-3">
      {#if ctaLesson}
        <a
          href="{base}/{chapter.number}/{ctaLesson.number}"
          class="rounded-lg bg-white px-7 py-3 text-lg font-semibold text-teal-700 shadow-lg transition hover:bg-teal-50 hover:shadow-xl"
        >
          {ctaText} →
        </a>
      {/if}
      <a
        href="{base}/karel/playground"
        class="rounded-lg border-2 border-white/60 px-7 py-3 text-lg font-semibold text-white transition hover:border-white hover:bg-white/10"
      >
        Open Playground
      </a>
    </div>
  </section>

  <!-- Topics -->
  <section class="mx-auto max-w-5xl px-6 py-16">
    <h2 class="mb-8 text-center text-2xl font-bold text-gray-900">What You'll Learn</h2>

    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each chapter.topics as topic}
        {@const lessonNum = topicLessonNumber(topic.lessonId)}
        {@const lessonKey = progressKey(chapter.number, lessonNum)}
        {@const topicStatus = progressStore.getStatus(progress, lessonKey)}

        <a
          href="{base}/{chapter.number}/{lessonNum}"
          class="group rounded-lg border border-gray-200 p-5 transition hover:border-teal-300 hover:shadow-md"
          class:border-emerald-200={topicStatus === 'completed'}
          class:bg-emerald-50={topicStatus === 'completed'}
        >
          <div class="mb-2 text-2xl">{topic.icon}</div>
          <h3 class="mb-1 text-base font-semibold text-gray-900 group-hover:text-teal-700">
            {topic.name}
          </h3>
          <p class="text-sm text-gray-500">{topic.description}</p>
        </a>
      {/each}
    </div>
  </section>

  <!-- Lesson List -->
  <section class="border-t border-gray-100 bg-gray-50 px-6 py-16">
    <div class="mx-auto max-w-3xl">
      <h2 class="mb-8 text-center text-2xl font-bold text-gray-900">Lessons</h2>

      <ol class="space-y-3">
        {#each chapter.lessons as lesson}
          {@const lessonKey = progressKey(chapter.number, lesson.number)}
          {@const lessonStatus = progressStore.getStatus(progress, lessonKey)}

          <li>
            <a
              href="{base}/{chapter.number}/{lesson.number}"
              class="group flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-teal-300 hover:shadow-sm"
              class:border-emerald-200={lessonStatus === 'completed'}
            >
              <!-- Status icon -->
              <span
                class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold {statusBadgeColor(
                  lessonStatus
                )}"
              >
                {#if lessonStatus === 'completed'}
                  {statusIcon(lessonStatus)}
                {:else}
                  {lesson.number}
                {/if}
              </span>

              <!-- Content -->
              <div class="min-w-0">
                <h3
                  class="text-base font-semibold text-gray-900 group-hover:text-teal-700"
                  class:text-gray-500={lessonStatus === 'completed'}
                >
                  {lesson.title}
                </h3>
                <p class="mt-0.5 text-sm text-gray-500">{lesson.description}</p>
              </div>

              <!-- Arrow -->
              <svg
                class="ml-auto mt-1 h-4 w-4 flex-shrink-0 text-gray-300 transition group-hover:text-teal-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          </li>
        {/each}
      </ol>
    </div>
  </section>
{:else}
  <div class="flex min-h-[50vh] items-center justify-center">
    <div class="text-center">
      <h1 class="mb-2 text-2xl font-bold text-gray-900">Chapter Not Found</h1>
      <p class="mb-4 text-gray-600">Chapter {chapterNum} doesn't exist yet.</p>
      <a href="{base}/" class="text-blue-600 hover:underline">← Back to home</a>
    </div>
  </div>
{/if}
