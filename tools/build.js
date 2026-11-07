/* 构建部署目录 dist/：把单文件应用与 PWA/后端资源镜像进 dist（Cloudflare Pages 部署工件）
   用法：node tools/build.js
   （index.html 本身就是构建完成的单文件应用；本脚本只负责按 Pages 的输出目录约定收集工件） */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of ['index.html', 'manifest.json', 'sw.js']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
}
fs.cpSync(path.join(ROOT, 'functions'), path.join(OUT, 'functions'), { recursive: true });
fs.cpSync(path.join(ROOT, 'icons'), path.join(OUT, 'icons'), { recursive: true });

console.log('已生成 dist/：index.html + functions/ + manifest.json + sw.js + icons/');
