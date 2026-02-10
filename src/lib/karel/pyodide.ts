/**
 * Pyodide Integration for Karel the Robot
 * Handles loading Pyodide and injecting Karel commands
 */

import type { PyodideInterface } from 'pyodide';

// Declare loadPyodide on window
declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

let pyodideInstance: PyodideInterface | null = null;
let loadingPromise: Promise<PyodideInterface> | null = null;

/**
 * Load Pyodide dynamically from CDN
 */
async function ensurePyodideScript(): Promise<void> {
  // Check if already loaded
  if (typeof window.loadPyodide !== 'undefined') {
    return;
  }

  // Load the Pyodide script
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Pyodide script'));
    document.head.appendChild(script);
  });
}

/**
 * Load Pyodide (singleton pattern)
 */
export async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Ensure Pyodide script is loaded
    await ensurePyodideScript();

    // Now load Pyodide
    const pyodide = await window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
    });
    pyodideInstance = pyodide;
    return pyodide;
  })();

  return loadingPromise;
}

/**
 * Get the loaded Pyodide instance (throws if not loaded)
 */
export function getPyodide(): PyodideInterface {
  if (!pyodideInstance) {
    throw new Error('Pyodide not loaded. Call loadPyodide() first.');
  }
  return pyodideInstance;
}

/**
 * Check if Pyodide is loaded
 */
export function isPyodideLoaded(): boolean {
  return pyodideInstance !== null;
}

/**
 * Karel command callbacks interface
 */
export interface KarelCallbacks {
  move: () => void;
  turn_left: () => void;
  pick_beeper: () => void;
  put_beeper: () => void;
  front_is_clear: () => boolean;
  front_is_blocked: () => boolean;
  beepers_present: () => boolean;
  no_beepers_present: () => boolean;
  left_is_clear: () => boolean;
  left_is_blocked: () => boolean;
  right_is_clear: () => boolean;
  right_is_blocked: () => boolean;
  beepers_in_bag: () => boolean;
  no_beepers_in_bag: () => boolean;
  facing_north: () => boolean;
  not_facing_north: () => boolean;
  facing_south: () => boolean;
  not_facing_south: () => boolean;
  facing_east: () => boolean;
  not_facing_east: () => boolean;
  facing_west: () => boolean;
  not_facing_west: () => boolean;
}

/**
 * Inject Karel commands into Python global namespace
 */
export function injectKarelCommands(pyodide: PyodideInterface, callbacks: KarelCallbacks): void {
  // Movement & Actions
  pyodide.globals.set('move', callbacks.move);
  pyodide.globals.set('turn_left', callbacks.turn_left);
  pyodide.globals.set('pick_beeper', callbacks.pick_beeper);
  pyodide.globals.set('put_beeper', callbacks.put_beeper);

  // Conditionals - Front
  pyodide.globals.set('front_is_clear', callbacks.front_is_clear);
  pyodide.globals.set('front_is_blocked', callbacks.front_is_blocked);

  // Conditionals - Beepers on ground
  pyodide.globals.set('beepers_present', callbacks.beepers_present);
  pyodide.globals.set('no_beepers_present', callbacks.no_beepers_present);

  // Conditionals - Left/Right
  pyodide.globals.set('left_is_clear', callbacks.left_is_clear);
  pyodide.globals.set('left_is_blocked', callbacks.left_is_blocked);
  pyodide.globals.set('right_is_clear', callbacks.right_is_clear);
  pyodide.globals.set('right_is_blocked', callbacks.right_is_blocked);

  // Conditionals - Beepers in bag
  pyodide.globals.set('beepers_in_bag', callbacks.beepers_in_bag);
  pyodide.globals.set('no_beepers_in_bag', callbacks.no_beepers_in_bag);

  // Conditionals - Direction
  pyodide.globals.set('facing_north', callbacks.facing_north);
  pyodide.globals.set('not_facing_north', callbacks.not_facing_north);
  pyodide.globals.set('facing_south', callbacks.facing_south);
  pyodide.globals.set('not_facing_south', callbacks.not_facing_south);
  pyodide.globals.set('facing_east', callbacks.facing_east);
  pyodide.globals.set('not_facing_east', callbacks.not_facing_east);
  pyodide.globals.set('facing_west', callbacks.facing_west);
  pyodide.globals.set('not_facing_west', callbacks.not_facing_west);
}

/**
 * Execute Python code with restricted globals
 */
export async function executePythonCode(
  pyodide: PyodideInterface,
  code: string,
  allowedFeatures: string[] = []
): Promise<void> {
  // For now, execute directly
  // TODO: Implement restricted globals based on allowedFeatures
  await pyodide.runPythonAsync(code);
}

/**
 * Clear Python namespace (useful for resets)
 */
export function clearPythonNamespace(pyodide: PyodideInterface): void {
  pyodide.runPython(`
# Clear user-defined functions and variables
import sys
user_vars = [k for k in dir() if not k.startswith('_') and k not in sys.modules]
for var in user_vars:
    if var not in ['move', 'turn_left', 'pick_beeper', 'put_beeper', 
                   'front_is_clear', 'front_is_blocked', 
                   'beepers_present', 'no_beepers_present',
                   'left_is_clear', 'left_is_blocked',
                   'right_is_clear', 'right_is_blocked',
                   'beepers_in_bag', 'no_beepers_in_bag',
                   'facing_north', 'not_facing_north',
                   'facing_south', 'not_facing_south',
                   'facing_east', 'not_facing_east',
                   'facing_west', 'not_facing_west']:
        del globals()[var]
`);
}
