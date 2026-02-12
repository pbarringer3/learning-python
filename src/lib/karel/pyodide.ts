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
 * Validation result from Python AST checker
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  line?: number;
}

/**
 * Install the Python code validator into Pyodide
 */
export function installCodeValidator(pyodide: PyodideInterface): void {
  pyodide.runPython(`
import ast
import sys

def validate_karel_code(code):
    """
    Validate that code only uses allowed Karel playground features.
    
    Allowed:
    - Karel function calls (move, turn_left, etc.)
    - Function definitions with NO parameters
    - Loops (while, for with range)
    - Conditionals (if, elif, else)
    - Boolean operators (and, or, not)
    - Comments
    - Loop variables (e.g., i in 'for i in range(5)')
    
    Disallowed:
    - Variable assignments (except loop variables)
    - Function parameters
    - print() and other built-ins except range()
    - import statements
    - Classes
    - List/dict operations
    - Any other Python features
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {
            'valid': False,
            'error': f'Syntax error: {e.msg}',
            'line': e.lineno
        }
    
    # Define allowed Karel functions
    karel_functions = {
        'move', 'turn_left', 'pick_beeper', 'put_beeper',
        'front_is_clear', 'front_is_blocked',
        'beepers_present', 'no_beepers_present',
        'left_is_clear', 'left_is_blocked',
        'right_is_clear', 'right_is_blocked',
        'beepers_in_bag', 'no_beepers_in_bag',
        'facing_north', 'not_facing_north',
        'facing_south', 'not_facing_south',
        'facing_east', 'not_facing_east',
        'facing_west', 'not_facing_west'
    }
    
    # FIRST PASS: Collect all user-defined function names
    user_functions = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            user_functions.add(node.name)
    
    # SECOND PASS: Validate all nodes
    for node in ast.walk(tree):
        # Check for disallowed features
        
        # 1. No imports
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            return {
                'valid': False,
                'error': 'Import statements are not allowed. Use only Karel functions in this playground.',
                'line': node.lineno
            }
        
        # 2. No classes
        if isinstance(node, ast.ClassDef):
            return {
                'valid': False,
                'error': 'Classes are not allowed. Use functions to organize your Karel code.',
                'line': node.lineno
            }
        
        # 3. Check function definitions
        if isinstance(node, ast.FunctionDef):
            # No parameters allowed
            if node.args.args or node.args.posonlyargs or node.args.kwonlyargs or node.args.vararg or node.args.kwarg:
                return {
                    'valid': False,
                    'error': f'Function parameters are not allowed. Define "{node.name}()" with no parameters.',
                    'line': node.lineno
                }
        
        # 4. No variable assignments (except in for loops)
        if isinstance(node, ast.Assign):
            return {
                'valid': False,
                'error': 'Variable assignments are not allowed except in loop declarations.',
                'line': node.lineno
            }
        
        if isinstance(node, ast.AugAssign):
            return {
                'valid': False,
                'error': 'Variable assignments (including +=, -=, etc.) are not allowed.',
                'line': node.lineno
            }
        
        if isinstance(node, ast.AnnAssign):
            return {
                'valid': False,
                'error': 'Variable assignments are not allowed except in loop declarations.',
                'line': node.lineno
            }
        
        # 5. Check function calls - only Karel functions, user functions, and range() allowed
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
                # Allow Karel functions, user-defined functions, and range()
                if func_name not in karel_functions and func_name not in user_functions and func_name != 'range':
                    return {
                        'valid': False,
                        'error': f'Function "{func_name}()" is not allowed. Use only Karel functions, your own functions, or range().',
                        'line': node.lineno
                    }
        
        # 6. No list/dict/set literals or comprehensions
        if isinstance(node, (ast.List, ast.Dict, ast.Set)):
            return {
                'valid': False,
                'error': 'Lists, dictionaries, and sets are not allowed in this playground.',
                'line': node.lineno
            }
        
        if isinstance(node, (ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp)):
            return {
                'valid': False,
                'error': 'Comprehensions are not allowed in this playground.',
                'line': node.lineno
            }
        
        # 7. No subscripting (indexing)
        if isinstance(node, ast.Subscript):
            return {
                'valid': False,
                'error': 'Indexing and subscripting are not allowed in this playground.',
                'line': node.lineno
            }
        
        # 8. No lambda functions
        if isinstance(node, ast.Lambda):
            return {
                'valid': False,
                'error': 'Lambda functions are not allowed. Define regular functions instead.',
                'line': node.lineno
            }
        
        # 9. No try/except/finally
        if isinstance(node, (ast.Try, ast.ExceptHandler)):
            return {
                'valid': False,
                'error': 'Exception handling (try/except) is not allowed in this playground.',
                'line': node.lineno
            }
        
        # 10. No with statements
        if isinstance(node, ast.With):
            return {
                'valid': False,
                'error': 'With statements are not allowed in this playground.',
                'line': node.lineno
            }
        
        # 11. No async/await
        if isinstance(node, (ast.AsyncFunctionDef, ast.Await, ast.AsyncFor, ast.AsyncWith)):
            return {
                'valid': False,
                'error': 'Async/await syntax is not allowed in this playground.',
                'line': node.lineno
            }
        
        # 12. No global/nonlocal
        if isinstance(node, (ast.Global, ast.Nonlocal)):
            return {
                'valid': False,
                'error': 'Global and nonlocal keywords are not allowed.',
                'line': node.lineno
            }
        
        # 13. No yield (generators)
        if isinstance(node, (ast.Yield, ast.YieldFrom)):
            return {
                'valid': False,
                'error': 'Generator functions (yield) are not allowed in this playground.',
                'line': node.lineno
            }
        
        # 14. No delete statements
        if isinstance(node, ast.Delete):
            return {
                'valid': False,
                'error': 'Delete statements are not allowed in this playground.',
                'line': node.lineno
            }
    
    return {'valid': True}
`);
}

/**
 * Validate Python code against Karel playground restrictions
 */
export async function validateKarelCode(
  pyodide: PyodideInterface,
  code: string
): Promise<ValidationResult> {
  try {
    const result = pyodide.runPython(`validate_karel_code(${JSON.stringify(code)})`);
    return result.toJs({ dict_converter: Object.fromEntries }) as ValidationResult;
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown validation error'
    };
  }
}

/**
 * Execute Python code with validation
 */
export async function executePythonCode(
  pyodide: PyodideInterface,
  code: string,
  allowedFeatures: string[] = []
): Promise<void> {
  // Validate code first
  const validation = await validateKarelCode(pyodide, code);

  if (!validation.valid) {
    const error = new Error(validation.error || 'Invalid code');
    // Add line number to error if available
    if (validation.line) {
      (error as any).lineNumber = validation.line;
    }
    throw error;
  }

  // If validation passes, execute the code
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
                   'facing_west', 'not_facing_west',
                   'validate_karel_code', 'ast', 'sys']:
        del globals()[var]
`);
}
