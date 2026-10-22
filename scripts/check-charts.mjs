#!/usr/bin/env node
// Parse every chart and report problems: bars whose durations do not add up,
// chords with no shape in the dictionary, and lyric slots per section.
//
//   node scripts/check-charts.mjs                 -> songs.js (+ songs.private.js if present)
//   node scripts/check-charts.mjs my-song.txt     -> check chart files
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {}, document: { getElementById: () => null }, console };
vm.createContext(ctx);
const run = f => vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
run(resolve(root, 'src/chart.js'));

const charts = [];
const files = process.argv.slice(2);
if (files.length) {
  for (const f of files) charts.push({ id: f, src: readFileSync(f, 'utf8') });
} else {
  for (const f of ['src/songs.js', 'src/songs.private.js']) {
    const p = resolve(root, f);
    if (existsSync(p)) run(p);
  }
  charts.push(...(ctx.window.STRUM_PRIVATE_SONGS || []), ...(ctx.window.STRUM_SONGS || []));
}

let failed = 0;
for (const { id, src } of charts) {
  ctx.__src = src;
  const song = vm.runInContext('parseSong(__src)', ctx);
  const missing = new Set();
  for (const b of song.bars) for (const c of b.chords) if (!vm.runInContext(`chordInfo(${JSON.stringify(c.chord)})`, ctx)) missing.add(c.chord);
  const slots = song.sections.filter(s => s.slots).map(s => `${s.name || '—'} ${s.slots}`).join(', ');
  const ok = !song.warnings.length && !missing.size;
  if (!ok) failed++;
  console.log(`${ok ? 'ok ' : 'ERR'} ${song.title} [${id}] · ${song.bars.length} bars${slots ? ` · lyric slots: ${slots}` : ''}`);
  for (const w of song.warnings) console.log(`    bar ${w.bar + 1}: ${w.total} beats, expected ${w.want}`);
  if (missing.size) console.log(`    no chord shape for: ${[...missing].join(', ')} (add it to CHORDS in src/chart.js)`);
}
process.exit(failed ? 1 : 0);
