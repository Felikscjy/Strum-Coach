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

## Demo charts (`src/songs.js`)

The rhythm, chord and arrangement data for 程艾影 and 爱错 were transcribed from guitar scores by
大老师 (da-tab) and 小LV吉他 / 革命吉他 respectively, and are included as demos with the permission of
the score authors. They are not covered by the MIT license of this project. No lyrics are included.

## Demo lyrics (`src/lyrics.js`)

歌词不属于本项目的 MIT 许可，版权归各自的作词人和版权方。收录的演示歌词均已获授权：

- 《程艾影》歌词：经 【授权方名称】 授权，仅作为本工具的演示使用（【授权日期】）
- 《爱错》歌词：经 【授权方名称】 授权，仅作为本工具的演示使用（【授权日期】）

如有疑问请通过 GitHub Issues 联系，相关内容会立即处理。

## Fonts

The page loads Barlow Condensed, Noto Sans SC and Noto Serif SC from Google Fonts at runtime
(SIL Open Font License 1.1). The fonts are not bundled in this repository.
