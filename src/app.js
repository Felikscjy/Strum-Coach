/* song library: public songs from songs.js, your own charts from songs.private.js (not committed) */
const LIBRARY = [...(window.STRUM_PRIVATE_SONGS || []), ...(window.STRUM_SONGS || [])];
if (!LIBRARY.length) LIBRARY.push({id:'empty', src:'title: 新歌\nbeats: 4\n| [C]_:4 |'});
const NEWEST = window.STRUM_NEWEST || LIBRARY[0].id;

/* ---------- state ---------- */
let song, baseSong, curId;
const drill = {pat:'', chord:'', stage:store.get('stage','listen'), auto:store.get('autoSpeed',true), streak:0, hist:[]};
const isDrill = () => S.practice === 'drill';
const judgingOn = () => S.practice === 'keys' || (isDrill() && drill.stage !== 'listen');
const demoOn = () => isDrill() ? drill.stage !== 'solo' : S.demo;
const S = {
  bpm:80, speed:store.get('speed',100), trainer:store.get('trainer',false), warn:store.get('warn',2),
  cue:store.get('cue',true), mode:store.get('mode','all'), countIn:store.get('countIn',true),
  eighths:store.get('eighths',false), repeat:store.get('repeat',true), practice:store.get('practice','view'),
  demo:store.get('demo',false), calib:store.get('calib',0), input:store.get('input','keys'), sens:store.get('sens',6), calibMic:store.get('calibMic',80), override:null, loopA:0, loopB:0, pending:null,
};
const customs = () => store.get('customs', []);
const isBuiltin = id => LIBRARY.some(x => x.id === id);
function srcFor(id){
  const o = store.get('src:'+id, null); if (o != null) return o;
  const b = LIBRARY.find(x => x.id === id); return b ? b.src : '';
}
const titleOf = src => ((src.match(/^\s*(?:title|标题)\s*[:：]\s*(.+)$/mi) || [])[1] || '未命名').trim();
function renderSongSel(){
  const ids = [...LIBRARY.map(x => x.id), ...customs()];
  $('songSel').innerHTML = ids.map(id => `<option value="${esc(id)}"${id===curId?' selected':''}>${esc(titleOf(srcFor(id)))}</option>`).join('');
  $('revert').hidden = !isBuiltin(curId) || store.get('src:'+curId, null) == null;
  $('del').hidden = isBuiltin(curId);
}
function loadSong(id){
  if (playing) stop();
  curId = id; store.set('cur', id);
  $('src').value = srcFor(id); $('lyr').value = store.get('lyr:'+id, null) ?? bundledLyrics()[id] ?? '';
  build($('src').value, $('lyr').value);
  renderSongSel();
}
function build(src, lyr){
  const sg = parseSong(src);
  if (!sg.bars.length) throw new Error('没有找到小节，至少写一行带 | 的谱面');
  song = baseSong = sg; fillLyrics(baseSong, lyr);
  S.bpm = store.get('bpm:'+curId, song.bpm);
  const pats = songPatterns();
  drill.pat = store.get('drillpat:'+curId, pats[0] ? pats[0].code : 'B 3 2 3 1 3 2 3');
  drill.chord = store.get('drillchord:'+curId, (pats.find(x => x.code===drill.pat) || {}).chord || (baseSong.changes[0]||{}).chord || 'C');
  S.override = parseRH(store.get('rh:'+curId, ''));
  $('rhOverride').value = store.get('rh:'+curId, '');
  S.loopA = 0; S.loopB = song.bars.length-1; S.pending = null;
  $('songTitle').textContent = song.title;
  const meta = [];
  if (song.key) meta.push(`1=${song.key}`);
  const meters = [...new Set(song.bars.map(b => b.beats))];
  meta.push(meters.map(m => `${m}/4`).join(' + '));
  if (song.capo) meta.push(`<b>变调夹 ${song.capo} 品</b>`);
  meta.push(`${song.bars.length} 小节`);
  if (song.source) meta.push(`谱：${esc(song.source)}`);
  $('songMeta').innerHTML = meta.join(' · ');
  $('beatDots').innerHTML = Array.from({length:song.beats}, (_,i) => `<i class="${i===0?'one':''}"></i>`).join('');
  syncControls(); renderSheet(); renderReport(); renderDrill();
  lastMode = null; applyMode();
}
function songPatterns(){
  const out = [];
  for (const b of baseSong.bars){
    if (!b.rh) continue;
    const code = b.rh.join(' ');
    let e = out.find(x => x.code === code);
    if (b.rh.filter(t => t !== '-').length < 3) continue;
    if (b.rh.some(t => /\dF\d/.test(t))) continue;
    if (!e) out.push(e = {code, where:[], own:b.rhOwn, chord: (b.chords[0]||{}).chord || b.startChord});
    if (!e.where.includes(b.section)) e.where.push(b.section);
    e.own = e.own && b.rhOwn; e.n = (e.n||0) + 1;
  }
  return [...out.filter(x => !x.own), ...out.filter(x => x.own).sort((a,b) => b.n - a.n).slice(0,3)];
}
const DRILL_PRESETS = [
  {code:'D - D - D - D -', label:'四分全下'}, {code:'D - D U - U D U', label:'民谣万能'},
  {code:'B 3 2 3 1 3 2 3', label:'八分分解'}, {code:'B 3 2 1', label:'四分慢练'},
];
function drillSong(){
  const P = parseRH(drill.pat) || ['B','3','2','3','1','3','2','3'];
  const src = baseSong.bars.find(b => b.rh && b.rh.join(' ') === P.join(' '));
  const B = src ? src.beats : baseSong.beats;
  const chord = drill.chord || 'C';
  const bar = {index:0, line:0, section:'节奏练习', chords:[{chord, at:1, change:true}], syl:[], rh:P, startChord:chord, total:B, beats:B, start:0};
  return {title:baseSong.title, beats:B, capo:baseSong.capo, key:baseSong.key, bpm:baseSong.bpm, bars:[bar],
    lines:[{section:'节奏练习', sectionStart:true, bars:[bar]}], changes:[{beat:0, chord}], sections:[], warnings:[]};
}
function renderDrill(){
  const pats = songPatterns();
  const fromSong = pats.map(x => ({code:x.code, label:(x.where.length > 2 ? `${x.where.slice(0,2).join('、')} 等` : x.where.join('、')) + (x.own ? ' · 个别小节' : ''), chord:x.chord}));
  const all = [...fromSong, ...DRILL_PRESETS.filter(p => !fromSong.some(x => x.code.replace(/ /g,'') === p.code.replace(/ /g,'')))];
  const cur = drill.pat.replace(/ /g,'');
  $('drillPats').innerHTML = all.map((p,i) => `<button class="chip" data-i="${i}" aria-pressed="${p.code.replace(/ /g,'')===cur}"><small>${esc(p.label)}</small><code>${esc(p.code)}</code></button>`).join('');
  $('drillPats').onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const p = all[+b.dataset.i];
    drill.pat = p.code; store.set('drillpat:'+curId, p.code);
    if (p.chord){ drill.chord = p.chord; store.set('drillchord:'+curId, p.chord); }
    renderDrill(); if (isDrill()) reDrill();
  };
  const chords = [...new Set(baseSong.changes.map(c => c.chord))];
  if (!chords.includes(drill.chord)) chords.unshift(drill.chord);
  $('drillChord').innerHTML = chords.map(c => `<option${c===drill.chord?' selected':''}>${esc(c)}</option>`).join('');
  [...$('stageBtns').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v === drill.stage));
  $('autoSpeed').checked = drill.auto;
  renderDrillInfo();
}
function renderDrillInfo(){
  $('drillHist').innerHTML = drill.hist.map(c => `<i class="${c}"></i>`).join('') || '<span class="hint">还没有记录</span>';
  const tip = {listen:'只听不判分，跟着下面那行大声数拍', follow:'示范和你一起弹，跟上它', solo:'示范关掉了，只剩节拍器'}[drill.stage];
  $('drillInfo').textContent = `${tip} · 连续干净 ${drill.streak}/4 · 现在 ${S.bpm} BPM，原曲 ${baseSong.bpm}`;
}
function reDrill(){
  const was = playing; stop();
  song = drillSong(); view.line = -1; view.now = view.next = undefined; drawStatic(0);
  if (was) start();
}
let lastMode = null;
function applyMode(){
  const fromDrill = lastMode === 'drill' || lastMode === null; lastMode = S.practice;
  if (isDrill()){
    song = drillSong();
    S.bpm = store.get('drillbpm:'+curId, Math.max(40, Math.round(baseSong.bpm*0.7/4)*4));
    S.loopA = S.loopB = 0;
  } else {
    song = baseSong;
    S.bpm = store.get('bpm:'+curId, baseSong.bpm);
    if (fromDrill || S.loopB >= song.bars.length){ S.loopA = 0; S.loopB = song.bars.length-1; S.pending = null; }
    markLoop();
  }
  $('bpmVal').textContent = S.bpm;
  view.line = -1; view.now = view.next = undefined; drawStatic(song.bars[S.loopA].start);
  renderDrillInfo();
}
function renderReport(){
  const song = baseSong; let h = '';
  if (song.warnings.length) h += `<ul>${song.warnings.map(w => `<li class="warn">第 ${w.bar+1} 小节是 ${w.total} 拍，应为 ${w.want} 拍</li>`).join('')}</ul>`;
  const secs = song.sections.filter(s => s.slots);
  if (secs.length){
    h += `<ul>${secs.map(s => {
      const okFill = s.filled === s.slots;
      const extra = s.avail != null && s.avail !== s.slots ? `（这块歌词有 ${s.avail} 字）` : '';
      return `<li class="${okFill ? 'ok' : ''}">${esc(s.name || '未命名段落')}：${s.slots} 个空位，已填 ${s.filled}${extra}</li>`;
    }).join('')}</ul>`;
    if (song.poolLeft) h += `<div class="warn">还有 ${song.poolLeft} 个字没用上，检查一下歌词是不是多了或段落没对齐。</div>`;
  }
  $('report').innerHTML = h;
}

