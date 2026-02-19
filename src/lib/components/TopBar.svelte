<script lang="ts">
  interface Props {
    title?: string;
    onMenuClick?: () => void;
    /** Previous lesson link */
    prevHref?: string;
    /** Next lesson link */
    nextHref?: string;
  }

  let { title = '', onMenuClick, prevHref, nextHref }: Props = $props();
</script>

<header
  class="sticky top-0 z-30 flex h-12 items-center border-b border-gray-200 bg-white/95 px-3 backdrop-blur-sm"
>
  <!-- Left: hamburger -->
  <button
    class="mr-3 rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    aria-label="Open navigation"
    onclick={onMenuClick}
  >
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  </button>

  <!-- Center: title -->
  <div class="flex min-w-0 flex-1 items-center justify-center">
    <span class="truncate text-sm font-medium text-gray-700">{title}</span>
  </div>

  <!-- Right: prev/next arrows -->
  <div class="flex items-center gap-1">
    {#if prevHref}
      <a
        href={prevHref}
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Previous lesson"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </a>
    {:else}
      <span class="p-1.5"><svg class="h-4 w-4" viewBox="0 0 24 24"></svg></span>
    {/if}
    {#if nextHref}
      <a
        href={nextHref}
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Next lesson"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    {:else}
      <span class="p-1.5"><svg class="h-4 w-4" viewBox="0 0 24 24"></svg></span>
    {/if}
  </div>
</header>
