/* i18n 覆盖审计（离线模拟 t()）
   用法：node tools/i18n-audit.js —— 列出 index.html 运行时中文字符串里
        未被 TR/FRAG/RULES 覆盖的幸存者（应只余用户数据类字符串）。
   本文件刻意不含反斜杠正则与动态求值（new Function/eval）：所有模式用
        fromCharCode/indexOf 构造。RULES 在此维护原生副本（与 index.html 同步，
        数量守卫在下方，漂移会告警）。
   已知盲区：innerHTML 相邻文本无标签分隔时会合并成单一文本节点（如
        「本次完成（个）」），字面量级审计测不到——这类复合串靠 RULES 的
        函数规则覆盖，新增界面时请在浏览器里实际核验。 */
'use strict';
const fs = require('fs');
const path = require('path');
const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);
const BT = String.fromCharCode(96);
const IDX = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(IDX, 'utf8');

function sliceBetween(from, to) {
  const a = html.indexOf(from);
  if (a < 0) throw new Error('mark1: ' + from);
  const b = html.indexOf(to, a);
  if (b < 0) throw new Error('mark2: ' + to);
  return html.slice(a + from.length, b);
}
function asJSON(s) {
  let out = s, i;
  while ((i = out.indexOf('/*')) >= 0) {
    const j = out.indexOf('*/', i);
    if (j < 0) break;
    out = out.slice(0, i) + out.slice(j + 2);
  }
  return JSON.parse(out);
}
const TR = asJSON('{' + sliceBetween('var TR = {', NL + '};') + '}');
const FRAG = asJSON('{' + sliceBetween('var FRAG = {', NL + '};') + '}');

/* RULES 原生副本：只做覆盖性判断（与 index.html 的 RULES 概念同步） */
const RULE_PATTERNS = [];
{
  const pairs = [
    ['^还有 (\\d+) 张没打卡$'], ['^连续 (\\d+) 天 · 本周 (\\d+)/7$'], ['^守住 (\\d+) 天 · 本周 (\\d+)/7$'],
    ['^本周 (\\d+) 天全守住'], ['^本周漏了 1 次'], ['^本周已漏 (\\d+) 次'],
    ['^进行中 (\\d+) 个目标$'], ['^累计记录 (\\d+) 条$'], ['^已逾期 (\\d+) 天$'],
    ['^· 最长连续 (\\d+) 天$'], ['^· 最长守住 (\\d+) 天$'], ['^· 累计 (\\d+) 条$'],
    ['^目标已达成，共投入 (\\d+)'], ['^已创建目标「(.+)」$'], ['^已删除「(.+)」$'],
    ['^删除「(.+)」及其全部记录$'], ['^删除「(.+)」？相关'], ['^打卡：(.+)$'],
    ['^(\\d{4}-\\d{2}-\\d{2}) 已打卡$'], ['^主题色 (.+)$'], ['^今天已 +(\\d+)$'],
    ['^(\\d{1,2})月(\\d{1,2})日$'], ['^连续 (\\d+) 天$'], ['^(\\d+) 天$'], ['^(\\d+) 张$'], ['^(\\d+) 条$'],
    ['^本次完成（(.+)）$'], ['^编辑目标 (.+)$'], ['^删除目标 (.+)$'],
    ['^ / (\\d+) ([\\u4e00-\\u9fa5]{1,3}) · 截止 ([\\d/]+)'],
    ['^ ([\\u4e00-\\u9fa5]{1,3})。'],
    ['【学习周报】'], ['保持：'], ['问题：'], ['尝试：'], ['下周预案：'],
    ['本周总投入：'], ['合计投入'], ['共 (\\d+) 次、?(\\d+) 分钟'],
    ['（较上周 ([+\\-]?\\d+%?)）'], ['（上周 ([+\\-]?\\d+%?)）'],
    ['^将删除全部目标与打卡记录'], ['学习目标数据_'], [' · 习惯卡$']
  ];
  for (let i = 0; i < pairs.length; i++) {
    RULE_PATTERNS.push(new RegExp(pairs[i][0].split(BS + BS).join(BS)));
  }
}
{
  const srcRuleLines = sliceBetween('var RULES = [', NL + '];').split(NL)
    .filter(function (l) { return l.trim().indexOf('[/') === 0; }).length;
  if (srcRuleLines !== RULE_PATTERNS.length) {
    console.error('警告：本文件规则副本(' + RULE_PATTERNS.length + '条)与 index.html 源(' + srcRuleLines + '条)不同步，请更新');
  }
}

