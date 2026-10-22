/* 本地歌词缓存模板。复制成 src/lyrics.private.js（已在 .gitignore 里，不会被提交），
   或者在页面「歌词 / 编辑谱面」里点「导出歌词文件」直接生成。
   这里的歌词会覆盖 src/lyrics.js 里同一首歌的歌词；浏览器里贴过的歌词又优先于两者。 */
window.STRUM_LYRICS = Object.assign(window.STRUM_LYRICS || {}, {
  // "cheng": `……`,
});
