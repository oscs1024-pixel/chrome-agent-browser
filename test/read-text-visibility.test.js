// 正文提取的可见性契约 —— 不需要浏览器，进 `npm test`。
//
// 这条约束脆弱且静默：拿 cloneNode 出来的**脱离文档树**的副本去调 innerText，
// 浏览器按规范退化成 textContent，于是 display:none / visibility:hidden /
// opacity:0 里的文字会全部混进 read_text 的输出。整条链路上没有任何报错——
// 工具照常返回，只是把用户看不见的内容交给了模型。
//
// 真正的行为验证在 test/scenarios.test.js（需要真 Chrome），这里守的是
// 「这段防线还在、且顺序没被改回去」，一秒内跑完。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = fs.readFileSync(path.join(ROOT, 'extension/content.js'), 'utf8');

test('正文提取走 prunedClone，而不是裸 cloneNode', () => {
  // mainText / toMarkdown 都不许再直接 cloneNode(true)——
  // 一旦绕开 prunedClone，隐藏文字就回来了，而且没有任何测试会红
  const mainText = content.slice(content.indexOf('function mainText'), content.indexOf('function toMarkdown'));
  const toMarkdown = content.slice(content.indexOf('function toMarkdown'), content.indexOf('const clean ='));
  for (const [name, seg] of [['mainText', mainText], ['toMarkdown', toMarkdown]]) {
    assert.ok(seg.includes('prunedClone('), `${name} 必须走 prunedClone`);
    assert.ok(!/cloneNode\(true\)/.test(seg), `${name} 里不许直接 cloneNode(true)`);
  }
});

test('先剪不可见、后删噪声 —— 顺序反了下标就错位', () => {
  // prune 靠 children 下标把副本和活树对齐；提前删掉噪声节点会让下标错位，
  // 于是「哪个元素不可见」判到别人头上，正文会被成片误删（比泄漏更糟）。
  const fn = content.slice(content.indexOf('function prunedClone'), content.indexOf('function prune('));
  const iPrune = fn.indexOf('prune(clone, cand)');
  const iNoise = fn.indexOf('querySelectorAll(NOISE_SEL)');
  assert.ok(iPrune > 0 && iNoise > 0, 'prunedClone 里找不到 prune / NOISE_SEL');
  assert.ok(iPrune < iNoise, 'prunedClone 必须先 prune 再删噪声');
});

test('可见性判定用 checkVisibility，并带旧引擎兜底', () => {
  const fn = content.slice(content.indexOf('function isRendered'), content.indexOf('function prunedClone'));
  assert.ok(fn.includes('checkVisibility'), 'isRendered 必须优先用 checkVisibility');
  // checkOpacity 和 checkVisibilityCSS 缺一不可：前者管 opacity:0（DeepSeek 那条
  // 导航轨正是这种），后者管 display:none / visibility:hidden
  assert.ok(fn.includes('checkOpacity: true'), 'checkVisibility 必须开 checkOpacity');
  assert.ok(fn.includes('checkVisibilityCSS: true'), 'checkVisibility 必须开 checkVisibilityCSS');
  // 旧引擎（没有 checkVisibility）退化到手工判定，不能直接放行
  assert.ok(fn.includes('getComputedStyle'), 'isRendered 缺旧引擎的手工兜底');
});

test('零尺寸只对有文字的叶子下手', () => {
  // display:contents 这类容器天然是 0×0，但子节点可见；
  // 不加叶子条件就会把正常正文成片切掉
  const fn = content.slice(content.indexOf('function isRendered'), content.indexOf('function prunedClone'));
  assert.ok(/!el\.children\.length/.test(fn), 'isRendered 的尺寸判定必须限定在叶子元素上');
});

test('活树全程不被修改', () => {
  // 判定阶段只在副本上删；给活树打标记再擦掉的做法一旦抛异常就会在用户页面上留痕
  const fn = content.slice(content.indexOf('function prune('), content.indexOf('function mainText'));
  assert.ok(!/live\.removeChild|live\.remove\(|live\.setAttribute/.test(fn),
    'prune 不许改活树');
});
