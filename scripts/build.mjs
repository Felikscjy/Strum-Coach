#!/usr/bin/env node
// Inline index.html + src/* into one self-contained HTML file.
//
//   node scripts/build.mjs              -> dist/strum-coach.html (public songs only)
//   node scripts/build.mjs --private    -> also include src/songs.private.js
//   node scripts/build.mjs --fragment   -> body-only fragment (for hosts that add their own <html> skeleton)
//   node scripts/build.mjs --with-lyrics -> also inline src/lyrics.js (only if you may redistribute those lyrics)
//   node scripts/build.mjs --out path   -> custom output path
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const outIdx = argv.indexOf('--out');
const out = resolve(root, outIdx >= 0 ? argv[outIdx + 1] : 'dist/strum-coach.html');
const read = f => readFileSync(resolve(root, f), 'utf8');

// Stamp index.html's src/ references with a content hash (?v=xxxxxxxx) so browsers
// fetch a file again as soon as it changes, instead of serving a stale cached copy.
{
  const src = read('index.html');
  const stamped = src.replace(/(href|src)="(src\/[^"?]+)(\?v=[^"]*)?"/g, (m, attr, f) => {
    const p = resolve(root, f);
    if (f.includes('.private.') || !existsSync(p)) return `${attr}="${f}"`;   // local-only files are never stamped
    const h = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 8);
    return `${attr}="${f}?v=${h}"`;
  });
  if (stamped !== src && !has('--fragment') && !has('--private')) { writeFileSync(resolve(root, 'index.html'), stamped); console.log('stamped index.html'); }
}

let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="(src\/[^"?]+)(?:\?[^"]*)?">/g, (_, f) => `<style>\n${read(f)}</style>`);
html = html.replace(/<script src="(src\/[^"?]+)(?:\?[^"]*)?"[^>]*><\/script>\n?/g, (_, f) => {
  if (f === 'src/lyrics.js' && !has('--with-lyrics')) return '';   // bundled lyrics stay on the website unless asked for
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
