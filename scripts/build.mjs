#!/usr/bin/env node
// Inline index.html + src/* into one self-contained HTML file.
//
//   node scripts/build.mjs              -> dist/strum-coach.html (public songs only)
//   node scripts/build.mjs --private    -> also include src/songs.private.js
//   node scripts/build.mjs --fragment   -> body-only fragment (for hosts that add their own <html> skeleton)
//   node scripts/build.mjs --out path   -> custom output path
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const outIdx = argv.indexOf('--out');
const out = resolve(root, outIdx >= 0 ? argv[outIdx + 1] : 'dist/strum-coach.html');
const read = f => readFileSync(resolve(root, f), 'utf8');

let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, f) => `<style>\n${read(f)}</style>`);
html = html.replace(/<script src="(src\/[^"]+)"[^>]*><\/script>\n?/g, (_, f) => {
  if (f.includes('.private.')) {
    if (!has('--private')) return '';
    if (!existsSync(resolve(root, f))) { console.warn(`skip ${f}: not found`); return ''; }
  }
  const code = read(f);
  if (code.includes('</script')) throw new Error(`${f} contains "</script", which would end the inline block`);
  return `<script>\n${code}\n</script>\n`;
});

if (has('--fragment')) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\n?/, '')
    .replace(/<meta name="viewport"[^>]*>\n?/, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
  html = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${head.replace(title, '').trim()}\n${body.trim()}\n`;
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
