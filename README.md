# 弹唱换弦教练

一个给吉他弹唱练习用的网页小工具。弹唱最难的往往不是和弦本身，而是**左手什么时候换和弦、右手节奏怎么跟上、歌词落在哪个点上**。这个工具把三件事放在同一条时间线上：

- **跟唱**：节拍器带着歌词一小节一小节往前走，每个字按它在谱上真实的节奏位置显示（附点、弱起、切分、连音都对得上）。换和弦前 1～2 拍提前提醒，同时显示当前和下一个和弦的指法图。
- **右手按键**：本小节画成六线谱，跟着节拍用键盘弹右手（空格拇指，J/K/L 对应 3/2/1 弦，F/J 下扫/上扫），逐个音判定早晚。
- **听吉他判定**：用麦克风听你真的弹出来的声音，判定节奏准不准、音弹得对不对，换和弦慢了会提示“还没换到 Am7”。也可以上传一段录音事后分析，标出最需要练的小节。
- **节奏练习**：把一个右手节奏型单独拿出来，按“先听 → 跟着弹 → 自己弹”三步练，连续弹干净 4 小节自动提速。
- 循环任意一段、降速、每循环自动加速、伴奏示范（真实钢弦吉他采样）、变调夹、中途变拍号。

不需要安装，不需要后端，所有数据存在你自己的浏览器里。

**在线使用：<https://felikscjy.github.io/Strum-Coach/>**

## 快速开始

```bash
git clone https://github.com/Felikscjy/Strum-Coach.git
cd strum-coach
open index.html          # 或者直接双击，用 Chrome / Edge 打开
```

要用麦克风判定，浏览器需要“安全来源”：`file://` 打开或者部署到 HTTPS（例如 GitHub Pages）都可以。练习时请戴耳机，否则麦克风会把节拍器也当成你弹的声音。第一次用先点「测延迟」。

## 打包成单个文件

```bash
node scripts/build.mjs             # -> dist/strum-coach.html，只含公开的示例曲
node scripts/build.mjs --private   # 同时打包 src/songs.private.js 里你自己的谱
```

生成的 HTML 是完全自包含的（除了 Google Fonts 字体，离线时会退回系统字体），可以直接发给别人或放到任何静态托管上。

## 加自己的歌

谱面是纯文本，格式见 [docs/chart-format.md](docs/chart-format.md)。三种方式：

1. 在页面底部「歌词 / 编辑谱面」里直接写，点「另存为新歌」；或者「导入谱面文件」读一个 `.txt`。
2. 写进 `src/songs.private.js`（已在 `.gitignore` 里，不会被提交），刷新页面即可。
3. 把谱子图片或 PDF 交给 Claude 之类的助手，按 [docs/score-to-chart.md](docs/score-to-chart.md) 里的固定流程转换。

检查谱面有没有写错（小节拍数不对、缺和弦指法）：

```bash
node scripts/check-charts.mjs              # 检查内置的歌
node scripts/check-charts.mjs 我的歌.txt   # 检查谱面文件
```

**关于版权**：谱面只记节奏、和弦和段落结构，歌词位置用 `*` 占位。歌词由使用者自己粘贴，只保存在本地浏览器；想让本地版打开就带歌词，在编辑区点「导出歌词文件」，存成 `src/lyrics.private.js`（已在 `.gitignore` 里）。内置的《程艾影》《爱错》转写自各自署名的吉他谱（大老师 / da-tab；小LV吉他 / 革命吉他），已获谱面作者授权作为演示收录，页面上会显示来源。提交新谱时请确认你有权分享它；从版权谱上扒的谱自己用的话，放在 `songs.private.js` 里即可。欢迎提交原创练习曲和公有领域的歌。

## 目录结构

```
index.html            页面结构，开发时直接打开
src/style.css         样式（浅色/深色两套色板）
src/chart.js          谱面解析、和弦指法表、右手记号
src/app.js            播放、调度、渲染、键盘/麦克风判定、录音分析
src/samples.js        12 个吉他采样（base64），见 NOTICE.md
src/songs.js          内置的演示曲
src/songs.private.js  你自己的谱（不提交）
src/lyrics.private.js 你自己的歌词缓存（不提交，模板见 lyrics.private.example.js）
scripts/build.mjs     打包成单文件
scripts/check-charts.mjs  校验谱面
scripts/make-samples.py   重新生成采样
docs/                 谱面格式、读谱转换流程
```

## 实现要点

- 节拍器和伴奏用 Web Audio 提前约 150ms 调度，画面按音频时钟同步，不依赖 `setInterval` 的精度。
- 伴奏是真实钢弦吉他采样，按弦分声部：同一根弦再弹会止住前一个音，扫弦按弦序错开十几毫秒，上扫只扫高音弦。
- 麦克风判定：高频差分能量检测起音（自适应噪声底），起音后 4096 点 FFT 求音级色度，与期望的单音或和弦模板比余弦相似度；换和弦后一拍内额外和上一个和弦比较，判断是不是还没换过去。
- 录音分析：同样的起音检测，然后在 0～20 秒范围内搜索最佳对齐偏移（先 10ms 粗搜再 1ms 细搜），再逐个音判定。

## 许可

代码以 MIT 许可发布，见 [LICENSE](LICENSE)。吉他采样来自 tonejs-instruments，采用 CC BY 3.0，见 [NOTICE.md](NOTICE.md)。

---

**English summary.** A browser-based practice tool for singing while playing guitar. Lyrics scroll on the real rhythm grid, chord changes are cued one or two beats ahead, the current bar is drawn as six-string tablature, and your right hand can be judged from the keyboard or from your actual guitar through the microphone (timing, pitch, and "you haven't changed to the next chord yet"). No build step and no server: open `index.html`. Charts are plain text (see `docs/chart-format.md`) and carry rhythm and chords only; lyrics are pasted by the user and stay in their browser.
