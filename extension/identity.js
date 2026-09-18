// 会话身份 —— 把一个 sid 变成「用户一眼能认出、且不会和别人撞」的一套外观。
//
// 多 agent 并发时，隔离做得再干净，用户面前也是一片安静：页面上没痕迹、
// 标签栏没痕迹。他不知道哪一页有主、有几个主、是谁。这个文件就是那套痕迹的真源。
//
// 三条设计约束：
//
// 1. **跨桥重启稳定。** 外观完全由 sid 决定（纯函数，无状态、不落盘）。
//    sid 本身就是为了「桥重启后会话身份不变」而存在的（见 src/lib/rpc.js），
//    外观跟着它走，就自动继承了那份稳定性——用户不会看见一个页面的标记
//    在桥抖一下之后突然换了颜色。
//
// 2. **形状 × 颜色，不只靠颜色。** 红绿色盲占男性 8%，一排只有颜色不同的
//    圆点对他们等于没有区分。所以调色板是 7 色 × 圆/方两种形状 = 14 个身份，
//    分不清颜色的人至少分得清圆和方。
//
// 3. **agent 显示名不维护第二张表。** src/agents.json 里那张表的承诺是
//    「加一个 agent 只要加一行，不用改代码」，在扩展侧再抄一份就把它作废了。
//    显示名由 MCP server 侧查那张表后随 hello 带过来（桥转发时叫 label），
//    这里只对它做一次机械美化：claude-code → Claude Code，而「Codex CLI」
//    「OpenClaw」这类已经是显示名的字符串原样通过（test/identity.test.js 守着）。
//    老桥不带 label 时拿到的是 slug，美化错了也只是大小写不好看，不影响识别。

// 圆形一组在前：只有一两个会话时（绝大多数时候）优先落在辨识度最高的圆点上。
// group 是 Chrome 标签组的颜色名（tabGroups API 只认它那 9 个名字，不认 hex）——
// 标签组是标签栏上最显著的信号，它的颜色必须和页内标记同源，否则用户要在
// 「标签组是绿的、页内边框也是绿的」这件事上得不到互相印证。棕色映射到 grey：
// Chrome 没有棕，灰是唯一不会被认成别的会话的中性色。
export const MARK_PALETTE = [
  // 色值刻意比 Tailwind 默认色深一档：页边框要同时压得住白底网页，
  // 又能在深色页面上保留足够色度。红色只作为身份色使用；危险确认仍有
  // 「危险操作」文字和独立版式，不靠红色单独传意。
  { emoji: '🟣', color: '#7c3aed', group: 'purple', shape: 'circle' },
  { emoji: '🟢', color: '#059669', group: 'green', shape: 'circle' },
  { emoji: '🔵', color: '#2563eb', group: 'blue', shape: 'circle' },
  { emoji: '🟠', color: '#ea580c', group: 'orange', shape: 'circle' },
  { emoji: '🔴', color: '#e11d48', group: 'red', shape: 'circle' },
  { emoji: '🟡', color: '#b45309', group: 'yellow', shape: 'circle' },
  { emoji: '🟤', color: '#92400e', group: 'grey', shape: 'circle' },
  { emoji: '🟪', color: '#7c3aed', group: 'purple', shape: 'square' },
  { emoji: '🟩', color: '#059669', group: 'green', shape: 'square' },
  { emoji: '🟦', color: '#2563eb', group: 'blue', shape: 'square' },
  { emoji: '🟧', color: '#ea580c', group: 'orange', shape: 'square' },
  { emoji: '🟥', color: '#e11d48', group: 'red', shape: 'square' },
  { emoji: '🟨', color: '#b45309', group: 'yellow', shape: 'square' },
  { emoji: '🟫', color: '#92400e', group: 'grey', shape: 'square' },
];

// FNV-1a。选它不是因为快，是因为它短到可以原样抄进任何一侧，
// 且在不同 JS 引擎上结果一模一样——外观必须在扩展、桥、测试里算出同一个值。
function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// claude-code → Claude Code；已经带大写的是显示名（iFlow、OpenClaw），原样通过
export function prettyClient(client) {
  const c = String(client || '').trim();
  if (!c || c === 'unknown') return 'AI agent';
  if (/[A-Z]/.test(c)) return c;
  return c.split(/[-_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// sid 的形状是 `<client>:p<ppid>`（见 src/lib/rpc.js）。冒号后那截就是短码——
// 它是 agent 进程的父 pid，用户能拿它对上自己的终端窗口，比一个哈希出来的
// 随机串有用得多。宿主自定义 sessionId 时没有这个结构，退回取尾部。
export function identityOf(sid, client) {
  const s = String(sid ?? '');
  const i = s.indexOf(':');
  const slug = client || (i > 0 ? s.slice(0, i) : '');
  const code = i >= 0 && i < s.length - 1 ? s.slice(i + 1) : s.slice(-6);
  const p = MARK_PALETTE[hash32(s) % MARK_PALETTE.length];
  return {
    sid: s,
    emoji: p.emoji,
    color: p.color,
    group: p.group,
    shape: p.shape,
    label: prettyClient(slug),
    code,
  };
}
