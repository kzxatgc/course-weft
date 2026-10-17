import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const forbiddenApis = /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b/g;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(path.slice(path.lastIndexOf('.'))) ? [path] : [];
  }));
  return files.flat();
}

const violations = [];
for (const path of await sourceFiles(sourceRoot)) {
  const content = await readFile(path, 'utf8');
  for (const match of content.matchAll(forbiddenApis)) {
    const line = content.slice(0, match.index).split('\n').length;
    violations.push(`${relative(sourceRoot, path)}:${line}: forbidden network API ${match[0]}`);
  }
}

if (violations.length > 0) {
  console.error(`Offline source guard failed:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Offline source guard passed.');
}
