<script lang="ts">
  import { base } from '$app/paths';
  import { getLessonByNumber, getNextLesson, getPreviousLesson } from '$lib/curriculum/index';
  import { progressStore } from '$lib/curriculum/progress';
  import { progressKey } from '$lib/curriculum/types';
  import type { Snippet } from 'svelte';

  let {
    chapterNumber,
    lessonNumber,
    children
  }: {
    chapterNumber: number;
    lessonNumber: number;
    children: Snippet;
  } = $props();

  const result = $derived(getLessonByNumber(chapterNumber, lessonNumber));
  const chapter = $derived(result?.chapter);
  const lesson = $derived(result?.lesson);

  const next = $derived(getNextLesson(chapterNumber, lessonNumber));
  const prev = $derived(getPreviousLesson(chapterNumber, lessonNumber));

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
  <article class="lesson-shell">
    <!-- Lesson header -->
    <div class="lesson-header">
      <p class="lesson-breadcrumb">
        Chapter {chapter.number} · Lesson {lesson.number}
      </p>
      <h1 class="lesson-title">{lesson.title}</h1>
      <p class="lesson-description">{lesson.description}</p>
    </div>

    <!-- Lesson content (MDsveX / children) -->
    <div class="lesson-content">
      {@render children()}
    </div>

    <!-- Prev / Next navigation -->
    <nav class="lesson-nav">
      {#if prevHref && prev}
        <a href={prevHref} class="nav-link">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>
            <span class="nav-label">Previous</span>
            <span class="nav-title">{prev.lesson.title}</span>
          </span>
        </a>
      {:else}
        <div></div>
      {/if}

      {#if nextHref && next}
        <a href={nextHref} class="nav-link nav-link-right">
          <span>
            <span class="nav-label">Next</span>
            <span class="nav-title">{next.lesson.title}</span>
          </span>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
{/if}

<style>
  .lesson-shell {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .lesson-header {
    margin-bottom: 2rem;
  }

  .lesson-breadcrumb {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #0d9488;
  }

  .lesson-title {
    font-size: 2.25rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.2;
  }

  @media (min-width: 640px) {
    .lesson-title {
      font-size: 2.5rem;
    }
  }

  .lesson-description {
    margin-top: 0.5rem;
    font-size: 1.125rem;
    color: #64748b;
    line-height: 1.7;
  }

  /* Markdown prose styling */
  .lesson-content :global(h2) {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1e293b;
    margin-top: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .lesson-content :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    color: #334155;
    margin-top: 2rem;
    margin-bottom: 0.5rem;
  }

  .lesson-content :global(p) {
    color: #475569;
    margin-bottom: 1rem;
    line-height: 1.8;
    font-size: 1.0625rem;
  }

  .lesson-content :global(ul),
  .lesson-content :global(ol) {
    color: #475569;
    margin-bottom: 1rem;
    padding-left: 1.5rem;
    line-height: 1.8;
    font-size: 1.0625rem;
  }

  .lesson-content :global(li) {
    margin-bottom: 0.35rem;
  }

  .lesson-content :global(hr) {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 2.5rem 0;
  }

  .lesson-content :global(blockquote) {
    background: #f0fdfa;
    border-left: 4px solid #14b8a6;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    font-size: 0.9375rem;
    margin-bottom: 1.5rem;
  }

  .lesson-content :global(blockquote strong) {
    color: #0f766e;
  }

  .lesson-content :global(blockquote p) {
    color: #475569;
    margin-bottom: 0;
  }

  .lesson-content :global(code) {
    background: #f1f5f9;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    font-size: 0.875em;
    color: #334155;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  }

  .lesson-content :global(pre) {
    background: #1e293b;
    color: #e2e8f0;
    padding: 1rem 1.25rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
    line-height: 1.7;
  }

  .lesson-content :global(pre code) {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }

  .lesson-content :global(strong) {
    font-weight: 600;
    color: #1e293b;
  }

  .lesson-content :global(em) {
    font-style: italic;
  }

  .lesson-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5rem;
    font-size: 0.9375rem;
  }

  .lesson-content :global(th) {
    background: #f1f5f9;
    font-weight: 600;
    text-align: left;
    padding: 0.6rem 0.75rem;
    border-bottom: 2px solid #e2e8f0;
    color: #334155;
  }

  .lesson-content :global(td) {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    color: #475569;
  }

  /* Navigation */
  .lesson-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #64748b;
    text-decoration: none;
    transition: color 0.15s;
  }

  .nav-link:hover {
    color: #0d9488;
  }

  .nav-link-right {
    text-align: right;
  }

  .nav-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .nav-label {
    display: block;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .nav-title {
    font-weight: 500;
  }

  .nav-link:hover .nav-title {
    color: #0d9488;
  }
</style>