/* ---------- audio ---------- */
let ctx = null, timer = null, playing = false, wake = null;
let beatQ = [], nextTime = 0, k = 0, cin = 0, ended = false, expected = [], judged = {};
let stats = {good:0, ok:0, miss:0, extra:0, wrong:0, offs:[]};
let barStats = {}, serialTime = {}, evaluated = new Set();
const bs = s => barStats[s] || (barStats[s] = {exp:0, good:0, ok:0, miss:0, extra:0, wrong:0});
const tempo = iter => isDrill() ? S.bpm : S.bpm * (S.trainer ? Math.min(Math.max(S.speed,100), S.speed + 5*iter) : S.speed) / 100;
const barEnd = b => b.start + b.beats;
function barAt(beat){
  const bars = song.bars; let lo = 0, hi = bars.length-1;
  if (beat < 0) return 0;
  while (lo < hi){ const m = (lo+hi+1) >> 1; if (bars[m].start <= beat + 1e-9) lo = m; else hi = m-1; }
  return lo;
}
const loopBeats = () => [song.bars[S.loopA].start, barEnd(song.bars[S.loopB])];
const activeRH = bar => (!isDrill() && S.override) || (bar && bar.rh) || null;
function info(kk){
  const [a,b] = loopBeats();
  if (kk < cin) return {count:true, sb: a-(cin-kk), iter:0};
  const j = kk-cin, L = b-a, iter = Math.floor(j/L);
  if (!S.repeat && iter >= 1) return {end:true};
  const sb = a + (j%L);
  return {sb, iter, serial: iter*(S.loopB-S.loopA+1) + (barAt(sb)-S.loopA)};
}
function audible(perfMs){
  const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
  if (ts && ts.performanceTime > 0 && ts.contextTime > 0) return ts.contextTime + (perfMs - ts.performanceTime)/1000;
  return ctx.currentTime - (ctx.outputLatency||0) - (performance.now()-perfMs)/1000;
}
function click(t, freq, gain, dur=0.03){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+dur+0.02);
}
function cueAt(t){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(1320,t); o.frequency.linearRampToValueAtTime(1760,t+0.09);
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.16,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+0.2);
}
const GUITAR = window.STRUM_SAMPLES || {};

/* acoustic guitar sampler: real recordings (tonejs-instruments, MIT), one voice per string, room reverb */
const SMIDI = Object.keys(GUITAR).map(Number);
const bufs = {}; let samplesReady = false, loadP = null, bus = null, voices = [];
function setupGraph(){
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
  const master = ctx.createGain(); master.gain.value = 0.9;
  master.connect(comp).connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate*1.7), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c=0;c<2;c++){
    const d = ir.getChannelData(c); let lp = 0;
    for (let i=0;i<len;i++){
      const t = i/ctx.sampleRate; lp = lp*0.72 + (Math.random()*2-1)*0.28;
      d[i] = t < 0.012 ? 0 : lp * Math.exp(-t*3.6);
    }
  }
  const conv = ctx.createConvolver(); conv.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  bus = ctx.createGain();
  bus.connect(master); bus.connect(conv); conv.connect(wet).connect(master);
}
function loadSamples(){
  if (loadP) return loadP;
  loadP = Promise.all(SMIDI.map(async m => {
    const bin = Uint8Array.from(atob(GUITAR[m][1]), c => c.charCodeAt(0));
    bufs[m] = await ctx.decodeAudioData(bin.buffer);
  })).then(() => { samplesReady = SMIDI.length > 0; }).catch(() => {});
  return loadP;
}
const ksCache = new Map();
function ksBuf(midi){
  if (ksCache.has(midi)) return ksCache.get(midi);
  const sr = ctx.sampleRate, f = 440*Math.pow(2,(midi-69)/12), N = Math.max(2, Math.round(sr/f)), len = Math.floor(sr*1.6);
  const buf = ctx.createBuffer(1,len,sr), d = buf.getChannelData(0), ring = new Float32Array(N);
  let prev = 0; for (let i=0;i<N;i++){ prev = prev*0.45 + (Math.random()*2-1)*0.55; ring[i] = prev; }
  let p = 0;
  for (let i=0;i<len;i++){ const a = ring[p], n = (p+1)%N; d[i] = a; ring[p] = (a + ring[n]) * 0.4985; p = n; }
  ksCache.set(midi, buf); return buf;
}
function damp(si, t){
  const v = voices[si]; if (!v) return;
  try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.012); v.src.stop(t + 0.12); } catch(e){}
  voices[si] = null;
}
function playNote(midi, t, vel, si, bright){
  if (!bus) return;
  t = Math.max(t, ctx.currentTime);
  const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  let off = 0;
  if (samplesReady){
    let best = SMIDI[0], bd = 99;
    for (const m of SMIDI){ const d = midi - m; if (Math.abs(d) < Math.abs(bd)){ bd = d; best = m; } }
    src.buffer = bufs[best]; src.playbackRate.value = Math.pow(2, bd/12); off = GUITAR[best][0];
  } else { src.buffer = ksBuf(midi); vel *= 0.6; }
  f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 0.4;
  g.gain.setValueAtTime(vel, t);
  let out = g;
  if (ctx.createStereoPanner && si != null){ const pn = ctx.createStereoPanner(); pn.pan.value = (si-2.5)*0.09; g.connect(pn); out = pn; }
  src.connect(f).connect(g); out.connect(bus);
  if (si != null) damp(si, t);
  src.start(t, off);
  if (si != null) voices[si] = {src, g};
}
const jitter = n => (Math.random()-0.5)*n;
let noiseBuf = null;
function slap(t, vol){
  if (!bus) return;
  t = Math.max(t, ctx.currentTime);
  if (!noiseBuf){ noiseBuf = ctx.createBuffer(1, ctx.sampleRate*0.2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; }
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
  g.gain.setValueAtTime(vol*0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.07);
  n.connect(bp).connect(g).connect(bus); n.start(t); n.stop(t+0.1);
  const o = ctx.createOscillator(), g2 = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t+0.08);
  g2.gain.setValueAtTime(vol*0.8, t); g2.gain.exponentialRampToValueAtTime(0.001, t+0.12);
  o.connect(g2).connect(bus); o.start(t); o.stop(t+0.14);
  for (let i=0;i<6;i++) damp(i, t + 0.005);
}
function sound(part, chord, t, vol){
  const cap = song.capo || 0;
  if (part === 'T'){ slap(t, vol); return; }
  if (FRET.test(part)){ const m = FRET.exec(part), si = 6 - +m[1]; playNote(OPEN[si] + +m[2] + cap, t + jitter(0.002), vol*0.9, si, 4600); return; }
  const ci = chordInfo(chord); if (!ci) return;
  const played = [0,1,2,3,4,5].filter(i => ci.midi[i] != null);
  if (part==='D' || part==='R' || part==='X'){
    const gap = part==='R' ? 0.05 : 0.011 + Math.random()*0.004;
    played.forEach((i,j) => playNote(ci.midi[i]+cap, t + j*gap + jitter(0.003), vol*0.62*(0.9+Math.random()*0.2)*(1-j*0.025), i, part==='R' ? 4200 : 5200));
    if (part==='X'){ const tm = t + played.length*gap + 0.04; for (let i=0;i<6;i++) damp(i, tm); }
  } else if (part==='U'){
    played.filter(i => i>=2).reverse().slice(0,4).forEach((i,j) => playNote(ci.midi[i]+cap, t + j*0.009 + jitter(0.003), vol*0.42*(0.9+Math.random()*0.2), i, 6500));
  } else if (FRET.test(part)){
    const m = FRET.exec(part), si = 6 - +m[1];
    playNote(OPEN[si] + +m[2] + cap, t + jitter(0.002), vol*0.9, si, 4600);
  } else {
    const si = part==='B' ? ci.root : STR[part];
    if (si != null && ci.midi[si] != null) playNote(ci.midi[si]+cap, t + jitter(0.002), vol*(part==='B' ? 1.05 : 0.85), si, part==='B' ? 3800 : 4800);
  }
}
function chordAt(beat){
  let c = null;
  for (const ch of song.changes){ if (ch.beat <= beat + 1e-6) c = ch.chord; else break; }
  return c;
}
function schedule(){
  const keys = S.practice !== 'view', judge = judgingOn(), demo = demoOn();
  while (nextTime < ctx.currentTime + 0.15){
    const inf = info(k);
    if (inf.end){ if (!ended){ ended = true; setTimeout(stop, Math.max(0,(nextTime-ctx.currentTime)*1000)+300); } return; }
    const spb = 60/tempo(inf.iter), sb = inf.sb;
    const cb = song.bars[inf.count ? S.loopA : barAt(sb)], B = cb.beats;
    const bi = inf.count ? ((sb - cb.start) % B + B) % B : sb - cb.start;
    const vol = keys || demo ? 0.55 : 1;
    if (!inf.count && bi === 0) serialTime[inf.serial] = nextTime;
    click(nextTime, bi===0 ? 1560 : 1040, (bi===0 ? 0.2 : 0.12)*vol);
    if (S.eighths && !keys) click(nextTime + spb/2, 760, 0.05, 0.02);
    if (S.cue && !inf.count){
      const [a,b] = loopBeats(); let x = sb + S.warn;
      if (x >= b && S.repeat) x -= (b-a);
      const c = song.changes.find(c => c.beat >= x-1e-6 && c.beat < x+1-1e-6 && c.beat >= a && c.beat < b);
      if (c) cueAt(nextTime + (c.beat - x)*spb + 0.03);
    }
    if (!inf.count && (judge || demo)){
      const barI = cb.index, P = activeRH(cb);
      if (P){
        const r = rhRes(P,B);
        for (let i=0;i<r;i++){
          const s = bi*r + i, t = nextTime + i*spb/r, chord = chordAt(sb + i/r), seen = new Set();
          const ps = parts(P[s % P.length]);
          if (judge && S.input === 'mic' && ps.length){
            expected.push({t, key:'M', parts:ps, chord, s, bar:barI, serial:inf.serial, judged:false, ...noteInfo(ps, chord, sb + i/r)}); bs(inf.serial).exp++;
          }
          for (const p of ps){
            const key = keyOf(p);
            if (judge && S.input !== 'mic' && !seen.has(key)){ expected.push({t, key, part:p, chord, s, bar:barI, serial:inf.serial, judged:false}); seen.add(key); bs(inf.serial).exp++; }
            if (demo) sound(p, chord, t, 0.42);
          }
        }
      }
    }
    beatQ.push({time:nextTime, spb, inf});
    if (beatQ.length > 32) beatQ.splice(0, beatQ.length-32);
    nextTime += spb; k++;
  }
}
function ensureCtx(){
  if (!ctx){ ctx = new (window.AudioContext||window.webkitAudioContext)(); setupGraph(); loadSamples(); }
  if (ctx.state === 'suspended') ctx.resume();
}
let starting = false;
async function start(){
  if (playing || starting) return;
  ensureCtx();
  starting = true;
  if (judgingOn() && S.input === 'mic' && !(await micStart())){ starting = false; return; }
  await Promise.race([loadP, new Promise(r => setTimeout(r, 1500))]);
  starting = false;
  cin = S.countIn ? song.bars[S.loopA].beats : 0; k = 0; beatQ = []; expected = []; judged = {}; ended = false;
  stats = {good:0, ok:0, miss:0, extra:0, wrong:0, offs:[]}; $('fb').textContent = '';
  barStats = {}; serialTime = {}; evaluated = new Set(); drill.streak = 0; drill.hist = []; renderDrillInfo();
  nextTime = ctx.currentTime + 0.1; playing = true;
  $('board').classList.add('playing'); updateStats();
  focus.bar = -2;
  schedule(); timer = setInterval(schedule, 25);
  setPlayBtn(); try{ wake = await navigator.wakeLock?.request('screen'); }catch(e){}
  requestAnimationFrame(frame);
}
function stop(){
  if (!playing) return;
  playing = false; clearInterval(timer); setPlayBtn();
  try{ wake?.release(); }catch(e){} wake = null;
  $('board').classList.remove('playing');
  $('countin').hidden = true;
  drawStatic(song.bars[S.loopA].start);
}
function setPlayBtn(){
  $('playBtn').querySelector('span').textContent = playing ? '停止' : '开始';
  $('playBtn').querySelector('svg').innerHTML = playing ? '<rect x="1" y="1" width="8" height="8"/>' : '<path d="M1 0l9 5-9 5z"/>';
  $('playBtn').setAttribute('aria-label', playing ? '停止' : '开始');
}

