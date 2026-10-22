/* Chart format: parser, chord shapes, right-hand tokens. No DOM work happens at load. */
const CHORDS = {
  C:'x32010',Cmaj7:'x32000',C7:'x32310',Cadd9:'x32030','C/G':'332010','C/E':'032010','C/B':'x22010',Cm7:'x35343',Cm:'x35543',
  D:'xx0232',Dm:'xx0231',D7:'xx0212',Dsus4:'xx0233',Dsus2:'xx0230',Dm7:'xx0211','D/F#':'200232',
  E:'022100',Em:'022000',E7:'020100',Em7:'022030',Esus4:'022200','E/G#':'422100',
  F:'133211',Fmaj7:'xx3210',Fm:'133111','F/C':'x33211',Fadd9:'xx3213',Fsus2:'xx3011',
  G:'320003',G7:'320001',Gsus4:'330013','G/B':'x20003',Gm:'355333',Gmaj7:'320002',
  A:'x02220',Am:'x02210',A7:'x02020',Am7:'x02010',Asus2:'x02200',Asus4:'x02230','Am/G':'302210','Am/F#':'202210',
  B:'x24442',Bm:'x24432',B7:'x21202',Bm7:'x24232',Bb:'x13331',Bbmaj7:'x13231',Bbsus2:'x13311',Bbm7:'x13121',
  Csus2:'x30033',Gsus2:'300033',A7sus4:'x0x233',F69:'xx3033',G5:'3x0033','F#':'244322','F#m':'244222','F#m7':'242222','G#m':'466444','C#m':'x46654','C#m7-5':'x4545x','C#m7b5':'x4545x',
};
const OPEN = [40,45,50,55,59,64];
const PC = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const UNIT = /[A-Za-z0-9']+|\*|[^\s\p{P}\p{S}]/gu;
const LYR = /[A-Za-z0-9']+|[㐀-鿿豈-﫿぀-ヿ가-힯]/g;
const WIN = 0.13, GOOD = 0.045;
const PART_KEY = {B:'S','4':'S','5':'S','6':'S',D:'S',X:'S',R:'S',T:'S','3':'J',U:'J','2':'K','1':'L'};
const STRUM_PART = {D:1, R:1, X:1, U:1, T:1};
let strumKeys = 'two';
try { strumKeys = JSON.parse(localStorage.getItem('strum3.strumKeys')) || 'two'; } catch(e){}
function keyOf(p){
  if (STRUM_PART[p]) return strumKeys === 'one' ? 'S' : (p === 'U' ? 'J' : 'F');
  const m = FRET.exec(p); if (m) return PART_KEY[m[1]];
  return PART_KEY[p];
}
const glyphOf = p => { const m = FRET.exec(p); return m ? m[2] : (GLYPH[p] || ''); };
const KEY_CAP = {S:'空格', F:'F', J:'J', K:'K', L:'L'};
const STR = {'6':0,'5':1,'4':2,'3':3,'2':4,'1':5};
const GLYPH = {D:'↓',U:'↑',R:'≀',X:'✕',T:'✱','4':'4','5':'5','6':'6'};

const $ = id => document.getElementById(id);
const store = { get(k,d){try{const v=localStorage.getItem('strum3.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('strum3.'+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem('strum3.'+k)}catch(e){}} };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- parsing ---------- */
function parseDur(s){ if (s.includes('/')){ const [a,b] = s.split('/').map(Number); return b ? a/b : 1; } return parseFloat(s); }
function normChord(n){
  n = n.trim().replace(/♯/g,'#').replace(/♭/g,'b');
  const m = n.match(/^([#b])([A-G])(.*)$/);
  return m ? m[2] + m[1] + m[3] : n;
}
function parseRH(s){
  s = (s||'').trim().toUpperCase(); if (!s) return null;
  const toks = /\s/.test(s) ? s.split(/\s+/) : s.split('');
  return toks.map(t => t.replace(/[^BDUXRTF0-9+\-]/g,'') || '-');
}
const FRET = /^([1-6])F(\d{1,2})$/;
const rhRes = (P, beats) => P.length % beats === 0 ? P.length / beats : 2;
const parts = tok => tok === '-' ? [] : tok.split('+').filter(p => PART_KEY[p] || FRET.test(p));

function parseSong(text){
  const song = {title:'未命名', source:'', bpm:80, beats:4, key:'', capo:0, lines:[], bars:[], changes:[], sections:[], warnings:[]};
  let sec = null, fresh = true, rh = null, meter = null, at = 0;
  const newSec = name => { sec = {name, bars:[], slots:0, filled:0, avail:null}; song.sections.push(sec); };
  for (const raw of text.split('\n')){
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (!line.includes('|')){
      const m = line.match(/^(title|bpm|beats|key|capo|source|rh|pattern|pick|标题|速度|拍号|调|变调夹|来源|右手|扫弦|分解)\s*[:：]\s*(.*)$/i);
      if (m){
        const k = m[1].toLowerCase(), v = m[2].trim();
        if (k==='title'||k==='标题') song.title = v;
        else if (k==='bpm'||k==='速度') song.bpm = Math.max(30, Math.min(240, parseInt(v)||80));
        else if (k==='beats'||k==='拍号'){ const n = Math.max(1, Math.min(7, parseInt(v)||4)); if (song.bars.length) meter = n; else song.beats = n; }
        else if (k==='key'||k==='调') song.key = v;
        else if (k==='source'||k==='来源') song.source = v;
        else if (k==='capo'||k==='变调夹') song.capo = parseInt(v)||0;
        else rh = parseRH(v);
        continue;
      }
      if (line.startsWith('##')){ newSec(line.replace(/^#+\s*/,'')); fresh = true; continue; }
      if (line.startsWith('#')) continue;
    }
    let ps = line.split('|');
    if (ps.length > 1){ if (!ps[0].trim()) ps.shift(); if (ps.length && !ps[ps.length-1].trim()) ps.pop(); }
    if (!sec) newSec('');
    const lineObj = {section:sec.name, sectionStart:fresh, bars:[]}; fresh = false;
    for (const p of ps){
      const first = song.bars.length === 0;
      const bb = meter || song.beats;
      const bar = parseBar(p.trim(), bb, first);
      bar.index = song.bars.length; bar.line = song.lines.length; bar.section = sec.name;
      bar.beats = bb; bar.start = at; at += bb;
      bar.rhOwn = !!bar.rh; if (!bar.rh) bar.rh = rh;
      if (bar.precise && !(first && bar.total < bb) && Math.abs(bar.total - bb) > 1e-6)
        song.warnings.push({bar:bar.index, total:+bar.total.toFixed(3), want:bb});
      lineObj.bars.push(bar); song.bars.push(bar); sec.bars.push(bar);
    }
    if (lineObj.bars.length) song.lines.push(lineObj);
  }
  let prev = null;
  for (const b of song.bars){
    b.startChord = prev;
    for (const c of b.chords){
      c.change = c.chord !== prev;
      if (c.change) song.changes.push({beat:b.start + c.at - 1, chord:c.chord});
      prev = c.chord;
    }
    if (b.chords.length && b.chords[0].at <= 1.001) b.startChord = b.chords[0].chord;
  }
  for (const s of song.sections) s.slots = s.bars.reduce((a,b) => a + b.syl.filter(x => x.slot).length, 0);
  return song;
}
function chordTok(t){
  const m = t.slice(1,-1).match(/^\s*([^@]+?)\s*(?:@\s*([\d.]+))?\s*$/);
  return m ? {chord:normChord(m[1]), at: m[2] ? parseFloat(m[2]) : null} : null;
}
function parseBar(s, beats, first){
  let rh = null;
  s = s.replace(/\{([^}]*)\}/g, (_, x) => { rh = parseRH(x); return ' '; });
  const toks = s.match(/\[[^\]]*\]|[^\s\[]+/g) || [];
  const isChord = t => t.startsWith('[');
  const precise = toks.some(t => !isChord(t) && /:[\d.]+(?:\/\d+)?$/.test(t));
  const chords = [], syl = [];
  let total = beats;
  if (precise){
    let pend = [];
    for (const t of toks){
      if (isChord(t)){ const c = chordTok(t); if (!c) continue; if (c.at != null) chords.push(c); else pend.push(c.chord); continue; }
      const m = t.match(/^(.*?)(?::([\d.]+(?:\/\d+)?))?$/);
      const tx = m[1];
      syl.push({text:tx, dur: m[2]!=null ? parseDur(m[2]) : null, rest: tx==='_'||tx==='0', tie: tx==='-'||tx==='~'||tx==='—', slot: tx==='*', pend});
      pend = [];
    }
    let fixed = 0, free = 0; syl.forEach(x => x.dur != null ? fixed += x.dur : free++);
    const share = free ? Math.max(0.25, (beats-fixed)/free) : 0;
    syl.forEach(x => { if (x.dur == null) x.dur = share; });
    total = syl.reduce((a,x) => a + x.dur, 0);
    let at = 1 + (first && total < beats - 1e-6 ? beats - total : 0);
    for (const x of syl){ x.at = at; at += x.dur; x.pend.forEach(c => chords.push({chord:c, at:x.at})); delete x.pend; }
    pend.forEach(c => chords.push({chord:c, at:Math.min(at, beats + 0.75)}));
  } else {
    let segs = [], cur = {chord:null, at:1, text:'', held:true};
    for (const t of toks){
      if (isChord(t)){ const c = chordTok(t); if (!c) continue; segs.push(cur); cur = {chord:c.chord, at:c.at, text:''}; }
      else cur.text += t;
    }
    segs.push(cur);
    segs = segs.filter(g => !(g.held && !g.text));
    if (!segs.length) segs = [{chord:null, at:1, text:'', held:true}];
    const n = segs.length;
    segs.forEach((g,i) => { if (g.at == null) g.at = i===0 ? 1 : 1 + Math.round(i*beats/n*2)/2; });
    for (let i=1;i<n;i++) segs[i].at = Math.min(beats+0.5, Math.max(segs[i].at, segs[i-1].at + 0.5));
    segs.forEach((g,i) => {
      g.dur = (i<n-1 ? segs[i+1].at : beats+1) - g.at;
      if (!g.held) chords.push({chord:g.chord, at:g.at});
      const us = g.text.match(UNIT) || [];
      us.forEach((t,j) => syl.push({text:t, at:g.at + j*g.dur/us.length, dur:g.dur/us.length, slot:t==='*'}));
    });
  }
  chords.sort((a,b) => a.at - b.at);
  return {chords, syl, rh, total, precise};
}
function fillLyrics(song, text){
  const blocks = {}, pool = []; let cur = null;
  for (const raw of (text||'').split('\n')){
    const l = raw.trim(), m = l.match(/^#{1,3}\s*(.+)$/);
    if (m){ cur = m[1].trim(); blocks[cur] = blocks[cur] || []; continue; }
    const us = l.replace(/[（(][^）)]*[）)]/g, ' ').match(LYR) || [];
    (cur != null ? blocks[cur] : pool).push(...us);
  }
  let pi = 0;
  for (const sec of song.sections){
    let src = blocks[sec.name];
    if (!src){ const k = Object.keys(blocks).filter(k => sec.name.startsWith(k)).sort((a,b) => b.length - a.length)[0]; if (k) src = blocks[k]; }
    let i = 0; sec.filled = 0; sec.avail = src ? src.length : null;
    for (const b of sec.bars) for (const x of b.syl) if (x.slot){
      const u = src ? src[i++] : pool[pi++];
      x.text = u ?? '○'; x.empty = u == null; if (u != null) sec.filled++;
    }
  }
  song.poolLeft = Math.max(0, pool.length - pi);
}

/* ---------- chords ---------- */
function shapeOf(name){
  if (!name) return null;
  if (CHORDS[name]) return CHORDS[name];
  const k = Object.keys(CHORDS).find(k => k.toLowerCase() === name.toLowerCase());
  return k ? CHORDS[k] : null;
}
const infoCache = {};
function chordInfo(name){
  if (!name) return null;
  if (name in infoCache) return infoCache[name];
  const sh = shapeOf(name); if (!sh) return infoCache[name] = null;
  const f = sh.split('').map(c => c==='x' ? -1 : parseInt(c,10));
  const m = name.match(/^([A-G][#b]?)[^/]*(?:\/([A-G][#b]?))?$/);
  const bass = m ? PC[m[2] || m[1]] : null;
  let root = -1;
  for (let i=0;i<6;i++) if (f[i] >= 0 && bass != null && (OPEN[i]+f[i]) % 12 === bass){ root = i; break; }
  if (root < 0) root = f.findIndex(v => v >= 0);
  return infoCache[name] = {f, root, midi: f.map((v,i) => v<0 ? null : OPEN[i]+v)};
}
function rootText(name){
  const ci = chordInfo(name); if (!ci) return '';
  const fr = ci.f[ci.root];
  return `根音：${6-ci.root}弦${fr===0 ? '空弦' : fr+'品'}`;
}
function diagram(name, withKeys){
  const ci = chordInfo(name);
  if (!ci) return `<text x="55" y="70" text-anchor="middle">${name ? '暂无指法图' : ''}</text>`;
  const f = ci.f, x0=17, dx=15.2, y0=28, dy=24;
  const pos = f.filter(v => v>0), max = Math.max(0,...pos), minp = pos.length ? Math.min(...pos) : 0;
  const base = max > 4 ? minp : 1;
  let out = base===1 ? `<line class="nut" x1="${x0}" y1="${y0}" x2="${x0+5*dx}" y2="${y0}" stroke-width="4"/>`
                     : `<text x="${x0-6}" y="${y0+dy*0.65}" text-anchor="end">${base}</text>`;
  for (let j=0;j<=4;j++) out += `<line class="fr" x1="${x0}" y1="${y0+j*dy}" x2="${x0+5*dx}" y2="${y0+j*dy}" stroke-width="1"/>`;
  for (let i=0;i<6;i++) out += `<line class="str" x1="${x0+i*dx}" y1="${y0}" x2="${x0+i*dx}" y2="${y0+4*dy}" stroke-width="${1.6-i*0.15}"/>`;
  const at = f.map((v,i) => v===minp ? i : -1).filter(i => i>=0);
  const lastPlayed = f.map((v,i) => v>=0 ? i : -1).filter(i => i>=0).pop();
  let barre = null;
  if (minp>0 && at.length>=2){ const a = at[0], b = at[at.length-1]; if (b-a>=2 && b===lastPlayed && f.slice(a,b+1).every(v => v>=minp)) barre = [a,b]; }
  if (barre){ const y = y0 + (minp-base+0.5)*dy; out += `<rect class="dot2" x="${x0+barre[0]*dx-6}" y="${y-6}" width="${(barre[1]-barre[0])*dx+12}" height="12" rx="6"/>`; }
  f.forEach((v,i) => {
    const x = x0+i*dx, isRoot = i===ci.root;
    if (v<0) out += `<path class="x" d="M${x-4} ${y0-14}l8 8M${x+4} ${y0-14}l-8 8" stroke-width="1.6"/>`;
    else if (v===0) out += `<circle class="${isRoot?'rooto':'open'}" cx="${x}" cy="${y0-10}" r="4" stroke-width="1.5"/>`;
    else if (barre && v===minp && i>=barre[0] && i<=barre[1]){ if (isRoot) out += `<circle class="rootd" cx="${x}" cy="${y0+(v-base+0.5)*dy}" r="4"/>`; }
    else out += `<circle class="${isRoot?'rootd':'dot2'}" cx="${x}" cy="${y0+(v-base+0.5)*dy}" r="6.2"/>`;
  });
  if (withKeys){
    const lab = {[ci.root]:'根', 3:'J', 4:'K', 5:'L'};
    for (const i in lab) out += `<text class="k ${+i===ci.root?'r':''}" x="${x0+i*dx}" y="${y0+4*dy+16}" text-anchor="middle">${lab[i]}</text>`;
  }
  return out;
}

