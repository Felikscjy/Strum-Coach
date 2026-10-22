# Third-party material

## Acoustic guitar samples (`src/samples.js`)

The 12 acoustic guitar notes embedded in `src/samples.js` come from
**tonejs-instruments** by Nicholaus P. Brosowsky
(<https://github.com/nbrosowsky/tonejs-instruments>), distributed on npm as
`tonejs-instrument-guitar-acoustic-mp3` (fork: <https://github.com/Makefully-Studios/tonejs-instruments>).

The samples are licensed under the
[Creative Commons Attribution 3.0 Unported License (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/).
According to the upstream project, they were collected from public-domain sources and edited for consistency.

Changes made for this project: 12 of the notes (E2, G2, A#2, C#3, E3, G3, A#3, C#4, E4, G4, A#4, C#5) were
selected, trimmed to 2.6 seconds with a 0.8-second fade-out, mixed to mono, re-encoded as 72 kbps MP3,
and embedded as base64 together with a measured attack offset. See `scripts/make-samples.py`.

## Fonts

The page loads Barlow Condensed, Noto Sans SC and Noto Serif SC from Google Fonts at runtime
(SIL Open Font License 1.1). The fonts are not bundled in this repository.