/* ---------- judging ---------- */
function defaultPart(key){
  const P = activeRH(song.bars[Math.max(0, view.bar)]) || [];
  const all = P.flatMap(parts);
  if (key==='F') return 'D';
  if (key==='S') return all.includes('D') && !all.includes('B') ? 'D' : 'B';
  if (key==='J') return (strumKeys === 'two' && all.includes('U') && !all.includes('3')) ? 'U' : (all.includes('3') ? '3' : (all.includes('U') ? 'U' : '3'));
  return key==='K' ? '2' : '1';
}
function onKey(key, ts, hint){
  ensureCtx();
  let match = null, bd = 9;
  const judging = playing && judgingOn() && S.input !== 'mic';
  if (judging){
    const t = audible(ts) - S.calib/1000;
    for (const e of expected){ if (e.judged || e.key !== key) continue; const d = t - e.t; if (Math.abs(d) < Math.abs(bd)){ bd = d; match = e; } }
    if (match && Math.abs(bd) > WIN) match = null;
  }
  sound(match ? match.part : (hint || defaultPart(key)), view.now, ctx.currentTime, 0.5);
  if (!judging){ flashPad(key,'hit'); return; }
  if (match){
    match.judged = true;
    const ms = Math.round(bd*1000), cls = Math.abs(bd) <= GOOD ? 'good' : 'ok';
    stats[cls]++; bs(match.serial)[cls]++; stats.offs.push(ms); if (stats.offs.length > 64) stats.offs.shift();
    markDot(match, cls); flashPad(key, cls);
    feedback(cls==='good' ? '准' : (ms<0 ? `早 ${-ms}ms` : `晚 ${ms}ms`), cls);
  } else {
    stats.extra++; if (focus.serial >= 0) bs(focus.serial).extra++; flashPad(key,'bad');
    const t = audible(ts) - S.calib/1000;
    const other = expected.find(e => !e.judged && e.key !== key && (e.key === 'F' || e.key === 'J') && (key === 'F' || key === 'J') && STRUM_PART[e.part] && Math.abs(t - e.t) <= WIN);
    feedback(other ? (other.key === 'F' ? '这下是下扫（F）' : '这下是上扫（J）') : '多按了一下', 'bad');
  }
  updateStats();
}
function sweep(now){
  let changed = false;
  for (const e of expected){
    if (!e.judged && now > e.t + WIN + (e.key === 'M' ? S.calibMic/1000 + 0.03 : 0)){ e.judged = true; stats.miss++; bs(e.serial).miss++; markDot(e,'miss'); changed = true; feedback('漏了', 'bad'); }
  }
  if (expected.length > 120) expected = expected.filter(e => !e.judged || e.t > now - 1);
  if (changed) updateStats();
}
function evaluateBars(now){
  for (const k in serialTime){
    const s = +k;
    if (evaluated.has(s) || serialTime[s+1] == null || now < serialTime[s+1] + WIN + 0.08) continue;
    evaluated.add(s);
    const st = barStats[s]; if (!st || !st.exp) continue;
    const clean = !st.miss && !st.extra && !st.wrong, cls = clean ? (st.ok ? 'c' : 'p') : 'x';
    drill.hist.push(cls); if (drill.hist.length > 16) drill.hist.shift();
    drill.streak = clean ? drill.streak + 1 : 0;
    if (drill.auto && drill.streak >= 4){
      drill.streak = 0;
      if (S.bpm < baseSong.bpm){ S.bpm = Math.min(baseSong.bpm, S.bpm + 4); store.set('drillbpm:'+curId, S.bpm); $('bpmVal').textContent = S.bpm; feedback(`提速到 ${S.bpm}`, 'good'); }
      else feedback('已经是原曲速度了', 'good');
    }
    renderDrillInfo();
  }
}
function markDot(e, cls){
  judged[`${e.serial}|${e.bar}|${e.s}-${e.key}`] = cls;
  if (focus.serial === e.serial && focus.bar === e.bar){
    const sel = e.key === 'M' ? `[data-s="${e.s}"]` : `[data-s="${e.s}"][data-k="${e.key}"]`;
    $('ftracks').querySelectorAll(sel).forEach(d => { d.classList.remove('on','good','ok','miss','wrong'); d.classList.add(cls); });
  }
}
let fbTimer;
function feedback(txt, cls){ const f = $('fb'); f.textContent = txt; f.className = 'only-keys fb ' + cls; clearTimeout(fbTimer); fbTimer = setTimeout(() => { f.textContent = ''; }, 600); }
function flashPad(key, cls){
  const p = document.querySelector(`.pad[data-k="${key}"]`); if (!p) return;
  p.classList.remove('good','ok','bad','hit'); void p.offsetWidth; p.classList.add(cls);
  setTimeout(() => p.classList.remove(cls), 140);
}
function updateStats(){
  const mic = S.input === 'mic';
  const n = stats.good + stats.ok + stats.miss + stats.wrong;
  if (!n && !stats.extra){ $('stats').innerHTML = mic ? (playing ? '跟着谱弹，工具在听' : (matchMedia('(pointer:coarse)').matches ? '戴上耳机，点「开始」再弹' : '戴上耳机，按 <kbd>Enter</kbd> 开始弹')) : (playing ? '跟着圆点按键' : (matchMedia('(pointer:coarse)').matches ? '点「开始」，跟着圆点在六线谱上弹' : '按 <kbd>空格</kbd> 开始，跟着圆点按键')); return; }
  const avg = stats.offs.length ? Math.round(stats.offs.reduce((a,b)=>a+b,0)/stats.offs.length) : 0;
  const pct = n ? Math.round((stats.good + stats.ok*0.5)/n*100) : 0;
  const tend = Math.abs(avg) < 12 ? '很稳' : avg < 0 ? '整体偏早' : '整体偏晚';
  $('stats').innerHTML = `得分 <em>${pct}%</em> · 准 <em>${stats.good}</em> · 偏 <em>${stats.ok}</em> · 漏 <em>${stats.miss}</em>${mic ? ` · 音不对 <em>${stats.wrong}</em>` : ''} · ${mic ? '多余' : '多按'} <em>${stats.extra}</em> · 平均 <em>${avg>0?'+':''}${avg}ms</em> ${tend}`;
}

