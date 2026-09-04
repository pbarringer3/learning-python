<script lang="ts">
  /**
   * Program output console, plus the inline prompt for `input()`.
   *
   * Output is an append-only stream rather than something reconstructed per
   * step: because the worker genuinely blocks instead of replaying, whatever
   * has been printed has been printed, and there is nothing to rewind.
   */
  import { tick } from 'svelte';
  import type { PythonError } from '$lib/python/protocol';
  import type { OutputChunk } from '$lib/python/runner';

  interface Props {
    chunks: OutputChunk[];
    error?: PythonError | null;
    /** Non-null while the program is blocked inside `input()`. */
    inputPrompt?: string | null;
    onSubmitInput?: (value: string) => void;
    class?: string;
  }

  let {
    chunks,
    error = null,
    inputPrompt = null,
    onSubmitInput,
    class: className = ''
  }: Props = $props();

  let draft = $state('');
  let log: HTMLDivElement | undefined = $state();
  let field: HTMLInputElement | undefined = $state();

  // Keep the newest output in view, and put the cursor where the program is
  // actually waiting.
  $effect(() => {
    void chunks.length;
    void error;
    void inputPrompt;
    tick().then(() => {
      if (log) log.scrollTop = log.scrollHeight;
      if (inputPrompt !== null) field?.focus();
    });
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (inputPrompt === null) return;
    onSubmitInput?.(draft);
    draft = '';
  }
</script>

<div class="python-output {className}">
  <div class="output-header">Output</div>

  <div class="output-log" bind:this={log} role="log" aria-live="polite">
    {#if chunks.length === 0 && !error}
      <span class="idle">Program output will appear here.</span>
    {/if}
    {#each chunks as chunk, index (index)}<span class:err={chunk.stream === 'stderr'}
        >{chunk.text}</span
      >{/each}
    {#if error}
      <div class="error">{error.traceback}</div>
    {/if}
  </div>

  {#if inputPrompt !== null}
    <form class="input-row" onsubmit={submit}>
      <label class="input-label" for="python-input">
        {inputPrompt.trim().length > 0 ? inputPrompt : 'Your program is waiting for input'}
      </label>
      <input
        id="python-input"
        bind:this={field}
        bind:value={draft}
        class="input-field"
        autocomplete="off"
        placeholder="Type a value and press Enter"
      />
      <button type="submit" class="input-submit">Enter</button>
    </form>
  {/if}
</div>

<style>
  .python-output {
    display: flex;
    flex-direction: column;
    border: 1px solid #d4d4d8;
    border-radius: 6px;
    overflow: hidden;
    background: white;
  }

  .output-header {
    padding: 0.3rem 0.6rem;
    background: #eef2f7;
    border-bottom: 1px solid #e5e7eb;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .output-log {
    min-height: 6rem;
    max-height: 16rem;
    overflow: auto;
    padding: 0.5rem 0.6rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
    /* Program output is whitespace-significant. */
    white-space: pre-wrap;
    word-break: break-word;
  }

  .idle {
    color: #9ca3af;
  }

  .err {
    color: #b91c1c;
  }

  .error {
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-left: 3px solid #ef4444;
    background: #fef2f2;
    color: #b91c1c;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
    border-top: 1px solid #e5e7eb;
    background: #fffbeb;
    flex-wrap: wrap;
  }

  .input-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: #92400e;
  }

  .input-field {
    flex: 1 1 8rem;
    min-width: 0;
    padding: 0.25rem 0.5rem;
    border: 1px solid #d4d4d8;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
  }

  .input-submit {
    padding: 0.25rem 0.75rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
  }

  .input-submit:hover {
    background: #e5e5e5;
  }
</style>
