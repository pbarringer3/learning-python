<script lang="ts">
  /**
   * Results of "Run tests", one row per case.
   *
   * A failure shows the **first differing line** rather than both transcripts:
   * Chapter 2's longest expected output is thirteen lines, and a student asked
   * to spot the difference by eye will not (`PythonInterpreterDesign.md` §13.5).
   *
   * The two comparison rules students cannot see on screen — blank lines count,
   * trailing spaces do not — are stated at the foot of a failing run rather than
   * left to be rediscovered.
   */
  import type { PythonTestResult } from '$lib/python/exercise-tests';

  interface Props {
    /** `null` until the tests have been run at least once. */
    results: PythonTestResult[] | null;
    running?: boolean;
    class?: string;
  }

  let { results, running = false, class: className = '' }: Props = $props();

  let allPassed = $derived(!!results && results.length > 0 && results.every((r) => r.passed));
  let anyOutputFailure = $derived(!!results && results.some((r) => r.kind === 'output'));

  /** An empty line has nothing to show, so it is named instead of printed. */
  function display(line: string | null): string {
    if (line === null) return '(nothing — your output ended here)';
    if (line === '') return '(a blank line)';
    return line;
  }
</script>

{#if running || results}
  <div class="python-test-results {className}" role="status" aria-live="polite">
    {#if running}
      <div class="header running">Running tests…</div>
    {:else if allPassed}
      <div class="header passed">
        <span class="icon">✓</span>
        {results?.length === 1 ? 'Test passed' : 'All tests passed'} — exercise complete.
      </div>
    {:else}
      <div class="header failed">Not there yet</div>
    {/if}

    {#if results}
      <ul class="cases">
        {#each results as result, index (index)}
          <li class="case" class:failed={!result.passed}>
            <div class="case-header">
              <span class="icon">{result.passed ? '✓' : '✗'}</span>
              <span class="case-name">{result.name}</span>
              {#if result.answers.length > 0}
                <span class="answers">typing {result.answers.join(', ')}</span>
              {/if}
            </div>

            {#if !result.passed}
              <p class="message">{result.message}</p>

              {#if result.difference}
                <dl class="diff">
                  <dt>Expected</dt>
                  <dd class="expected">{display(result.difference.expected)}</dd>
                  <dt>Your output</dt>
                  <dd class="actual">{display(result.difference.actual)}</dd>
                </dl>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if anyOutputFailure}
      <p class="rules">
        Blank lines count, so keep the bare <code>print()</code> after each
        <code>input()</code>. Spaces at the end of a line do not count.
      </p>
    {/if}
  </div>
{/if}

<style>
  .python-test-results {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    overflow: hidden;
    font-size: 14px;
  }

  .header {
    padding: 0.6rem 1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header.running {
    background: #eff6ff;
    color: #1e3a8a;
  }

  .header.passed {
    background: #ecfdf5;
    color: #065f46;
  }

  .header.failed {
    background: #fef2f2;
    color: #991b1b;
  }

  .cases {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .case {
    padding: 0.6rem 1rem;
    border-top: 1px solid #f3f4f6;
  }

  .case-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .icon {
    font-weight: 700;
  }

  .case:not(.failed) .icon {
    color: #16a34a;
  }

  .case.failed .icon {
    color: #dc2626;
  }

  .case-name {
    font-weight: 600;
    color: #111827;
  }

  .answers {
    color: #6b7280;
    font-size: 13px;
  }

  .message {
    margin: 0.4rem 0 0;
    color: #374151;
  }

  /* Two rows, label above value, so a long line is never squeezed into a
     column narrow enough to wrap in a different place than it really does. */
  .diff {
    margin: 0.5rem 0 0;
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.15rem 0.75rem;
    align-items: baseline;
  }

  .diff dt {
    color: #6b7280;
    font-size: 13px;
  }

  .diff dd {
    margin: 0;
    font-family: 'Courier New', Courier, monospace;
    white-space: pre-wrap;
    word-break: break-word;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .diff .expected {
    background: #ecfdf5;
    color: #065f46;
  }

  .diff .actual {
    background: #fef2f2;
    color: #991b1b;
  }

  .rules {
    margin: 0;
    padding: 0.5rem 1rem 0.7rem;
    border-top: 1px solid #f3f4f6;
    color: #6b7280;
    font-size: 13px;
  }

  .rules code {
    font-family: 'Courier New', Courier, monospace;
    background: #f3f4f6;
    padding: 0 0.2rem;
    border-radius: 3px;
  }
</style>