const QC = String.fromCharCode(34, 39, 96);
const candidates = new Map();
function add(text, where) {
  const s = String(text).split(BS + 'n').join(NL);
  if (!s.trim() || !hasCJK(s)) return;
  if (!candidates.has(s)) candidates.set(s, []);
  candidates.get(s).push(where);
}
function stripStyle(src) {
  let out = src;
  for (;;) {
    const a = out.indexOf('<style');
    if (a < 0) break;
    const b = out.indexOf('</style>', a);
    if (b < 0) break;
    out = out.slice(0, a) + out.slice(b + 8);
  }
  return out;
}
function tagToNL(src) {
  let out = '', i = 0;
  while (i < src.length) {
    if (src.charAt(i) === '<') {
      const j = src.indexOf('>', i);
      if (j < 0) break;
      out = out + NL;
      i = j + 1;
    } else { out = out + src.charAt(i); i++; }
  }
  return out;
}
const cut = sliceBetween('window.I18N = (function(){', NL + '})();');
const htmlClean = stripStyle(html).split(cut).join('');
const litScan = function (src) {
  let i = 0;
  while (i < src.length) {
    const ch = src.charAt(i);
    if (ch === '"' || ch === "'" || ch === BT) {
      const close = src.indexOf(ch, i + 1);
      if (close < 0) break;
      add(src.slice(i + 1, close), 'JS');
      i = close + 1;
    } else i++;
  }
};
litScan(htmlClean);
let a1 = html.indexOf('var BODY_SRC = "');
if (a1 >= 0) {
  const start = a1 + 'var BODY_SRC = "'.length;
  let i = start;
  while (i < html.length) {
    if (html.charAt(i) === BS) { i = i + 2; continue; }
    if (html.charAt(i) === '"') break;
    i++;
  }
  const inner = tagToNL(JSON.parse('"' + html.slice(start, i) + '"'));
  inner.split(NL).forEach(function (l) { add(l.split(/\s{2,}/).join(' '), 'BODY'); });
}
let a2 = html.indexOf('app.innerHTML=' + BT);
if (a2 >= 0) {
  const end2 = html.lastIndexOf(BT + ';');
  const inner2 = tagToNL(html.slice(a2 + 14 + 1, end2));
  inner2.split(NL).forEach(function (l) { add(l.split(/\s{2,}/).join(' '), 'GUIDE'); });
}
function hasCJK(s) { return /[\u4e00-\u9fa5]/.test(s); }
function simulateT(s) {
  if (!hasCJK(s)) return null;
  if (Object.prototype.hasOwnProperty.call(TR, s)) return TR[s];
  const st = s.split('  ').join(' ');
  if (st !== s && Object.prototype.hasOwnProperty.call(TR, st)) return TR[st];
  if (Object.prototype.hasOwnProperty.call(FRAG, s)) return FRAG[s];
  let out = s;
  for (let i = 0; i < RULE_PATTERNS.length; i++) { if (RULE_PATTERNS[i].test(out)) return 'RULED'; }
  return null;
}
const survivors = [];
for (const [text] of candidates) {
  if (text.indexOf('<') >= 0) continue;
  if (simulateT(text) === null) survivors.push(text);
}
console.log('候选:', candidates.size, '| 幸存:', survivors.length);
console.log('（幸存者应只余用户数据/种子内容类字符串；界面文案出现即为漏翻）');
console.log('---');
survivors.forEach(function (s) { console.log(JSON.stringify(s)); });
