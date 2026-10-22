#!/usr/bin/env python3
"""Rebuild src/samples.js from the tonejs-instruments acoustic guitar samples.

    npm pack tonejs-instrument-guitar-acoustic-mp3@1.1.2 && tar xzf *.tgz
    python3 scripts/make-samples.py package/

Needs ffmpeg. Each note is trimmed to 2.6 s with a 0.8 s fade-out, mixed to mono,
re-encoded at 72 kbps, and stored with the measured attack offset so playback
can skip the silence before the pluck and stay on the beat.
"""
import base64, os, struct, subprocess, sys, tempfile

NOTES = {40: 'E2', 43: 'G2', 46: 'As2', 49: 'Cs3', 52: 'E3', 55: 'G3',
         58: 'As3', 61: 'Cs4', 64: 'E4', 67: 'G4', 70: 'As4', 73: 'Cs5'}

def main(src_dir):
    out = os.path.join(os.path.dirname(__file__), '..', 'src', 'samples.js')
    parts = []
    with tempfile.TemporaryDirectory() as tmp:
        for midi, name in NOTES.items():
            mp3 = os.path.join(tmp, name + '.mp3')
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(src_dir, name + '.mp3'),
                            '-t', '2.6', '-af', 'afade=t=out:st=1.8:d=0.8', '-ac', '1', '-ar', '44100', '-b:a', '72k', mp3], check=True)
            raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp3, '-f', 's16le', '-ac', '1', '-ar', '44100', '-'],
                                 capture_output=True, check=True).stdout
            pcm = struct.unpack('<%dh' % (len(raw) // 2), raw)
            peak = max(abs(v) for v in pcm)
            onset = next(i for i, v in enumerate(pcm) if abs(v) > peak * 0.06)
            offset = max(0.0, onset / 44100 - 0.004)
            b64 = base64.b64encode(open(mp3, 'rb').read()).decode()
            parts.append(f'{midi}:[{offset:.4f},"{b64}"]')
            print(f'{name}: attack at {offset * 1000:.1f} ms')
    with open(out, 'w') as f:
        f.write('/* Acoustic guitar samples (12 notes, E2-C#5), base64 MP3.\n'
                '   Source: tonejs-instruments by Nicholaus Brosowsky, CC BY 3.0 — see NOTICE.md.\n'
                '   Format: midi: [attack offset in seconds, base64 mp3]. Regenerate with scripts/make-samples.py */\n')
        f.write('window.STRUM_SAMPLES = {' + ',\n'.join(parts) + '};\n')
    print('wrote', os.path.normpath(out))

if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
