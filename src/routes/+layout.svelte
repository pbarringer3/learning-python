<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import NavDrawer from '$lib/components/NavDrawer.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import { progressStore } from '$lib/curriculum/progress';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let drawerOpen = $state(false);

  // Landing page is standalone — no top bar or drawer toggle
  let isLandingPage = $derived(
    page.url.pathname === `${base}/` || page.url.pathname === base || page.url.pathname === '/'
  );

  onMount(() => {
    progressStore.hydrate();
  });
</script>

<NavDrawer bind:open={drawerOpen} />

{#if !isLandingPage}
  <TopBar title="Learning Python" onMenuClick={() => (drawerOpen = true)} />
{/if}

{@render children()}
