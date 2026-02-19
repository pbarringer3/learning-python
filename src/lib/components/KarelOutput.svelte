<script lang="ts">
  import type { ExecutionStatus, TestResult } from '$lib/karel/types';

  interface Props {
    status: ExecutionStatus;
    error?: string | null;
    message?: string | null;
    stepCount?: number;
    pyodideLoading?: boolean;
    pyodideError?: string | null;
    testResults?: TestResult[] | null;
    class?: string;
  }

  let {
    status,
    error = null,
    message = null,
    stepCount = 0,
    pyodideLoading = false,
    pyodideError = null,
    testResults = null,
    class: className = ''
  }: Props = $props();

  const hasError = $derived(status === 'error' && error);
  const hasSuccess = $derived(status === 'success');
  const isRunning = $derived(status === 'running');
  const isPaused = $derived(status === 'paused');
  const allTestsPassed = $derived(
    testResults && testResults.length > 0 && testResults.every((t) => t.passed)
  );
  const someTestsFailed = $derived(
    testResults && testResults.length > 0 && testResults.some((t) => !t.passed)
  );
</script>

<div class="karel-output {className}">
  {#if pyodideLoading}
    <div class="output-message info">
      <div class="message-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="spinner">
          <path
            d="M12 4V2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8z"
          />
        </svg>
        <span class="message-title">Loading Python environment...</span>
      </div>
    </div>
  {:else if pyodideError}
    <div class="output-message error">
      <div class="message-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
        <span class="message-title">Failed to load Python</span>
      </div>
      <pre class="message-content">{pyodideError}</pre>
    </div>
  {:else if testResults && testResults.length > 0}
    <!-- Show test results -->
    {#if allTestsPassed}
      <div class="output-message success">
        <div class="message-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            />
          </svg>
          <span class="message-title">✓ All tests passed!</span>
        </div>
      </div>
    {:else}
      <div class="output-message test-results">
        <div class="message-header">
          <span class="message-title">Test Results:</span>
        </div>
        <div class="test-list">
          {#each testResults as result}
            <div class="test-item {result.passed ? 'passed' : 'failed'}">
              <div class="test-header">
                <span class="test-icon">{result.passed ? '✓' : '✗'}</span>
                <span class="test-name">{result.testName}</span>
              </div>
              {#if !result.passed}
                <p class="test-message">{result.message}</p>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {:else if hasError}
    <div class="output-message error">
      <div class="message-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
        <span class="message-title">Error</span>
      </div>
      <pre class="message-content">{error}</pre>
    </div>
  {:else if hasSuccess}
    <div class="output-message success">
      <div class="message-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
          />
        </svg>
        <span class="message-title">Success!</span>
      </div>
      {#if message}
        <p class="message-content">{message}</p>
      {/if}
    </div>
  {:else if isRunning}
    <div class="output-message info">
      <div class="message-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="spinner">
          <path
            d="M12 4V2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8z"
          />
        </svg>
        <span class="message-title">Running... ({stepCount} steps)</span>
      </div>
    </div>
  {:else if isPaused}
    <div class="output-message info">
      <div class="message-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        <span class="message-title">Paused at step {stepCount}</span>
      </div>
    </div>
  {:else}
    <div class="output-message idle">
      <p class="message-content">Ready to run your code.</p>
    </div>
  {/if}
</div>

<style>
  .karel-output {
    padding: 1rem;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    min-height: 80px;
  }

  .output-message {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  .message-title {
    font-size: 14px;
  }

  .message-content {
    margin: 0;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .error {
    color: #dc2626;
  }

  .error .message-content {
    border-left: 3px solid #dc2626;
  }

  .success {
    color: #16a34a;
  }

  .success .message-content {
    border-left: 3px solid #16a34a;
  }

  .info {
    color: #2563eb;
  }

  .idle {
    color: #666;
  }

  .test-results {
    color: #333;
  }

  .test-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .test-item {
    padding: 0.75rem;
    background: white;
    border-radius: 4px;
    border-left: 3px solid #ccc;
  }

  .test-item.passed {
    border-left-color: #16a34a;
  }

  .test-item.failed {
    border-left-color: #dc2626;
  }

  .test-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  .test-icon {
    font-size: 18px;
  }

  .test-item.passed .test-icon {
    color: #16a34a;
  }

  .test-item.failed .test-icon {
    color: #dc2626;
  }

  .test-name {
    font-size: 14px;
  }

  .test-message {
    margin: 0.5rem 0 0 0;
    padding: 0.5rem;
    background: #fef2f2;
    border-radius: 4px;
    font-size: 13px;
    color: #991b1b;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .spinner {
    animation: spin 1s linear infinite;
  }
</style>