/* ---------- listening to the guitar ---------- */
const PCN = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
function chordMidis(chord){
  const ci = chordInfo(chord); if (!ci) return [];
  return ci.midi.filter(m => m != null).map(m => m + (song.capo||0));
}
function noteInfo(ps, chord, beat){
  const cap = song.capo || 0, notes = new Set();
  let strum = false;
  for (const p of ps){
    if (STRUM_PART[p] && p !== 'T') strum = true;
    for (const nt of partNotes(p, chord)) if (nt.fret >= 0) notes.add(OPEN[nt.si] + nt.fret + cap);
  }
  let prevChord = null;
  for (const c of song.changes){ if (c.beat <= beat + 1e-6) { if (beat - c.beat < 1.01 && c.beat > 0) prevChord = chordAt(c.beat - 0.001); } else break; }
  if (prevChord === chord) prevChord = null;
  return {notes:[...notes], strum, prevChord};
}
function fft(re, im){
  const n = re.length;
  for (let i=1, j=0; i<n; i++){ let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j){ [re[i],re[j]] = [re[j],re[i]]; [im[i],im[j]] = [im[j],im[i]]; } }
  for (let len=2; len<=n; len<<=1){
    const ang = -2*Math.PI/len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i=0; i<n; i+=len){
      let cr = 1, ci = 0;
      for (let k=0; k<len/2; k++){
        const a = i+k, b = a+len/2, xr = re[b]*cr - im[b]*ci, xi = re[b]*ci + im[b]*cr;
        re[b] = re[a]-xr; im[b] = im[a]-xi; re[a] += xr; im[a] += xi;
        const t = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = t;
      }
    }
  }
}
const HANN = (() => { const N = 4096, w = new Float64Array(N); for (let i=0;i<N;i++) w[i] = 0.5 - 0.5*Math.cos(2*Math.PI*i/(N-1)); return w; })();
function chroma(get, start, sr){
  const N = 4096, re = new Float64Array(N), im = new Float64Array(N);
  for (let i=0;i<N;i++) re[i] = get(start+i) * HANN[i];
  fft(re, im);
  const c = new Float64Array(12);
  for (let k=2; k<N/2; k++){
    const f = k*sr/N; if (f < 70) continue; if (f > 2400) break;
    const pc = ((Math.round(12*Math.log2(f/440)) + 69) % 12 + 12) % 12;
    c[pc] += Math.sqrt(re[k]*re[k] + im[k]*im[k]);
  }
  return c;
}
function templ(midis){ const t = new Float64Array(12); for (const m of midis){ t[m%12] += 1; t[(m+7)%12] += 0.3; t[(m+4)%12] += 0.12; } return t; }
function cosSim(a, b){ let d=0, x=0, y=0; for (let i=0;i<12;i++){ d += a[i]*b[i]; x += a[i]*a[i]; y += b[i]*b[i]; } return x && y ? d/Math.sqrt(x*y) : 0; }
function bestChord(c){
  let best = null, bv = -1;
  for (const name of new Set(song.changes.map(x => x.chord))){ const v = cosSim(c, templ(chordMidis(name))); if (v > bv){ bv = v; best = name; } }
  return best;
}
function verdict(post, pre, ev){
  if (!ev.notes.length) return {ok:true};
  if (!ev.strum && ev.notes.length === 1){
    const d = new Float64Array(12); let mx = 0;
    for (let i=0;i<12;i++){ d[i] = Math.max(0, post[i] - 0.8*pre[i]); mx = Math.max(mx, d[i]); }
    const pc = ev.notes[0] % 12;
    if (!mx) return {ok:true};
    const ok = d[pc] >= 0.5*mx || d[(pc+7)%12] === mx && d[pc] >= 0.3*mx;
    const top = d.indexOf(mx);
    return {ok, msg: ok ? '' : `音不对，听到的像 ${PCN[((top - (song.capo||0)) % 12 + 12) % 12]}`};
  }
  const exp = cosSim(post, templ(ev.notes));
  if (ev.prevChord){
    const prv = cosSim(post, templ(chordMidis(ev.prevChord)));
    if (prv > exp + 0.05) return {ok:false, msg:`还没换到 ${ev.chord}`};
  }
  if (exp >= 0.62) return {ok:true};
  return {ok:false, msg:`和弦不对，听起来像 ${bestChord(post) || '别的和弦'}`};
}
function makeDetector(sr, onOnset){
  const BL = 256; let prev = 0, hist = [], noise = 1e-6, last = -1e9, n = 0;
  return x => {
    const k = 34 - S.sens*3;                                  // sensitivity 1..10 -> threshold factor
    for (let o=0; o+BL<=x.length; o+=BL){
      let e = 0, pk = 0, pi = 0;
      for (let i=0;i<BL;i++){ const v = x[o+i], y = v - prev; prev = v; e += y*y; const a = Math.abs(y); if (a > pk){ pk = a; pi = i; } }
      e /= BL;
      const mn = hist.length ? Math.min(...hist) : e, idx = n + o + pi;
      if (e > Math.max(noise*k, 2e-7) && e > mn*2.2 && idx - last > sr*0.07){ last = idx; onOnset(idx); }
      hist.push(e); if (hist.length > 6) hist.shift();
      noise = e < noise*3 ? noise*0.99 + e*0.01 : noise*1.0004;
    }
    n += x.length;
  };
}
const MIC = {on:false, ring:new Float32Array(1<<16), n:0, tEnd:0, pend:[], level:0, cal:null};
function micGet(i){ return MIC.ring[i & (MIC.ring.length-1)]; }
async function micStart(){
  ensureCtx();
  if (MIC.on) return true;
  let stream;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nomedia');
    stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}});
  } catch(e){ micHelp(); return false; }
  const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(1024, 1, 1), mute = ctx.createGain();
  mute.gain.value = 0;
  const det = makeDetector(ctx.sampleRate, idx => micOnset(idx));
  proc.onaudioprocess = e => {
    const x = e.inputBuffer.getChannelData(0), N = x.length, R = MIC.ring, M = R.length - 1;
    for (let i=0;i<N;i++) R[(MIC.n+i) & M] = x[i];
    let pk = 0; for (let i=0;i<N;i++){ const a = Math.abs(x[i]); if (a > pk) pk = a; }
    MIC.level = Math.max(pk, MIC.level*0.85);
    MIC.tEnd = ctx.currentTime; MIC.nEnd = MIC.n + N;
    det(x);
    MIC.n += N;
    micPending();
  };
  src.connect(proc); proc.connect(mute).connect(ctx.destination);
  MIC.on = true; MIC.keep = [src, proc, mute, stream];
  $('micState').textContent = '麦克风已开启';
  (function meter(){ $('micLevel').style.width = Math.min(100, MIC.level*160) + '%'; requestAnimationFrame(meter); })();
  return true;
}
function micHelp(){
  showPanel(`<h3>这里用不了麦克风</h3>
    <p>这个页面没有拿到麦克风权限。嵌在别的网站里打开时（例如在 Claude 的预览里），浏览器不允许网页使用麦克风。有两种办法：</p>
    <p>① 用电脑上的 Chrome 直接打开单文件版本（dist/strum-coach.html）或部署好的 HTTPS 页面，允许使用麦克风，就能边弹边实时判定。</p>
    <p>② 戴着耳机跟着节拍器弹，同时用手机录音，录完点「上传录音分析」。</p>
    <p>如果你已经在用本地版本，点地址栏左边的图标，把麦克风改成允许，再按开始。</p>
    <div class="row"><label class="ghost" for="recFile" style="cursor:pointer">上传录音分析</label></div>`);
}
function micOnset(idx){
  const raw = MIC.tEnd - (MIC.nEnd - idx)/ctx.sampleRate;
  if (MIC.cal){ MIC.cal.ons.push(raw); return; }
  if (!playing || !judgingOn() || S.input !== 'mic') return;
  const t = raw - S.calibMic/1000;
  let match = null, bd = 9;
  for (const e of expected){ if (e.judged || e.key !== 'M') continue; const d = t - e.t; if (Math.abs(d) < Math.abs(bd)){ bd = d; match = e; } }
  if (!match || Math.abs(bd) > WIN){ stats.extra++; if (focus.serial >= 0) bs(focus.serial).extra++; feedback('多了一个音', 'bad'); updateStats(); return; }
  match.judged = true;
  const ms = Math.round(bd*1000), cls = Math.abs(bd) <= GOOD ? 'good' : 'ok';
  stats[cls]++; bs(match.serial)[cls]++; stats.offs.push(ms); if (stats.offs.length > 64) stats.offs.shift();
  markDot(match, cls);
  feedback(cls==='good' ? '准' : (ms<0 ? `早 ${-ms}ms` : `晚 ${ms}ms`), cls);
  updateStats();
  if (match.notes.length) MIC.pend.push({idx, ev:match, cls});
}
function micPending(){
  const sr = ctx.sampleRate, need = Math.round(sr*0.012) + 4096;
  while (MIC.pend.length && MIC.n >= MIC.pend[0].idx + need){
    const {idx, ev, cls} = MIC.pend.shift();
    const post = chroma(micGet, idx + Math.round(sr*0.012), sr), pre = chroma(micGet, idx - 4096 - 64, sr);
    const v = verdict(post, pre, ev);
    if (!v.ok){
      stats[cls]--; stats.wrong++; bs(ev.serial)[cls]--; bs(ev.serial).wrong++;
      markDot(ev, 'wrong'); feedback(v.msg, 'bad'); updateStats();
    }
  }
}
async function micCalibrate(){
  if (!(await micStart())) return;
  if (playing) stop();
  const t0 = ctx.currentTime + 0.8, gap = 0.6, clicks = [];
  for (let i=0;i<8;i++){ clicks.push(t0 + i*gap); click(t0 + i*gap, i ? 1040 : 1560, 0.2); }
  MIC.cal = {ons:[]};
  $('micCalVal').textContent = '跟着 8 下滴答声，每下拨一次弦…';
  setTimeout(() => {
    const ons = MIC.cal.ons; MIC.cal = null;
    const offs = clicks.map(c => { let b = null; for (const o of ons){ const d = o - c; if (d > -0.15 && d < 0.4 && (b == null || Math.abs(d) < Math.abs(b))) b = d; } return b; }).filter(x => x != null).sort((a,b) => a-b);
    if (offs.length < 5){ $('micCalVal').textContent = `只听到 ${offs.length} 下，靠近麦克风或调高灵敏度再试`; return; }
    S.calibMic = Math.max(0, Math.round(offs[offs.length >> 1]*1000)); store.set('calibMic', S.calibMic);
    $('micCalVal').textContent = `延迟 ${S.calibMic}ms，已保存`;
  }, (0.8 + 8*gap + 0.6)*1000);
}
function showPanel(html){ const p = $('panel'); p.innerHTML = html + '<div class="row"><button class="ghost" id="panelClose">关闭</button></div>'; p.hidden = false; $('panelClose').onclick = () => { p.hidden = true; }; }

