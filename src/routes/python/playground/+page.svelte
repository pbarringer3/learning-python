<script lang="ts">
  import PythonEnvironment from '$lib/components/PythonEnvironment.svelte';
  import type { PythonConfig } from '$lib/python/config';

  // Chosen to make the point of the visualizer visible on the very first run:
  // `shopping` and `also_shopping` are one list with two names, so appending
  // through one changes what the other sees. Recursion then shows the call
  // stack growing and shrinking.
  const initialCode = `# Welcome to the Python playground!
# Press Step to walk through this line by line and watch the
# call stack and objects on the right.

shopping = ["apples", "bread"]
also_shopping = shopping
also_shopping.append("cheese")

print("shopping is", shopping)
print("Both names point at one list.")


def countdown(n):
  if n == 0:
    return "liftoff"
  print(n)
  return countdown(n - 1)


print(countdown(3))
`;

  const config: PythonConfig = {
    initialCode,
    persistenceKey: 'playground/python',
    showVisualizer: true
  };
</script>

<svelte:head>
  <title>Python Playground | Learning Python</title>
  <meta
    name="description"
    content="Write and run Python in your browser, one line at a time, and watch the call stack and objects change as it runs."
  />
</svelte:head>

<main class="mx-auto max-w-7xl px-4 py-8">
  <header class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Python Playground</h1>
    <p class="mt-1 text-gray-600">
      Write whatever you like and press <strong>Play</strong> to execute it, or
      <strong>Step</strong> to move through it one line at a time. Click a line number to set a
      breakpoint, then use <strong>To breakpoint</strong> to run straight there. The panel on the right
      shows the call stack and every object your program has in memory.
    </p>
  </header>

  <PythonEnvironment {config} />
</main>
