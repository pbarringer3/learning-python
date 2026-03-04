/**
 * Tests that all lesson files follow the 2-space Python indentation rule.
 *
 * All Python code provided as starting code (initialCode) and in markdown
 * Python code blocks must use 2 spaces for indentation — not 4.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

/** Recursively find all .svx files under a directory. */
function findSvxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSvxFiles(fullPath));
    } else if (entry.name.endsWith('.svx')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extract all initialCode template-literal contents from a file.
 * Matches `initialCode: \`...\`` patterns.
 */
function extractInitialCodeBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /initialCode:\s*`([\s\S]*?)`/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Extract the markdown portion of an .svx file (outside <script> tags),
 * then find all ```python ... ``` fenced code blocks within it.
 */
function extractMarkdownPythonBlocks(content: string): string[] {
  // Remove all <script ...>...</script> sections to get only markdown
  const markdown = content.replace(/<script[\s\S]*?<\/script>/g, '');
  const blocks: string[] = [];
  const regex = /```python\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Check whether a Python code block uses 4-space indentation.
 *
 * Returns a description of the violation if found, or null if OK.
 *
 * Detection: find the minimum non-zero leading-space count across all lines.
 * If the minimum is >= 4, the block is using 4-space (or wider) indentation.
 */
function check2SpaceIndentation(code: string): string | null {
  const lines = code.split('\n');
  let minIndent = Infinity;

  for (const line of lines) {
    // Skip blank lines and comment-only lines at column 0
    if (line.trim() === '') continue;

    const leadingSpaces = line.match(/^( +)/);
    if (leadingSpaces) {
      minIndent = Math.min(minIndent, leadingSpaces[1].length);
    }
  }

  if (minIndent !== Infinity && minIndent >= 4) {
    // Find the first offending line for a helpful error message
    const firstBadLine = lines.find((l) => {
      const m = l.match(/^( +)/);
      return m && m[1].length >= 4;
    });
    return `minimum indentation is ${minIndent} spaces (expected 2). First indented line: "${firstBadLine?.trim()}"`;
  }

  return null;
}

// ── Tests ────────────────────────────────────────────────────────────────────

const routesDir = join(__dirname, '../../routes');
const svxFiles = findSvxFiles(routesDir);

describe('lesson Python indentation (2-space rule)', () => {
  for (const filePath of svxFiles) {
    const relPath = relative(join(__dirname, '../../..'), filePath);

    describe(relPath, () => {
      const content = readFileSync(filePath, 'utf-8');

      const initialCodeBlocks = extractInitialCodeBlocks(content);
      if (initialCodeBlocks.length > 0) {
        initialCodeBlocks.forEach((block, i) => {
          it(`initialCode #${i + 1} uses 2-space indentation`, () => {
            const violation = check2SpaceIndentation(block);
            expect(violation, `initialCode #${i + 1}: ${violation}`).toBeNull();
          });
        });
      }

      const pythonBlocks = extractMarkdownPythonBlocks(content);
      if (pythonBlocks.length > 0) {
        pythonBlocks.forEach((block, i) => {
          it(`markdown Python block #${i + 1} uses 2-space indentation`, () => {
            const violation = check2SpaceIndentation(block);
            expect(violation, `markdown Python block #${i + 1}: ${violation}`).toBeNull();
          });
        });
      }
    });
  }
});