/* analyse an uploaded recording against the current loop */
async function analyzeRecording(file){
  ensureCtx();
  showPanel('<h3>正在分析录音…</h3><p>解码和对齐需要几秒钟。</p>');
  let buf;
  try { buf = await ctx.decodeAudioData(await file.arrayBuffer()); }
  catch(e){ showPanel('<h3>读不了这个文件</h3><p>换成 m4a、mp3 或 wav 格式再试。</p>'); return; }
  const sr = buf.sampleRate, L = buf.length, x = new Float32Array(L);
  for (let c=0;c<buf.numberOfChannels;c++){ const d = buf.getChannelData(c); for (let i=0;i<L;i++) x[i] += d[i]/buf.numberOfChannels; }
  const ons = [];
  makeDetector(sr, idx => ons.push(idx))(x);
  const onT = ons.map(i => i/sr);
  const spb = 60 / (S.bpm * S.speed / 100);
  const base = song.bars[S.loopA].start, loopDur = (barEnd(song.bars[S.loopB]) - base) * spb;
  const one = [];
  for (let b=S.loopA; b<=S.loopB; b++){
    const bar = song.bars[b], P = activeRH(bar); if (!P) continue;
    const r = rhRes(P, bar.beats), n = bar.beats*r;
    for (let st=0; st<n; st++){
      const ps = parts(P[st % P.length]); if (!ps.length) continue;
      const beat = bar.start + st/r, chord = chordAt(beat);
      one.push({t:(beat-base)*spb, s:st, bar:b, chord, ...noteInfo(ps, chord, beat)});
    }
  }
  if (!one.length || onT.length < 4){ showPanel('<h3>没听到足够的弹奏</h3><p>录音太短或太小声。离手机近一点，跟着节拍器从所选段落开头弹。</p>'); return; }
  const dur = L/sr, reps = S.repeat ? Math.ceil(dur/loopDur) + 1 : 1;
  const ev = []; for (let it=0; it<reps; it++) for (const e of one) ev.push({...e, t:e.t + it*loopDur, it});
  const times = ev.map(e => e.t);
  const near = (arr, v) => { let lo = 0, hi = arr.length-1; while (lo < hi){ const m = (lo+hi) >> 1; if (arr[m] < v) lo = m+1; else hi = m; } let b = lo; if (lo > 0 && Math.abs(arr[lo-1]-v) < Math.abs(arr[lo]-v)) b = lo-1; return b; };
  const score = o => { let sc = 0; for (const t of onT){ const d = t - o - times[near(times, t - o)]; sc += Math.exp(-(d*d)/(2*0.03*0.03)); } return sc; };
  let bestO = 0, bestS = -1;
  const maxO = Math.min(dur - 0.5, 20);
  for (let o=-0.3; o<=maxO; o+=0.01){ const v = score(o); if (v > bestS){ bestS = v; bestO = o; } }
  for (let o=bestO-0.012; o<=bestO+0.012; o+=0.001){ const v = score(o); if (v > bestS){ bestS = v; bestO = o; } }
  const used = new Set(), perBar = {}, res = {good:0, ok:0, miss:0, wrong:0, extra:0, offs:[]};
  const get = i => (i >= 0 && i < L) ? x[i] : 0;
  for (const e of ev){
    const et = e.t + bestO; if (et > dur - 0.15 || et < -0.05) continue;
    const pb = perBar[e.bar] = perBar[e.bar] || {n:0, bad:0, offs:[], msgs:{}};
    pb.n++;
    let bi = -1, bd = 9;
    for (let k = Math.max(0, near(onT, et) - 2); k < Math.min(onT.length, near(onT, et) + 3); k++){ if (used.has(k)) continue; const d = onT[k] - et; if (Math.abs(d) < Math.abs(bd)){ bd = d; bi = k; } }
    if (bi < 0 || Math.abs(bd) > WIN){ res.miss++; pb.bad++; continue; }
    used.add(bi);
    const ms = Math.round(bd*1000); res.offs.push(ms); pb.offs.push(ms);
    let cls = Math.abs(bd) <= GOOD ? 'good' : 'ok';
    if (e.notes.length){
      const v = verdict(chroma(get, ons[bi] + Math.round(sr*0.012), sr), chroma(get, ons[bi] - 4160, sr), e);
      if (!v.ok){ cls = 'wrong'; pb.msgs[v.msg] = (pb.msgs[v.msg]||0) + 1; }
    }
    res[cls]++; if (cls !== 'good') pb.bad += cls === 'ok' ? 0.5 : 1;
  }
  const lastT = Math.max(...ev.filter(e => e.t + bestO <= dur).map(e => e.t + bestO), 0);
  onT.forEach((t,k) => { if (!used.has(k) && t > bestO - 0.1 && t < lastT + 0.3) res.extra++; });
  const n = res.good + res.ok + res.miss + res.wrong;
  const avg = res.offs.length ? Math.round(res.offs.reduce((a,b) => a+b, 0)/res.offs.length) : 0;
  const pct = n ? Math.round((res.good + res.ok*0.5)/n*100) : 0;
  const tend = Math.abs(avg) < 12 ? '节奏很稳' : avg < 0 ? `整体偏早 ${-avg}ms` : `整体偏晚 ${avg}ms`;
  document.querySelectorAll('.sbar').forEach(el => el.classList.remove('r-good','r-ok','r-bad'));
  const worst = Object.entries(perBar).map(([b, v]) => ({b:+b, r:v.bad/v.n, v})).sort((a,b) => b.r - a.r);
  for (const w of worst){ const el = document.querySelector(`.sbar[data-bar="${w.b}"]`); if (el) el.classList.add(w.r < 0.1 ? 'r-good' : w.r < 0.3 ? 'r-ok' : 'r-bad'); }
  const bad = worst.filter(w => w.r >= 0.3).slice(0, 5);
  const startBar = S.loopA + 1;
  showPanel(`<h3>录音分析</h3>
    <div class="row"><span class="big">${pct}%</span><span>准 ${res.good} · 偏 ${res.ok} · 漏 ${res.miss} · 音不对 ${res.wrong} · 多余 ${res.extra} · ${tend}</span></div>
    <p>录音第 ${Math.max(0, bestO).toFixed(1)} 秒对上了第 ${startBar} 小节开头，按 ${Math.round(S.bpm*S.speed/100)} BPM 对齐。下面的谱面已经按每小节的情况标了颜色。</p>
    ${bad.length ? `<p>最需要练的小节（点一下只循环它）：</p><div class="row">${bad.map(w => {
      const m = Object.entries(w.v.msgs).sort((a,b) => b[1]-a[1])[0];
      return `<button class="ghost" data-loop="${w.b}">第 ${w.b+1} 小节${m ? ' · ' + esc(m[0]) : ''}</button>`; }).join('')}</div>` : '<p>每个小节都弹得不错。</p>'}`);
  $('panel').querySelectorAll('[data-loop]').forEach(btn => btn.onclick = () => { S.loopA = S.loopB = +btn.dataset.loop; S.pending = null; markLoop(); drawStatic(song.bars[S.loopA].start); });
}

