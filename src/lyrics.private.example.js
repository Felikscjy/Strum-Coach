/* 本地歌词缓存模板。
   复制成 src/lyrics.private.js（已在 .gitignore 里，不会被提交），或者在页面的
   「歌词 / 编辑谱面」里点「导出歌词文件」直接生成。

   键是歌曲 id（见 src/songs.js），值是按演唱顺序的歌词，标点和换行会被忽略，
   也可以用「## 段落名」分块。浏览器里已经保存过的歌词优先于这个文件。 */
window.STRUM_PRIVATE_LYRICS = {
  // "cheng": `……`,
};