/* ---------- rendering ---------- */
const view = {line:-1, bar:-1, now:undefined, next:undefined, cue:null, step:-1};
const focus = {bar:-2, serial:-2, r:2};
function barHTML(b){
  const B = b.beats, cols = B*4;
  const col = at => Math.max(1, Math.min(cols, Math.round((at-1)*4)+1));
  let h = `<div class="bar" data-bar="${b.index}" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">`;
  const ch = b.chords;
  if (!ch.length || ch[0].at > 1.01){
    const end = ch.length ? col(ch[0].at) : cols+1;
    h += `<span class="chd held" style="grid-column:1 / span ${Math.max(1,end-1)}">${esc(b.startChord || '')}</span>`;
  }
  ch.forEach((c,i) => {
    const s = col(c.at), e = i<ch.length-1 ? col(ch[i+1].at) : cols+1;
    h += `<span class="chd ${c.change?'':'same'}" style="grid-column:${s} / span ${Math.max(1,e-s)}">${esc(c.chord)}</span>`;
  });
  b.syl.forEach((x,i) => {
    if (x.rest) return;
    const s = col(x.at), sp = Math.max(1, Math.min(Math.round(x.dur*4), cols-s+1));
    h += `<span class="syl${x.tie?' tie':''}${x.empty?' slot':''}${sp<2?' tight':''}" data-i="${i}" style="grid-column:${s} / span ${sp}">${x.tie ? '～' : esc(x.text)}</span>`;
  });
  return h + `<div class="ticks">${'<span></span>'.repeat(B)}</div><div class="head" hidden></div></div>`;
}
function renderLines(li){
  const L = song.lines[li];
  const N = song.lines[li+1] || (S.repeat ? song.lines[song.bars[S.loopA].line] : null);
  $('lineNow').innerHTML = L.bars.map(barHTML).join('');
  $('lineNext').innerHTML = N && N !== L ? N.bars.map(barHTML).join('') : '';
  $('secName').textContent = L.section;
  view.line = li;
}
function nextChange(beat){
  const [a,b] = loopBeats();
  const n = song.changes.find(c => c.beat > beat + 1e-6 && c.beat < b);
  if (n) return {chord:n.chord, beats:n.beat - beat};
  if (S.repeat){
    const first = chordAt(a);
    if (first && first !== chordAt(b - 0.01)) return {chord:first, beats:b - beat};
    const n2 = song.changes.find(c => c.beat > a && c.beat < b);
    if (n2) return {chord:n2.chord, beats:(b-beat) + (n2.beat-a)};
  }
  return null;
}
function setRail(nowC, nx, warnOn){
  const keys = S.practice !== 'view';
  if (view.now !== nowC){ view.now = nowC; $('nameNow').textContent = nowC || '—'; $('diaNow').innerHTML = diagram(nowC, keys); $('subNow').textContent = keys || isDrill() ? rootText(nowC) : '保持住，跟着唱'; }
  const nc = nx ? nx.chord : null;
  if (view.next !== nc){ view.next = nc; $('nameNext').textContent = nc || '—'; $('diaNext').innerHTML = diagram(nc, keys); }
  if (nx){
    $('leftBeats').textContent = `还有 ${Math.ceil(nx.beats - 1e-6)} 拍`;
    $('subNext').textContent = warnOn ? '左手现在出发' : (keys ? rootText(nc) : '先别动');
    $('meter').style.width = Math.max(0, Math.min(100, (1 - nx.beats/Math.max(S.warn*2,4))*100)) + '%';
  } else { $('leftBeats').textContent = ''; $('subNext').textContent = '到结尾了'; $('meter').style.width = '0'; }
  if (view.cue !== warnOn){ view.cue = warnOn; $('cardNext').classList.toggle('cue', warnOn); }
}
function trackRow(label, items, cls){
  return `<div class="flab ${cls}-l">${label}</div><div class="track ${cls}"><div class="tin" style="--b:${focus.B||4}">${items}</div></div>`;
}
function laneLabel(key, ps){
  const has = p => ps.includes(p);
  if (ps.length && ps.every(p => FRET.test(p))) return key === 'S' ? '低音弦' : {J:'3弦',K:'2弦',L:'1弦'}[key];
  if (key==='F') return has('T') ? (has('D') ? '下扫/击弦' : '击弦') : '下扫';
  if (key==='S'){
    const down = has('D')||has('R')||has('X'), up = has('U'), thumb = has('B')||has('4')||has('5')||has('6');
    const strum = down || up ? (up ? '扫弦' : '下扫') : '';
    return strum && thumb ? `拇指/${strum}` : strum || '拇指';
  }
  if (key==='J') return has('U') && has('3') ? '3弦/上扫' : has('U') ? '上扫' : '3弦';
  return key==='K' ? '2弦' : '1弦';
}
function renderPads(keys, labels){
  $('pads').innerHTML = keys.map(k => `<button class="pad" data-k="${k}"><kbd>${KEY_CAP[k]}</kbd><span>${labels[k]}</span></button>`).join('');
}
function partNotes(p, chord){
  const m = FRET.exec(p); if (m) return [{si:6 - +m[1], fret:+m[2]}];
  if (p === 'T') return [];
  const ci = chordInfo(chord); if (!ci) return [];
  if (p==='D' || p==='R' || p==='X') return ci.f.map((f,i) => ({si:i, fret:f})).filter(x => x.fret >= 0);
  if (p==='U') return [5,4,3,2].filter(i => ci.f[i] >= 0).map(i => ({si:i, fret:ci.f[i]}));
  const si = p==='B' ? ci.root : STR[p]; if (si == null) return [];
  return [{si, fret:ci.f[si]}];
}
const judgedClass = (serial, bar, st, key) => judged[`${serial}|${bar}|${st}-${key}`] || judged[`${serial}|${bar}|${st}-M`] || '';
function renderFocus(bar, serial){
  focus.bar = bar ? bar.index : -1; focus.serial = serial;
  const B = bar ? bar.beats : song.beats, X = at => (at-1)/B; focus.B = B;
  $('beatDots').innerHTML = Array.from({length:B}, (_,i) => `<i class="${i===0?'one':''}"></i>`).join('');
  const P0 = activeRH(bar), r0 = P0 ? rhRes(P0,B) : 2, n0 = B*r0;
  const sub = r0===4 ? ['','e','&','a'] : r0===3 ? ['','&','a'] : r0===2 ? ['','&'] : [''];
  let beatsRow = '';
  for (let i=0;i<n0;i++) beatsRow += `<span class="fi fbeat${i%r0?' and':''}" data-c="${i}" style="--x:${i/n0}">${i%r0 ? sub[i%r0] : i/r0+1}</span>`;
  focus.r = r0;
  let ch = '', ly = '';
  if (bar){
    if (!bar.chords.length || bar.chords[0].at > 1.01) ch += `<span class="fi fch held" style="--x:0">${esc(bar.startChord||'')}</span>`;
    bar.chords.forEach(c => ch += `<span class="fi fch" style="--x:${X(c.at)}">${esc(c.chord)}</span>`);
    bar.syl.forEach((x,i) => { if (!x.rest) ly += `<span class="fi fl${x.empty?' slot':''}" data-i="${i}" style="--x:${X(x.at)}">${x.tie ? '～' : esc(x.text)}</span>`; });
  }
  let rows = trackRow('拍', beatsRow, 'bt-t') + trackRow('和弦', ch, 'ch-t') + (ly ? trackRow('歌词', ly, 'ly-t') : '');
  const P = activeRH(bar);
  const tsg = touchUI ? 30 : 20, tr0 = touchUI ? 36 : 12;
  const ROW = i => tr0 + i*tsg;          // TAB row (0 = string 1, top) -> px
  const mic = S.input === 'mic' || touchUI;   // no keyboard letters when listening or on touch screens
  const capS = {S:'␣', F:'F', J:'J', K:'K', L:'L'};
  let labels = '';
  for (let i=0;i<6;i++){
    const key = PART_KEY[String(i+1)];
    labels += `<span style="top:${ROW(i)}px">${i+1}弦${mic ? '' : ` <kbd>${KEY_CAP[key]==='空格' ? '空格' : KEY_CAP[key]}</kbd>`}</span>`;
  }
  let tab = '';
  for (let i=0;i<6;i++) tab += `<i class="tl" style="top:${ROW(i)}px"></i>`;
  const used = new Set(), keyParts = {};
  if (P && bar){
    const r = rhRes(P,B), n = B*r; focus.r = r;
    const strummy = P.some(t => parts(t).some(p => STRUM_PART[p] && p !== 'T'));
    for (let st=0; st<n; st++){
      const ps = parts(P[st % P.length]), x = st/n;
      if (!ps.length){
        if (strummy && (r === 2 || r === 4)) tab += `<span class="fi tg" style="--x:${x}"></span>`;
        continue;
      }
      const chord = chordAt(bar.start + st/r);
      for (const p of ps){
        const key = keyOf(p), j = judgedClass(serial, focus.bar, st, key);
        used.add(key); (keyParts[key] = keyParts[key] || []).push(p);
        const da = `data-s="${st}" data-k="${key}"`;
        if (p === 'T'){ tab += `<span class="fi tt ${j}" ${da} style="--x:${x}">✱${mic ? '' : `<b>${capS[key]}</b>`}</span>`; continue; }
        if (STRUM_PART[p]){
          const word = {D:'下', U:'上', R:'琶', X:'切'}[p];
          tab += `<span class="fi ts ${p} ${j}" ${da} style="--x:${x}"><b>${word}${mic ? '' : capS[key]}</b></span>`;
          continue;
        }
        for (const nt of partNotes(p, chord))
          tab += `<span class="fi tn ${j}" ${da} style="--x:${x};top:${ROW(5-nt.si)}px">${nt.fret < 0 ? 'x' : nt.fret}</span>`;
      }
    }
  }
  rows += `<div class="flab tabl">${labels}</div><div class="track tab-t"><div class="tin" style="--b:${B}">${tab}</div></div>`;
  const keys = ['S','F','J','K','L'].filter(k => used.has(k));
  const lab = {}; keys.forEach(k => lab[k] = laneLabel(k, keyParts[k]));
  renderPads(keys, lab);
  $('ftracks').innerHTML = rows + `<div class="fover"><div class="ph" id="ph"></div></div>`;
  view.step = -1;
}
function drawStatic(beat){
  const barI = barAt(beat);
  renderLines(song.bars[barI].line);
  markBar(barI, -1);
  renderFocus(song.bars[barI], -1);
  $('ph').style.display = 'none';
  setRail(chordAt(beat) || (song.changes[0]||{}).chord, nextChange(beat), false);
  $('posText').textContent = `第 ${barI+1} 小节`;
  $('secName').textContent = song.bars[barI].section;
  [...$('beatDots').children].forEach(d => d.classList.remove('on'));
  updateStats();
}
function markBar(barI, frac){
  $('lineNow').querySelectorAll('.bar').forEach(el => {
    const i = +el.dataset.bar;
    el.classList.toggle('now', i===barI && playing); el.classList.toggle('past', i<barI);
    const head = el.querySelector('.head');
    if (i===barI && playing && frac >= 0){ head.hidden = false; head.style.left = `calc(8px + (100% - 14px) * ${frac})`; }
    else head.hidden = true;
  });
  if (view.bar !== barI){
    document.querySelectorAll('.sbar.now').forEach(e => e.classList.remove('now'));
    if (playing) document.querySelector(`.sbar[data-bar="${barI}"]`)?.classList.add('now');
    view.bar = barI;
  }
}
function karaoke(container, sel, bar, pos){
  container.querySelectorAll(sel).forEach(g => {
    const x = bar.syl[+g.dataset.i]; if (!x) return;
    g.classList.toggle('sung', pos >= x.at + x.dur - 1e-6);
    g.classList.toggle('on', pos >= x.at && pos < x.at + x.dur);
  });
}
function frame(){
  if (!playing) return;
  const now = audible(performance.now());
  let cur = null;
  for (let i=beatQ.length-1;i>=0;i--) if (beatQ[i].time <= now){ cur = beatQ[i]; break; }
  if (cur){
    const frac = Math.min(1, (now-cur.time)/cur.spb), inf = cur.inf, sb = inf.sb, beatF = sb + frac;
    const cb = song.bars[inf.count ? S.loopA : barAt(sb)], B = cb.beats;
    const bi = inf.count ? ((sb - cb.start) % B + B) % B : sb - cb.start;
    [...$('beatDots').children].forEach((d,i) => d.classList.toggle('on', i===bi));
    if (inf.count){
      $('countin').hidden = false; $('countin').textContent = `预备 ${B - bi}`;
      const bar = song.bars[S.loopA];
      if (view.line !== bar.line) renderLines(bar.line);
      markBar(-1, -1);
      if (focus.bar !== S.loopA || focus.serial !== 0) renderFocus(bar, 0);
      $('ph').style.display = 'none';
      const a = cb.start, first = chordAt(a);
      setRail(view.now === undefined ? first : view.now, {chord:first, beats:a - beatF}, a - beatF <= S.warn + 1e-6);
      $('posText').textContent = '预备拍';
    } else {
      $('countin').hidden = true;
      const barI = cb.index, bar = cb;
      if (bar.line !== view.line) renderLines(bar.line);
      const pos = beatF - bar.start;
      markBar(barI, pos/B);
      if (focus.bar !== barI || focus.serial !== inf.serial) renderFocus(bar, inf.serial);
      const ph = $('ph'); ph.style.display = ''; ph.style.setProperty('--p', pos/B);
      const el = $('lineNow').querySelector(`.bar[data-bar="${barI}"]`);
      if (el) karaoke(el, '.syl', bar, pos+1);
      karaoke($('ftracks'), '.fl', bar, pos+1);
      const st = Math.floor(pos * focus.r + 1e-6);
      if (st !== view.step){
        view.step = st;
        $('ftracks').querySelectorAll('.fbeat').forEach(d => d.classList.toggle('on', +d.dataset.c === st));
        if (!judgingOn()) $('ftracks').querySelectorAll('[data-s]').forEach(d => d.classList.toggle('on', +d.dataset.s === st));
      }
      const nx = nextChange(beatF);
      setRail(chordAt(beatF), nx, !!nx && nx.beats <= S.warn + 1e-6);
      $('secName').textContent = bar.section;
      $('posText').textContent = `第 ${barI+1} 小节 · 第 ${bi+1} 拍` + (S.trainer || S.speed !== 100 ? ` · ${Math.round(tempo(inf.iter))} BPM` : '');
    }
  }
  if (judgingOn()) sweep(now);
  if (isDrill()) evaluateBars(now);
  requestAnimationFrame(frame);
}
function renderSheet(){
  const song = baseSong;
  const groups = [];
  for (const L of song.lines){ if (L.sectionStart || !groups.length) groups.push({section:L.section, bars:[]}); groups[groups.length-1].bars.push(...L.bars); }
  $('rows').innerHTML = groups.map(L => `<div class="srow"><div class="slab">${esc(L.section)}</div><div class="sbars">${
    L.bars.map(b => {
      const ch = b.chords.filter(c => c.change).map(c => c.chord).join(' · ') || (b.startChord ? `(${b.startChord})` : '—');
      const tx = b.syl.filter(x => !x.rest && !x.tie).map(x => x.text).join('');
      return `<button class="sbar" data-bar="${b.index}"><span class="n">${b.index+1}</span><span class="c">${esc(ch)}</span><span class="t">${esc(tx)||'&nbsp;'}</span></button>`;
    }).join('')}</div></div>`).join('');
  markLoop();
}
function markLoop(){
  const song = baseSong;
  const whole = S.loopA===0 && S.loopB===song.bars.length-1;
  document.querySelectorAll('.sbar').forEach(el => {
    const i = +el.dataset.bar;
    el.classList.toggle('inloop', !whole && i>=S.loopA && i<=S.loopB);
    el.classList.toggle('pending', i===S.pending);
  });
  $('loopText').textContent = S.pending != null ? `起点：第 ${S.pending+1} 小节，再点一个小节作为终点`
    : whole ? '点一个小节设起点，再点一个设终点，只练那一段' : `只练第 ${S.loopA+1}–${S.loopB+1} 小节`;
}

/* ---------- controls ---------- */
function syncControls(){
  $('bpmVal').textContent = S.bpm;
  $('speed').value = S.speed; $('speedVal').textContent = S.speed + '%';
  $('calib').value = S.calib; $('calibVal').textContent = S.calib + 'ms';
  $('trainer').checked = S.trainer; $('cueSound').checked = S.cue; $('countIn').checked = S.countIn;
  $('eighths').checked = S.eighths; $('repeat').checked = S.repeat;
  $('demoBtn').setAttribute('aria-pressed', S.demo); $('demoState').textContent = S.demo ? '开' : '关';
  [...$('warnBtns').children].forEach(b => b.setAttribute('aria-pressed', +b.dataset.v===S.warn));
  [...$('modeBtns').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v===S.mode));
  [...$('practiceBtns').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v===S.practice));
  [...$('strumBtns').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v===strumKeys));
  document.body.classList.toggle('keys', S.practice!=='view');
  document.body.classList.toggle('drill', S.practice==='drill');
  document.body.classList.toggle('mic', S.input==='mic');
  [...$('inputBtns').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v===S.input));
  $('sens').value = S.sens; $('sensVal').textContent = S.sens;
  $('micCalVal').textContent = `延迟 ${S.calibMic}ms`;
  $('board').classList.toggle('hide-chords', S.mode==='lyrics');
  $('board').classList.toggle('hide-lyrics', S.mode==='chords');
}
const redraw = () => { if (playing){ focus.bar = -2; } else drawStatic(song.bars[S.loopA].start); };
function restart(){ if (playing){ stop(); start(); } }
$('playBtn').onclick = e => { e.currentTarget.blur(); playing ? stop() : start(); };
const KEYMAP = {Space:'S', KeyF:'F', KeyJ:'J', KeyK:'K', KeyL:'L'};
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === 'Escape'){ stop(); return; }
  if (e.code === 'Enter'){ e.preventDefault(); playing ? stop() : start(); return; }
  if (S.practice !== 'view' && S.input !== 'mic' && KEYMAP[e.code]){
    e.preventDefault(); if (e.repeat) return;
    if (!playing && e.code === 'Space'){ start(); return; }
    onKey(KEYMAP[e.code], e.timeStamp); return;
  }
  if (e.code === 'Space'){ e.preventDefault(); playing ? stop() : start(); }
});
/* touch: the TAB is the instrument — tap a string to pluck it, swipe down / up to strum */
const touchUI = matchMedia('(pointer:coarse)').matches;
document.body.classList.toggle('touch', touchUI);
(function setupTabTouch(){
  const g = {};
  const box = () => $('ftracks').querySelector('.tab-t .tin');
  const flash = row => { const l = $('ftracks').querySelectorAll('.tab-t .tl')[row]; if (!l) return; l.classList.add('hit'); setTimeout(() => l.classList.remove('hit'), 120); };
  $('ftracks').addEventListener('pointerdown', e => {
    if (S.practice === 'view' || S.input === 'mic') return;
    const tin = e.target.closest('.tab-t') && box(); if (!tin) return;
    e.preventDefault();
    const r = tin.getBoundingClientRect(), sg = touchUI ? 30 : 20, r0 = touchUI ? 36 : 12;
    g[e.pointerId] = {y0:e.clientY, ts:e.timeStamp, rel:e.clientY - r.top, done:false, sg, r0};
  });
  const finish = (e, moved) => {
    const p = g[e.pointerId]; if (!p || p.done) return; p.done = true;
    if (moved){
      const dir = e.clientY > p.y0 ? 'D' : 'U';
      onKey(keyOf(dir), p.ts, dir);
      return;
    }
    if (p.rel < p.r0 - p.sg*0.45){ onKey(keyOf('T'), p.ts, 'T'); return; }      // above string 1: slap
    const row = Math.max(0, Math.min(5, Math.round((p.rel - p.r0) / p.sg)));
    flash(row);
    onKey(PART_KEY[String(row + 1)], p.ts, String(row + 1));
  };
  $('ftracks').addEventListener('pointermove', e => { const p = g[e.pointerId]; if (p && !p.done && Math.abs(e.clientY - p.y0) > 14) finish(e, true); });
  $('ftracks').addEventListener('pointerup', e => { finish(e, false); delete g[e.pointerId]; });
  $('ftracks').addEventListener('pointercancel', e => { delete g[e.pointerId]; });
})();
$('pads').addEventListener('pointerdown', e => {
  const p = e.target.closest('.pad'); if (!p) return;
  e.preventDefault(); onKey(p.dataset.k, e.timeStamp);
});
$('pads').addEventListener('click', e => e.preventDefault());
function setBpm(v){ S.bpm = Math.max(30, Math.min(240, v)); store.set((isDrill() ? 'drillbpm:' : 'bpm:')+curId, S.bpm); $('bpmVal').textContent = S.bpm; renderDrillInfo(); }
$('bpmDown').onclick = () => setBpm(S.bpm-4);
$('bpmUp').onclick = () => setBpm(S.bpm+4);
$('speed').oninput = e => { S.speed = +e.target.value; $('speedVal').textContent = S.speed+'%'; store.set('speed',S.speed); };
$('calib').oninput = e => { S.calib = +e.target.value; $('calibVal').textContent = S.calib+'ms'; store.set('calib',S.calib); };
for (const [id,key] of [['trainer','trainer'],['cueSound','cue'],['countIn','countIn'],['eighths','eighths'],['repeat','repeat']])
  $(id).onchange = e => { S[key] = e.target.checked; store.set(key, S[key]); };
$('demoBtn').onclick = e => { e.currentTarget.blur(); S.demo = !S.demo; store.set('demo', S.demo); syncControls(); };
$('warnBtns').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.warn = +b.dataset.v; store.set('warn',S.warn); syncControls(); };
$('modeBtns').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.mode = b.dataset.v; store.set('mode',S.mode); syncControls(); };
$('practiceBtns').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; b.blur();
  const was = playing; stop();
  S.practice = b.dataset.v; store.set('practice', S.practice); syncControls();
  applyMode();
  if (was) start();
};
$('drillChord').onchange = e => { drill.chord = e.target.value; store.set('drillchord:'+curId, drill.chord); reDrill(); };
$('stageBtns').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; b.blur();
  drill.stage = b.dataset.v; store.set('stage', drill.stage); drill.streak = 0;
  [...$('stageBtns').children].forEach(x => x.setAttribute('aria-pressed', x === b));
  expected.forEach(x => x.judged = true); renderDrillInfo(); updateStats();
};
$('strumBtns').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; b.blur();
  strumKeys = b.dataset.v; store.set('strumKeys', strumKeys); syncControls();
  const was = playing; stop(); view.line = -1; drawStatic(song.bars[S.loopA].start); if (was) start();
};
$('inputBtns').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; b.blur();
  const was = playing; stop();
  S.input = b.dataset.v; store.set('input', S.input); syncControls();
  view.line = -1; drawStatic(song.bars[S.loopA].start);
  if (S.input === 'mic') micStart();
  if (was) start();
};
$('sens').oninput = e => { S.sens = +e.target.value; $('sensVal').textContent = S.sens; store.set('sens', S.sens); };
$('micCal').onclick = () => micCalibrate();
$('recFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) analyzeRecording(f); };
$('autoSpeed').onchange = e => { drill.auto = e.target.checked; store.set('autoSpeed', drill.auto); };
function setOverride(v){ store.set('rh:'+curId, v); S.override = parseRH(v); redraw(); }
$('rhOverride').oninput = e => setOverride(e.target.value);
$('rhPreset').onchange = e => {
  const v = e.target.value; if (!v) return;
  const val = v === '__chart' ? '' : v;
  $('rhOverride').value = val; setOverride(val); e.target.value = '';
};
$('rows').onclick = e => {
  const b = e.target.closest('.sbar'); if (!b) return;
  const i = +b.dataset.bar;
  if (S.pending == null){ S.pending = i; S.loopA = S.loopB = i; }
  else { S.loopA = Math.min(S.pending,i); S.loopB = Math.max(S.pending,i); S.pending = null; }
  markLoop();
  if (playing) restart(); else drawStatic(song.bars[S.loopA].start);
};
$('loopAll').onclick = () => { if (isDrill()) return; S.loopA = 0; S.loopB = song.bars.length-1; S.pending = null; markLoop(); if (playing) restart(); else drawStatic(0); };
$('songSel').onchange = e => { try { loadSong(e.target.value); } catch(err){ $('err').textContent = err.message; } };
function applyEditor(id){
  const t = $('src').value, l = $('lyr').value;
  const was = playing; stop();
  try {
    if (id !== curId){ curId = id; store.set('cur', id); }
    build(t, l);
    if (!(isBuiltin(id) && t === (LIBRARY.find(x => x.id===id)||{}).src)) store.set('src:'+id, t); else store.del('src:'+id);
    store.set('lyr:'+id, l);
    $('err').textContent = '已保存';
    renderSongSel();
    if (was) start();
  } catch(err){ $('err').textContent = err.message; }
}
$('apply').onclick = () => applyEditor(curId);
$('saveAs').onclick = () => {
  const id = 'u' + Date.now().toString(36);
  store.set('customs', [...customs(), id]);
  applyEditor(id);
};
$('revert').onclick = () => { store.del('src:'+curId); loadSong(curId); $('err').textContent = '已恢复原谱'; };
let delArmed = false;
$('del').onclick = () => {
  if (!delArmed){ delArmed = true; $('del').textContent = '再点一次确认删除'; setTimeout(() => { delArmed = false; $('del').textContent = '删除这首'; }, 3000); return; }
  delArmed = false; $('del').textContent = '删除这首';
  store.set('customs', customs().filter(x => x !== curId)); store.del('src:'+curId); store.del('lyr:'+curId);
  loadSong(LIBRARY[0].id);
};
let lyrTimer;
$('lyr').oninput = () => {
  clearTimeout(lyrTimer);
  lyrTimer = setTimeout(() => {
    store.set('lyr:'+curId, $('lyr').value);
    fillLyrics(baseSong, $('lyr').value); renderReport(); renderSheet();
    if (!isDrill()){ view.line = -1; if (!playing) drawStatic(song.bars[S.loopA].start); else focus.bar = -2; }
  }, 300);
};

const bundledLyrics = () => ({...(window.STRUM_PRIVATE_LYRICS || {}), ...(window.STRUM_LYRICS || {})});
const standalone = (() => { try { return window.self === window.top; } catch(e){ return false; } })();
(function setupChrome(){
  const g = $('guide'), hb = $('helpBtn');
  const showGuide = v => { g.hidden = !v; hb.setAttribute('aria-expanded', v); };
  showGuide(!store.get('guideSeen', false));
  hb.onclick = () => showGuide(g.hidden);
  $('guideClose').onclick = () => { store.set('guideSeen', true); showGuide(false); };
  if (standalone){
    const tb = $('themeBtn'), modes = ['auto','light','dark'], names = {auto:'自动', light:'浅色', dark:'深色'};
    let m = store.get('theme', 'auto');
    const apply = () => { if (m === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', m); tb.textContent = '主题：' + names[m]; };
    tb.hidden = false; apply();
    tb.onclick = () => { m = modes[(modes.indexOf(m)+1) % 3]; store.set('theme', m); apply(); };
    $('dlChart').hidden = false;
  }
  $('chartFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const t = await f.text();
    $('src').value = t; $('lyr').value = '';
    const id = 'u' + Date.now().toString(36);
    store.set('customs', [...customs(), id]);
    applyEditor(id); $('editor').open = true;
  };
  $('exportLyr').onclick = async () => {
    const all = {...bundledLyrics()};
    for (const id of [...LIBRARY.map(x => x.id), ...customs()]){ const v = store.get('lyr:'+id, null); if (v != null && v.trim()) all[id] = v; }
    if (curId && $('lyr').value.trim()) all[curId] = $('lyr').value;
    const ids = Object.keys(all);
    if (!ids.length){ $('err').textContent = '还没有保存过歌词'; return; }
    const text = '/* 歌词文件：可以存成 src/lyrics.js（公开，需要有歌词授权）或 src/lyrics.private.js（只在本地）。\n   键是歌曲 id，值是按演唱顺序的歌词。 */\nwindow.STRUM_LYRICS = Object.assign(window.STRUM_LYRICS || {}, {\n' +
      ids.map(id => `  ${JSON.stringify(id)}: ${JSON.stringify(all[id])},`).join('\n') + '\n});\n';
    if (standalone){
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], {type:'text/javascript'}));
      a.download = 'lyrics.private.js'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      $('err').textContent = `已导出 ${ids.length} 首，存成 src/lyrics.js 或 src/lyrics.private.js`;
    } else {
      try { await navigator.clipboard.writeText(text); $('err').textContent = `已复制 ${ids.length} 首的歌词文件内容，粘贴进 src/lyrics.js 或 src/lyrics.private.js`; }
      catch(e){ $('err').textContent = '复制失败，请在单独打开的页面里导出'; }
    }
  };
  $('copyChart').onclick = async () => {
    try { await navigator.clipboard.writeText($('src').value); $('err').textContent = '谱面已复制'; }
    catch(e){ $('src').focus(); $('src').select(); $('err').textContent = '已选中谱面，按 Ctrl+C 复制'; }
  };
  $('dlChart').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('src').value], {type:'text/plain'}));
    a.download = (titleOf($('src').value) || 'chart') + '.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
})();
let startId = store.get('cur', LIBRARY[0].id);
if (store.get('newest', '') !== NEWEST){ store.set('newest', NEWEST); startId = NEWEST; }
if (!isBuiltin(startId) && !customs().includes(startId)) startId = LIBRARY[0].id;
try { loadSong(startId); } catch(e){ loadSong(LIBRARY[0].id); }
