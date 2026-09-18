// 统一呈现层 —— agent 在这个页面上的「身体」，人看的那一侧全在这里
//
// 这个产品最反直觉的一点：agent 干活时**不抢焦点**，全在后台标签页里。
// 好处是不打断用户，代价是他完全看不见发生了什么。隔离逻辑（agentTab:<sid> 槽）
// 早就有了，但它只对 agent 说话，从来没对人说过。这个文件补上人的那一侧，
// 按三个递进层次回答三个问题：
//
//   存在感 —— 它在哪：彩色标签组（background 侧）+ 页内四边描边
//   动作感 —— 它此刻在做什么：呼吸泛光的箭头光标，滑到哪就是在动哪
//   意图感 —— 它在想什么：右下角驾驶舱（正在做 / 准备做 / 时间线 / 需要确认）
//
// 品牌的边界：头像只出现在**我们自己的标识位**——驾驶舱、ask 浮条、
// 扩展图标、标签组。favicon 是网站的门牌，不动；指针是指针，不拿头像替。
// 标签栏的存在感交给彩色标签组；document.title 与 favicon 始终保持原样。
//
// ask（人工介入浮条）也并进来了：页面上只该有一套我们的 UI，两个文件各画
// 各的迟早叠在一起。合并还白捡一个修复——ask 从此也在 context 看门狗的
// 保护之下，扩展重载不再留下一块永远没人回应的浮条。
//
// 三条铁律（背后各有一次真实事故或一类必然事故）：
// 1. 呈现绝不挤进命令的关键路径——所有动画 fire-and-forget，永不被 await。
// 2. 数据不当代码用——agent 声明的意图、act 文案、ask 正文可能源自被注入的
//    页面，一律 textContent，绝不拼 innerHTML。
// 3. 信号诚实——呼吸=正在干活的承诺。会话空闲后光标必须休眠，不能骗人。
//
// 样式全装在 shadow root 里：页面一个 `div { font-size: 0 }` 就能让普通浮层
// 消失，shadow root 是唯一彻底的隔离。

(() => {
  if (window.__abMark) return;
  window.__abMark = true;

  // 顶层框架才画。content.js 是 allFrames 注入的，本文件按设计只注顶层，
  // 但防御性地守住：iframe 里也画的话，一个带广告的页面会冒出七八套 UI。
  const TOP = window.top === window;

  // chrome-agent-browser 专属图标，圆形裁剪 PNG。内嵌 base64 而不是
  // chrome.runtime.getURL：后者要开 web_accessible_resources，任何网页都能
  // 借它探测扩展存在（指纹）。页面里的呈现一律画到 canvas 上
  // （createImageBitmap(Blob) 是纯内存操作），绝不走 <img src="data:">——
  // 严格 CSP 的站点 img-src 不带 data: 时那条路会静默烂掉。
  const AVATAR_B64 = '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';

  let bitmapP = null;
  function avatarBitmap() {
    if (!bitmapP) {
      const bytes = Uint8Array.from(atob(AVATAR_B64), (ch) => ch.charCodeAt(0));
      bitmapP = createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    }
    return bitmapP;
  }

  // 头像 canvas（2x 抗高分屏）。位图异步到位，到位前是空白圆——几十毫秒的事。
  // 构建失败（极端环境）退化成色点，品牌让位给可用性。
  function avatarCanvas(size, cls) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    c.style.width = c.style.height = `${size}px`;
    c.className = cls || 'ava';
    avatarBitmap().then((bmp) => {
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    }).catch(() => { c.style.background = '#a8a29e'; });
    return c;
  }

  // 身份不能只靠颜色。identity.js 给每个会话稳定分配 circle / square，
  // 这里把形状真的画出来；之前形状只存在于退役的标题 emoji 里，页面 UI
  // 永远都是圆头像，色觉不敏感用户实际上拿不到第二条识别线索。
  function identityBadge(o, size = 24) {
    const badge = document.createElement('span');
    badge.className = `identity ${o.shape === 'square' ? 'square' : 'circle'}`;
    badge.style.setProperty('--c', o.color);
    badge.style.width = badge.style.height = `${size}px`;
    badge.appendChild(avatarCanvas(Math.max(14, size - 6)));
    return badge;
  }

  // ---------- 状态 ----------

  let owners = [];      // [{ emoji, color, shape, label, code, sid }]
  let logs = {};        // sid -> [{ t, text }] 新的在前（background 的环形缓冲）
  let intents = {};     // sid -> { text, t }   agent 用 status 声明的「准备做什么」
  let plan = [];        // 正在跑的批处理还剩哪些步（扩展生成的描述，不是 agent 的话）
  let tabLabel = '';    // agent 开页时声明的「这页是哪条线」（属于 tab，不属于某个主）
  let expanded = false; // 驾驶舱展开还是收成胶囊。偏好落在 chrome.storage.local
  let stats = {};       // sid -> { steps, lastAction, durationSec }
  let host = null, wrap = null, dock = null, overlayHost = null;
  let watchdog = null, flashTimer = null, tickTimer = null;
  const actState = new Map();   // sid -> { text, timer } 「刚刚做了什么」的短暂高亮

  const CSS = `
    :host { all: initial; }
    .wrap {
      color-scheme: dark;
      font: 500 12px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
      -webkit-font-smoothing: antialiased;
      --panel: rgba(15, 23, 42, .96);
      --panel-2: rgba(30, 41, 59, .96);
      --text: #f8fafc;
      --muted: #cbd5e1;
      --subtle: #94a3b8;
    }

    /* ---- 四边描边：常驻答「有没有主」，亮一下答「它刚动了」 ---- */
    .edge {
      position: fixed; pointer-events: none; z-index: 2147483645;
      opacity: .74;
      transition: opacity .18s ease, filter .18s ease, box-shadow .18s ease;
      filter: saturate(1.05) drop-shadow(0 0 1px rgba(15,23,42,.42));
    }
    /* 顶边是主状态线，四周细边只负责把受控页面圈出来。这样白页上够清楚，
       又不会像 2px 四边框那样长期抢页面内容。 */
    .edge.t { top: 0; left: 0; right: 0; height: 3px; box-shadow: 0 2px 10px rgba(15,23,42,.16); }
    .edge.b { bottom: 0; left: 0; right: 0; height: 1px; }
    .edge.l { top: 0; bottom: 0; left: 0; width: 1px; }
    .edge.r { top: 0; bottom: 0; right: 0; width: 1px; }
    .lit .edge { opacity: 1; filter: saturate(1.25) drop-shadow(0 0 4px rgba(15,23,42,.34)); }
    .lit .edge.t { box-shadow: 0 2px 16px rgba(15,23,42,.28); }

    /* ---- 虚拟光标：agent 的注意力在页面上的具象 ---- */
    /* 只动 transform/opacity——合成器动画，零重排。它要陪着页面跑几百个动作。 */
    .cursor {
      position: fixed; left: 0; top: 0; z-index: 2147483645;
      pointer-events: none; opacity: 0;
      transition: transform .24s cubic-bezier(.16,1,.3,1), opacity .35s ease;
      will-change: transform;
    }
    .cursor.on { opacity: 1; }
    .cursor .glow {
      position: absolute; left: -34px; top: -34px; width: 68px; height: 68px;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--c) 52%, transparent) 0%, transparent 66%);
      opacity: .62; animation: abBreathe 2.4s ease-in-out infinite;
    }
    @keyframes abBreathe {
      0%, 100% { transform: scale(.92); opacity: .42; }
      50%      { transform: scale(1.22); opacity: .72; }
    }
    /* 白箭头负责跨页面对比度，会话色描边负责身份；深色阴影保证白底也不丢。 */
    .cursor svg {
      position: absolute; left: -2px; top: -2px;
      filter: drop-shadow(0 1px 1px rgba(15,23,42,.78)) drop-shadow(0 3px 7px rgba(15,23,42,.28));
      transform-origin: 6px 5px;
    }
    /* 休眠态只保留“此页有主”的低强度提示，不再持续呼吸。 */
    .cursor.doze { opacity: .56; }
    .cursor.doze .glow { animation: none; opacity: .1; transform: scale(.5); }
    .cursor.doze svg { opacity: .72; }
    .cursor .ring {
      position: absolute; left: -17px; top: -17px; width: 34px; height: 34px;
      border: 2px solid var(--c); border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(255,255,255,.76) inset;
      animation: abRing .55s cubic-bezier(.16,1,.3,1) forwards;
    }
    @keyframes abRing {
      from { transform: scale(.35); opacity: 1; }
      to   { transform: scale(1.85); opacity: 0; }
    }
    .cursor.typing .glow { animation: abType .5s ease-in-out infinite; }
    @keyframes abType {
      0%, 100% { transform: scale(.86); opacity: .5; }
      50%      { transform: scale(1.06); opacity: .84; }
    }
    .cursor.pressed svg { transform: scale(.84); transition: transform .12s; }
    /* bob 动画挂在 svg 上而不是 .cursor 上：.cursor 的 transform 是定位用的
       内联样式，keyframe 一接管它，光标会瞬移回 (0,0) */
    .cursor.bob svg { animation: abBob .5s ease-in-out; }
    @keyframes abBob {
      0%, 100% { transform: none; }
      50%      { transform: translateY(22px); }
    }

    /* ---- 驾驶舱：右下角，收起是胶囊、展开是卡片 ---- */
    .dock {
      position: fixed; right: 18px; bottom: 18px; z-index: 2147483646;
      display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
      transition: opacity .2s ease;
      pointer-events: auto;
    }
    /* 让路：agent 要点的目标落在驾驶舱底下时，它必须瞬间变成「不存在」——
       真实事件(L2)打的是坐标，不让路就是替 agent 点了我们自己的面板 */
    .dock.dodge { pointer-events: none; opacity: .12; }

    .chip {
      appearance: none; box-sizing: border-box;
      display: flex; align-items: center; gap: 8px;
      min-height: 38px; padding: 6px 12px 6px 7px; border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--c) 48%, rgba(255,255,255,.18));
      background: color-mix(in srgb, var(--panel) 94%, var(--c)); color: var(--text); cursor: pointer;
      -webkit-backdrop-filter: blur(12px) saturate(1.2); backdrop-filter: blur(12px) saturate(1.2);
      font: inherit; font-size: 11px; letter-spacing: .1px; white-space: nowrap;
      max-width: 52vw; overflow: hidden;
      box-shadow: 0 8px 24px rgba(15,23,42,.26), 0 2px 6px rgba(15,23,42,.2);
      opacity: .96; transition: opacity .18s ease, transform .18s ease, box-shadow .18s ease;
      animation: abIn .24s cubic-bezier(.16,1,.3,1);
    }
    .chip:hover { opacity: 1; transform: translateY(-1px); box-shadow: 0 10px 28px rgba(15,23,42,.32), 0 2px 8px rgba(15,23,42,.22); }
    .chip:focus-visible { outline: 3px solid color-mix(in srgb, var(--c) 62%, white); outline-offset: 2px; }
    .chip.act { opacity: 1; transform: translateY(-1px); }
    /* 只写 from：终态取元素自己的计算样式——chip 和 card 的终态不同。 */
    @keyframes abIn { from { opacity: .01; transform: translateY(10px); filter: blur(3px); } }

    .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
    .identity {
      box-sizing: border-box; display: inline-grid; place-items: center; flex: none;
      border: 1.5px solid var(--c);
      background: color-mix(in srgb, var(--c) 18%, #fff);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 16%, transparent);
    }
    .identity.circle { border-radius: 50%; }
    .identity.square { border-radius: 7px; }
    .identity .ava { border-radius: 50%; border: 0; flex: none; background: #fff; }
    .who { font-weight: 700; letter-spacing: -.01em; }
    .state {
      display: inline-flex; align-items: center; gap: 4px; flex: none;
      color: var(--muted); font-size: 10px; font-weight: 650;
    }
    .state .cue { width: 6px; height: 6px; background: var(--c); box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 20%, transparent); }
    .state .cue.circle { border-radius: 50%; }
    .state .cue.square { border-radius: 1.5px; }
    .state.idle { color: #94a3b8; }
    .state.idle .cue { background: #94a3b8; box-shadow: none; }
    .sep { color: #64748b; }
    .what { color: var(--muted); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; }

    .card {
      width: 320px; max-width: calc(100vw - 36px);
      border-radius: 16px; overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--c) 34%, rgba(255,255,255,.12));
      background: color-mix(in srgb, var(--panel) 96%, var(--c)); color: var(--text);
      -webkit-backdrop-filter: blur(16px) saturate(1.18); backdrop-filter: blur(16px) saturate(1.18);
      box-shadow: 0 18px 48px rgba(15,23,42,.34), 0 4px 12px rgba(15,23,42,.2);
      animation: abIn .22s cubic-bezier(.16,1,.3,1);
    }
    .card .head {
      display: flex; align-items: center; gap: 9px;
      min-height: 38px; padding: 10px 12px;
      background: color-mix(in srgb, var(--panel-2) 92%, var(--c));
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .card .head .code {
      color: var(--subtle); font-size: 10px; font-variant-numeric: tabular-nums;
      padding: 2px 6px; border-radius: 999px; background: rgba(255,255,255,.06);
    }
    .card .head .connected { margin-left: auto; }
    .card .head .fold {
      display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; cursor: pointer;
      border: 0; border-radius: 6px; background: transparent; color: var(--muted);
      transition: background .15s ease, color .15s ease;
    }
    .card .head .fold svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .card .head .fold:hover { background: rgba(255,255,255,.12); color: #fff; }
    .card .head .fold:focus-visible { outline: 2px solid color-mix(in srgb, var(--c) 70%, white); outline-offset: 1px; }
    .card .sec { padding: 9px 12px 10px; border-bottom: 1px solid rgba(255,255,255,.055); }
    .card .sec:last-child { border-bottom: none; }
    .card .lab { font-size: 10px; letter-spacing: .07em; color: var(--subtle); margin-bottom: 5px; }
    /* agent 说的话和扩展观察到的事实分开呈现。意图用有界色面而非粗色边，
       在不同身份色下都更稳定，也不误装成警告。 */
    .card .intent {
      padding: 6px 8px; border-radius: 8px;
      background: color-mix(in srgb, var(--c) 12%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 24%, transparent);
      color: #e2e8f0;
    }
    .card .intent .ago { color: var(--subtle); font-size: 10px; margin-left: 6px; }
    .card .now { display: flex; align-items: center; gap: 7px; color: #f8fafc; }
    .card .now .pulse { width: 7px; height: 7px; border-radius: 50%; flex: none; animation: abPulse 1.6s ease-in-out infinite; }
    @keyframes abPulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
    .card .plan { color: var(--muted); }
    .card .tl {
      max-height: 138px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
      scrollbar-color: rgba(148,163,184,.55) transparent; scrollbar-width: thin;
    }
    .card .tl .row { display: flex; align-items: baseline; gap: 8px; font-size: 11px; color: var(--subtle); }
    .card .tl .row:first-child { color: #e2e8f0; }
    .card .tl .ago { flex: none; width: 44px; text-align: right; font-variant-numeric: tabular-nums; color: #94a3b8; }
    .card .tl .row .txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card .tl .row .dur { flex: none; margin-left: auto; color: #64748b; font-size: 10px; font-variant-numeric: tabular-nums; }

    @media (prefers-reduced-motion: reduce) {
      .edge, .cursor, .chip { transition-duration: .01ms !important; }
      .cursor .glow, .cursor .ring, .cursor.bob svg, .card .now .pulse,
      .ask .head .dot { animation: none !important; }
    }

    /* ---- 顶部悬浮容器：专供 ask 与 borrow 浮层，置顶居中，不挡页面点击 ---- */
    .overlay-host {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      pointer-events: none;
      width: 100%;
      max-width: 500px;
      box-sizing: border-box;
      padding: 0 16px;
    }

    /* ---- ask：规范化页内 Human-in-the-Loop 浮层 (HelpRequestOverlay) ---- */
    .ask {
      width: 100%; max-width: 480px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #1a1a1a; border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,.22), 0 0 0 1px rgba(249,115,22,.25);
      border: 1px solid rgba(0,0,0,.08); font-size: 14px;
      overflow: hidden; animation: abSlideDown .25s cubic-bezier(.16,1,.3,1);
      pointer-events: auto;
    }
    .ask .head {
      display: flex; align-items: center; gap: 8px;
      padding: 13px 16px; background: linear-gradient(135deg,#fff7ed,#ffedd5);
      border-bottom: 1px solid rgba(0,0,0,.06); font-weight: 600; font-size: 14px;
    }
    .ask .head .dot { width: 8px; height: 8px; border-radius: 50%; background: #f97316; animation: abPulse 1.6s ease-in-out infinite; }
    .ask .body { padding: 14px 16px 6px; white-space: pre-wrap; word-break: break-word; font-size: 13.5px; line-height: 1.5; }
    .ask .note { width: 100%; box-sizing: border-box; margin: 10px 0 2px; padding: 8px 10px;
                 border: 1px solid #e2e2e2; border-radius: 8px; font: inherit; font-size: 13px;
                 resize: vertical; min-height: 34px; }
    .ask .note:focus { outline: 2px solid #fdba74; outline-offset: -1px; border-color: transparent; }
    .ask .foot { display: flex; gap: 8px; padding: 10px 16px 14px; align-items: center; }
    .ask .clock { font-size: 12px; color: #9a9a9a; margin-right: auto; font-variant-numeric: tabular-nums; font-weight: 500; }
    .ask button { font: inherit; font-size: 13px; border-radius: 8px; padding: 7px 15px;
                  border: 1px solid transparent; cursor: pointer; transition: .15s; }
    .ask .ok { background: #f97316; color: #fff; font-weight: 600; }
    .ask .ok:hover { background: #ea580c; }
    .ask .no { background: #fff; color: #666; border-color: #e2e2e2; }
    .ask .no:hover { background: #f6f6f6; }
    .ask.danger .head { background: linear-gradient(135deg,#fef2f2,#fee2e2); }
    .ask.danger .head .dot { background: #dc2626; }
    .ask.danger .ok { background: #dc2626; }
    .ask.danger .ok:hover { background: #b91c1c; }
    .ask .what { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #f8f8f8;
                 font-size: 13px; word-break: break-all; }
    .ask .amount { font-weight: 700; font-size: 16px; color: #dc2626; }

    /* ---- 标签页借用授权浮层 (BorrowConfirmationOverlay) ---- */
    .borrow-overlay {
      width: 100%; max-width: 480px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #1a1a1a; border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,.22), 0 0 0 1px rgba(37,99,235,.25);
      border: 1px solid rgba(0,0,0,.08); font-size: 14px;
      overflow: hidden; animation: abSlideDown .25s cubic-bezier(.16,1,.3,1);
      pointer-events: auto;
    }
    .borrow-overlay .head {
      display: flex; align-items: center; gap: 8px;
      padding: 13px 16px; background: linear-gradient(135deg,#eff6ff,#dbeafe);
      border-bottom: 1px solid rgba(0,0,0,.06); font-weight: 600; font-size: 14px;
    }
    .borrow-overlay .head .dot { width: 8px; height: 8px; border-radius: 50%; background: #2563eb; }
    .borrow-overlay .body { padding: 14px 16px 8px; white-space: pre-wrap; word-break: break-word; font-size: 13.5px; line-height: 1.5; }
    .borrow-overlay .foot { display: flex; gap: 8px; padding: 10px 16px 14px; align-items: center; justify-content: flex-end; }
    .borrow-overlay button { font: inherit; font-size: 13px; border-radius: 8px; padding: 7px 15px; border: 1px solid transparent; cursor: pointer; transition: .15s; }
    .borrow-overlay .ok { background: #2563eb; color: #fff; font-weight: 600; }
    .borrow-overlay .ok:hover { background: #1d4ed8; }
    .borrow-overlay .no { background: #fff; color: #666; border-color: #e2e2e2; }
    .borrow-overlay .no:hover { background: #f6f6f6; }

    /* ---- 提示消息 Toast ---- */
    .toast {
      padding: 9px 18px;
      background: rgba(17, 24, 39, 0.92);
      backdrop-filter: blur(12px);
      color: #fff; font-size: 13px; font-weight: 500;
      border-radius: 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,.2);
      animation: abSlideDown .2s cubic-bezier(.16,1,.3,1);
      pointer-events: auto;
    }

    @keyframes abSlideDown {
      from { opacity: 0; transform: translateY(-16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-color-scheme: dark) {
      .ask, .borrow-overlay { background: rgba(28,28,30,.96); color: #f2f2f2; border-color: rgba(255,255,255,.1); }
      .ask .head { background: linear-gradient(135deg,#3b2a1a,#2c1f14); border-bottom-color: rgba(255,255,255,.07); }
      .borrow-overlay .head { background: linear-gradient(135deg,#1e293b,#0f172a); border-bottom-color: rgba(255,255,255,.07); }
      .ask .note { background: #2a2a2c; border-color: #3a3a3c; color: #f2f2f2; }
      .ask .no, .borrow-overlay .no { background: #2a2a2c; color: #ccc; border-color: #3a3a3c; }
      .ask .no:hover, .borrow-overlay .no:hover { background: #333; }
      .ask.danger .head { background: linear-gradient(135deg,#3f1d1d,#2a1414); }
      .ask .what { background: #2a2a2c; }
      .ask .amount { color: #f87171; }
    }
  `;

  // ---------- host ----------

  // 不用 innerHTML：Gmail 等站点启用了 require-trusted-types-for 'script'，
  // 即便模板完全静态，向 Element.innerHTML 赋字符串也会直接抛异常。呈现层一旦
  // 在 ensureHost 里中断，边框、驾驶舱和消息回执会一起消失，background 后续
  // 重注又会被文件顶部的 __abMark 守卫短路。统一用 DOM API 构建可跨站运行。
  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function ensureHost() {
    if (host) return;
    // z-index 顶格：ask 并进来之后这个 host 不再是纯装饰层——「需要确认」的
    // 浮条绝不能被页面自己的最高层弹窗盖住（支付确认被遮住=没有确认）。
    // 边框和光标跟着顶格没有代价，它们 pointer-events:none。
    // 必须显式锚定到视口左上角 (top:0; left:0; width:0; height:0; pointer-events:none)：
    // 否则在高度达数千像素的长页面（如 B 站）上，all:initial 会让 host 的静态位置沦陷在
    // 页面流的最底部（如 y=2800px+），导致内部 fixed 浮层被错误锚定到屏幕视口之外。
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    wrap = document.createElement('div');
    wrap.className = 'wrap';

    for (const side of ['t', 'b', 'l', 'r']) {
      const edge = document.createElement('div');
      edge.className = `edge ${side}`;
      wrap.appendChild(edge);
    }

    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    const glow = document.createElement('div');
    glow.className = 'glow';
    // <svg viewBox="0 0 26 26"
    const pointer = svgEl('svg', { width: '27', height: '27', viewBox: '0 0 26 26', 'aria-hidden': 'true' });
    pointer.appendChild(svgEl('path', {
      d: 'M4 2 L4 21.5 L9.2 16.8 L12.8 24.5 L16.5 22.8 L12.9 15.2 L19.8 15.2 Z',
      fill: '#fff', stroke: 'var(--c)', 'stroke-width': '2.1', 'stroke-linejoin': 'round',
    }));
    cursor.append(glow, pointer);
    wrap.appendChild(cursor);

    // own 装会话胶囊/卡片，ask 直接挂在 dock 下。分开是为了重画会话区时
    // 不动 ask 节点——它有输入框，挪一下用户打了一半的字就丢焦点。
    dock = document.createElement('div');
    dock.className = 'dock';
    dock.addEventListener('mouseenter', () => cancelTeardown());
    dock.addEventListener('mouseleave', () => { if (!owners.length && !expanded) scheduleTeardown(); });
    const own = document.createElement('div');
    own.className = 'own';
    dock.appendChild(own);
    wrap.appendChild(dock);

    overlayHost = document.createElement('div');
    overlayHost.className = 'overlay-host';
    wrap.appendChild(overlayHost);
    root.append(style, wrap);
    document.documentElement.appendChild(host);
    if (stealthed) host.style.visibility = 'hidden';
    window.addEventListener('resize', onResize);
    watchContext();
  }

  // 窗口尺寸变化时，休眠光标自动重算停靠位置，防止小屏/分屏时漂移出窗外
  function onResize() {
    if (!wrap) return;
    const c = wrap.querySelector('.cursor');
    if (c && c.classList.contains('doze')) {
      const p = dozeSpot();
      moveCursor(p.x, p.y);
    }
  }

  // host 只在「既没有主、也没有挂着的 ask」时才拆——ask 是功能件不是装饰件，
  // 用户把标记开关关掉（收到 clear）时它必须还在。
  let lastOwners = [];
  let teardownTimer = null;
  let fadeTimer = null;

  function cancelTeardown() {
    if (teardownTimer) { clearTimeout(teardownTimer); teardownTimer = null; }
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    if (dock) { dock.style.opacity = '1'; dock.style.transition = 'opacity .2s ease'; }
  }

  function scheduleTeardown() {
    if (owners.length || expanded || !lastOwners.length || askSettle || teardownTimer) return;
    fadeTimer = setTimeout(() => {
      if (dock) {
        dock.style.transition = 'opacity .6s ease';
        dock.style.opacity = '0';
      }
    }, 7400);
    teardownTimer = setTimeout(() => {
      lastOwners = [];
      teardownTimer = null;
      fadeTimer = null;
      maybeTeardown();
    }, 8000);
  }

  function maybeTeardown() {
    if (owners.length || askSettle) return;
    if (teardownTimer) { clearTimeout(teardownTimer); teardownTimer = null; }
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    lastOwners = [];
    window.removeEventListener('resize', onResize);
    if (host) { host.remove(); host = null; wrap = null; dock = null; }
    for (const s of actState.values()) clearTimeout(s.timer);
    actState.clear();
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (dozeTimer) { clearTimeout(dozeTimer); dozeTimer = null; }
    cursorShown = false;
    if (watchdog) { clearInterval(watchdog); watchdog = null; }
  }

  // 扩展一旦被重载、更新或停用，这个页面里的脚本就永远收不到消息了
  // （chrome.runtime.id 变成 undefined，俗称 context invalidated）。
  // 没有这条自检，标记会永久钉在页面上：background 那边的记账在扩展重载时
  // 一起清空了，再没有任何人知道该来摘它。ask 同理——重载后 background 的
  // 轮询已经死了，浮条留着也永远没人收结果，一并拆掉。
  function watchContext() {
    if (watchdog) return;
    watchdog = setInterval(() => {
      if (chrome.runtime?.id) return;
      owners = [];
      if (askSettle) closeAsk('cancelled', '扩展已重载');
      askSettle = null;
      maybeTeardown();
    }, 5000);
  }

  // ---------- 边框 ----------

  // 一条边的底色。单主用实色；多主用 45° 双色条纹——「这页有两个主」
  // 是最该被一眼看出来的状态，它意味着两个 agent 正在同一个页面上互相踩。
  function edgePaint() {
    if (owners.length === 1) return owners[0].color;
    const stops = [];
    const w = 9;
    owners.forEach((o, i) => stops.push(`${o.color} ${i * w}px ${(i + 1) * w}px`));
    return `repeating-linear-gradient(45deg, ${stops.join(', ')})`;
  }

  // ---------- 驾驶舱 ----------

  const relTime = (t) => {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 5) return '刚刚';
    if (s < 60) return `${s}秒前`;
    if (s < 3600) return `${Math.floor(s / 60)}分前`;
    return `${Math.floor(s / 3600)}时前`;
  };

  function render() {
    if (!TOP) return;
    if (!owners.length && !lastOwners.length && !askSettle) return maybeTeardown();
    ensureHost();

    if (owners.length) {
      lastOwners = [...owners];
      cancelTeardown();
    } else if (expanded) {
      // 展开查看面板时永不自动淡出销毁，避免阅读时间线时面板突然消失
      cancelTeardown();
    } else {
      // 方案 A（自动延时淡出）：断开连接且处于收起状态时，保留「已完成」胶囊 8 秒后平滑淡出
      scheduleTeardown();
    }

    const isIdle = !owners.length && lastOwners.length > 0;
    const currentOwners = owners.length ? owners : lastOwners;

    // 断开后立刻隐藏四周边框（不再处于活跃操控），仅保留右下角胶囊提示
    const paint = (!isIdle && owners.length) ? edgePaint() : '';
    wrap.querySelectorAll('.edge').forEach((e) => {
      e.style.background = paint;
      e.style.display = (!isIdle && owners.length) ? '' : 'none';
    });

    // 会话区每条 set 消息整个重画。频率是「每条命令一次」，量级远够不着
    // 性能问题，换来的是状态永远和消息一致——增量更新才是这类 UI 历史 bug
    // 的高发地。ask 节点不在这个区里，完全不被触碰。
    const own = wrap.querySelector('.own');
    own.textContent = '';
    for (const o of currentOwners) {
      own.appendChild(expanded ? buildCard(o, isIdle) : buildChip(o, isIdle));
    }

    // 时间线的相对时间要走字——只在展开时付这个定时器
    if (expanded && owners.length && !tickTimer) tickTimer = setInterval(render, 20000);
    if ((!expanded || !owners.length) && tickTimer) { clearInterval(tickTimer); tickTimer = null; }

    syncCursorIdle();
  }

  function buildChip(o, isIdle = false) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.style.setProperty('--c', o.color);
    chip.title = isIdle ? `${o.label} 操作已完成` : '展开 chrome-agent-browser 控制面板';
    chip.setAttribute('aria-label', `${o.label} ${isIdle ? '已完成此页面操作' : '正在控制此页面'}，展开详情`);
    const act = actState.get(o.sid);
    if (act && !isIdle) chip.classList.add('act');
    const av = identityBadge(o, 24);
    const who = document.createElement('span'); who.className = 'who'; who.textContent = o.label;
    const state = document.createElement('span'); state.className = 'state' + (isIdle ? ' idle' : '');
    const cue = document.createElement('span'); cue.className = `cue ${o.shape === 'square' ? 'square' : 'circle'}`;
    const stateText = document.createElement('span');
    stateText.textContent = isIdle ? '已完成' : (act ? '控制中' : '已连接');
    state.append(cue, stateText);
    const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '·';
    const what = document.createElement('span'); what.className = 'what';
    const st = stats[o.sid];
    if (isIdle) {
      what.textContent = st && st.steps > 0
        ? `已完成 · 共 ${st.steps} 步 (${st.durationSec}s)`
        : (tabLabel || '任务已完成');
    } else {
      what.textContent = act ? act.text : (tabLabel || o.code);
    }
    chip.append(av, who, state, sep, what);
    chip.addEventListener('click', (e) => { e.stopPropagation(); setExpanded(true); });
    return chip;
  }

  function buildCard(o, isIdle = false) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--c', o.color);

    const head = document.createElement('div');
    head.className = 'head';
    const av = identityBadge(o, 26);
    const who = document.createElement('span'); who.className = 'who'; who.textContent = o.label;
    const code = document.createElement('span'); code.className = 'code'; code.textContent = o.code;
    const connected = document.createElement('span'); connected.className = 'state connected' + (isIdle ? ' idle' : '');
    const cue = document.createElement('span'); cue.className = `cue ${o.shape === 'square' ? 'square' : 'circle'}`;
    const connectedText = document.createElement('span');
    const act = actState.get(o.sid);
    connectedText.textContent = isIdle ? '已完成' : (act ? '执行中' : '已就绪');
    if (act && !isIdle) connected.classList.add('act');
    connected.append(cue, connectedText);
    const fold = document.createElement('button'); fold.className = 'fold'; fold.type = 'button';
    fold.title = '收起'; fold.setAttribute('aria-label', '收起控制面板');
    const foldIcon = svgEl('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
    foldIcon.appendChild(svgEl('path', { d: 'M4 6l4 4 4-4' }));
    fold.appendChild(foldIcon);
    fold.addEventListener('click', (e) => { e.stopPropagation(); setExpanded(false); });
    head.append(av, who, code, connected, fold);
    card.appendChild(head);

    const sec = (label) => {
      const s = document.createElement('div');
      s.className = 'sec';
      if (label) {
        const l = document.createElement('div'); l.className = 'lab'; l.textContent = label;
        s.appendChild(l);
      }
      card.appendChild(s);
      return s;
    };

    // 本页：agent 开页时声明的这条工作线。也是 agent 写的（铁律2：textContent）。
    if (tabLabel) {
      const s = sec('本页任务');
      const p2 = document.createElement('div'); p2.className = 'plan';
      p2.textContent = tabLabel;
      s.appendChild(p2);
    }

    const st = stats[o.sid];
    if (isIdle && st && st.steps > 0) {
      const s = sec('本轮任务总结');
      const p = document.createElement('div'); p.className = 'plan';
      p.textContent = `执行完毕：共完成 ${st.steps} 步操作，累计耗时 ${st.durationSec} 秒。`;
      s.appendChild(p);
    }

    // 准备做：agent 自己声明的计划。它是 agent 写的（可能源自被注入的页面），
    // 所以带引用边、标时间，和下面扩展观察到的事实在视觉上分开。
    const intent = intents[o.sid];
    if (intent?.text) {
      const s = sec('声明意图');
      const q = document.createElement('div'); q.className = 'intent';
      q.textContent = intent.text;
      const ago = document.createElement('span'); ago.className = 'ago'; ago.textContent = relTime(intent.t);
      q.appendChild(ago);
      s.appendChild(q);
    }

    // 接下来：批处理里还没跑到的步骤。这是扩展从 act 的 steps 里读到的事实，
    // 不需要 agent 配合就有。
    if (plan.length) {
      const s = sec('待执行步骤');
      const p = document.createElement('div'); p.className = 'plan';
      p.textContent = plan.slice(0, 3).join(' → ') + (plan.length > 3 ? ` →（还有 ${plan.length - 3} 步）` : '');
      s.appendChild(p);
    }

    if (act) {
      const s = sec('实时动作');
      const n = document.createElement('div'); n.className = 'now';
      const pulse = document.createElement('span'); pulse.className = 'pulse'; pulse.style.background = o.color;
      const t = document.createElement('span'); t.textContent = act.text;
      n.append(pulse, t);
      s.appendChild(n);
    }

    const rows = logs[o.sid] || [];
    if (rows.length) {
      const s = sec('执行流水');
      const tl = document.createElement('div'); tl.className = 'tl';
      for (const r of rows.slice(0, 12)) {
        const row = document.createElement('div'); row.className = 'row';
        const ago = document.createElement('span'); ago.className = 'ago'; ago.textContent = relTime(r.t);
        const txt = document.createElement('span'); txt.className = 'txt'; txt.textContent = r.summary || r.text;
        row.append(ago, txt);
        if (typeof r.ms === 'number') {
          const dur = document.createElement('span'); dur.className = 'dur';
          dur.textContent = r.ms >= 1000 ? `${(r.ms / 1000).toFixed(1)}s` : `${r.ms}ms`;
          row.appendChild(dur);
        }
        tl.appendChild(row);
      }
      s.appendChild(tl);
    }
    return card;
  }

  function setExpanded(on) {
    expanded = !!on;
    cancelTeardown();
    try { chrome.storage.local.set({ dockOpen: expanded }); } catch { /* context 正在失效 */ }
    render();
  }

  // ---------- 虚拟光标 ----------
  //
  // content.js 与本文件同处一个 isolated world，动作坐标在那边解析元素时
  // 就地传过来（window.__abCursor），零消息往返、零延迟。真实点击(L2)和
  // 合成点击(L1)都先过 locate，所以两条路的光标一致。
  //
  // 顺路兼任「让路」职责：坐标落在驾驶舱底下时把它瞬间变成 pointer-events:none。
  // 这必须在 content.js 做 elementFromPoint 遮挡检测**之前**同步生效——
  // 调用方保证先调本钩子再检测，这里保证 classList 同步改完才返回。

  let cursorShown = false, dozeTimer = null, dodgeTimer = null;
  let curX = 0, curY = 0;

  const dozeSpot = () => ({ x: innerWidth - 30, y: innerHeight - 150 });

  function moveCursor(x, y) {
    const c = wrap.querySelector('.cursor');
    curX = x; curY = y;
    c.style.transform = `translate(${x}px, ${y}px)`;
    return c;
  }

  function syncCursorIdle() {
    if (!wrap) return;
    const c = wrap.querySelector('.cursor');
    c.style.setProperty('--c', owners[0]?.color || '#a855f7');
    if (!owners.length) { c.classList.remove('on'); cursorShown = false; return; }
    // 有主但还没动过手：光标以休眠态停靠在驾驶舱旁——存在感有了，
    // 但不呼吸。呼吸要等第一个动作（铁律 3）。
    if (!cursorShown) {
      const p = dozeSpot();
      c.classList.add('on', 'doze');
      moveCursor(p.x, p.y);
      cursorShown = true;
    }
  }

  function dodgeIfOver(x, y) {
    const dock = wrap.querySelector('.dock');
    const r = dock.getBoundingClientRect();
    if (!r.width || x < r.left - 8 || x > r.right + 8 || y < r.top - 8 || y > r.bottom + 8) return;
    dock.classList.add('dodge');
    clearTimeout(dodgeTimer);
    dodgeTimer = setTimeout(() => wrap && dock.classList.remove('dodge'), 1600);
  }
  // 虚拟光标钩子：同时暴露 __abCursor 与 __hcCursor（兼容姊妹扩展 huashu-chrome 历史命名空间）
  window.__abCursor = window.__hcCursor = (x, y, kind) => {
    if (!TOP || !wrap || !owners.length) return;
    const c = wrap.querySelector('.cursor');
    c.classList.add('on');
    c.classList.remove('doze');

    if (x != null && y != null) {
      dodgeIfOver(x, y);
      moveCursor(x, y);
    }
    if (kind === 'click') {
      // 涟漪等滑行到位再放，否则爆点在起点。时长对齐 transition(240ms)。
      setTimeout(() => {
        if (!wrap) return;
        const ring = document.createElement('span');
        ring.className = 'ring';
        ring.addEventListener('animationend', () => ring.remove());
        c.appendChild(ring);
      }, 240);
    } else if (kind === 'type') {
      c.classList.add('typing');
      setTimeout(() => wrap && c.classList.remove('typing'), 900);
    } else if (kind === 'key') {
      c.classList.add('pressed');
      setTimeout(() => wrap && c.classList.remove('pressed'), 200);
    } else if (kind === 'scroll') {
      c.classList.remove('bob');
      void c.offsetWidth;   // 重启动画
      c.classList.add('bob');
    }

    // 30 秒没有新动作就休眠归位。每个动作重新计时。
    clearTimeout(dozeTimer);
    dozeTimer = setTimeout(() => {
      if (!wrap) return;
      const p = dozeSpot();
      c.classList.add('doze');
      moveCursor(p.x, p.y);
    }, 30000);
  };

  // ---------- ask：人工介入 ----------
  //
  // 从 ask-overlay.js 原样并入，协议不变（show/poll/flash/abort）。
  // 结果靠 background 轮询取，不攥着 sendResponse 等几分钟——页面一旦进
  // back/forward cache 消息通道当场关闭，长回调那版真实撞死过。

  let askEl = null;
  let askSettle = null;   // 当前这一轮的结算标志
  let askOutcome = null;  // 已结算的结果，等 background 来取
  let askTimer = null;

  function closeAsk(result, note) {
    if (askEl) { askEl.remove(); askEl = null; }
    if (askTimer) { clearInterval(askTimer); askTimer = null; }
    askSettle = null;
    askOutcome = { outcome: result, note: note || '' };
    maybeTeardown();
  }

  function showAsk(msg) {
    ensureHost();
    // 上一轮还开着就先结算掉，否则两个浮条叠在一起，旧的永远没人回应
    if (askSettle) closeAsk('cancelled', '被新的请求取代');
    askOutcome = null;
    askSettle = true;

    askEl = document.createElement('div');
    askEl.className = 'ask';
    askEl.setAttribute('role', 'dialog');
    askEl.setAttribute('aria-live', 'polite');

    const askHead = document.createElement('div'); askHead.className = 'head';
    const askDot = document.createElement('span'); askDot.className = 'dot';
    const askTitle = document.createElement('span'); askTitle.className = 't';
    askHead.append(askDot, askTitle);
    const askBody = document.createElement('div'); askBody.className = 'body';
    const askPrompt = document.createElement('span'); askPrompt.className = 'p';
    askBody.appendChild(askPrompt);
    const askFoot = document.createElement('div'); askFoot.className = 'foot';
    const askClock = document.createElement('span'); askClock.className = 'clock';
    const askNo = document.createElement('button'); askNo.className = 'no'; askNo.textContent = '取消';
    const askOk = document.createElement('button'); askOk.className = 'ok'; askOk.textContent = '我完成了';
    askFoot.append(askClock, askNo, askOk);
    askEl.append(askHead, askBody, askFoot);

    // 文案一律走 textContent——prompt 是从 agent 那边传过来的，
    // 而 agent 的内容可能源自页面（也就是可能被注入）。这里是最后一道
    // 「数据不当代码用」的边界。
    askEl.querySelector('.head').prepend(avatarCanvas(20));
    askEl.querySelector('.t').textContent = msg.title || 'chrome-agent-browser 需要你协助';
    askEl.querySelector('.p').textContent = msg.prompt || '';
    if (msg.danger) askEl.classList.add('danger');
    if (msg.okText) askEl.querySelector('.ok').textContent = msg.okText;
    if (msg.noText) askEl.querySelector('.no').textContent = msg.noText;
    // 「点哪个按钮、在哪个站、多少钱」单独拎出来，不混在正文里。
    // 正文是 agent 写的（可能源自被注入的页面），这几样是扩展自己看到的事实。
    if (msg.facts) {
      const box = document.createElement('div');
      box.className = 'what';
      for (const [k, v] of msg.facts) {
        if (!v) continue;
        const line = document.createElement('div');
        const key = document.createElement('span');
        key.textContent = `${k}：`;
        const val = document.createElement('span');
        val.textContent = v;
        if (k === '金额') val.className = 'amount';
        line.append(key, val);
        box.appendChild(line);
      }
      askEl.querySelector('.body').appendChild(box);
    }

    let noteEl = null;
    if (msg.wantNote) {
      noteEl = document.createElement('textarea');
      noteEl.className = 'note';
      noteEl.placeholder = '（可选）想对 agent 说的话';
      askEl.querySelector('.body').appendChild(noteEl);
    }

    askEl.querySelector('.ok').addEventListener('click', () => closeAsk('continued', noteEl?.value));
    askEl.querySelector('.no').addEventListener('click', () => closeAsk('cancelled', noteEl?.value));

    // 挂在 overlayHost 顶部置顶居中展示
    overlayHost.appendChild(askEl);

    // 倒计时。不显示的话用户不知道自己还有多久，而超时后 agent 那边已经走了，
    // 他还在慢慢操作——两边对不上。
    const deadline = Date.now() + (msg.timeout || 300000);
    const clock = askEl.querySelector('.clock');
    askTimer = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) closeAsk('timed_out', noteEl?.value);
    }, 500);
  }

  // ---------- borrow：借用确认 ----------
  let borrowEl = null;
  let borrowOutcome = null;

  function closeBorrow(result) {
    if (borrowEl) { borrowEl.remove(); borrowEl = null; }
    borrowOutcome = { outcome: result };
    maybeTeardown();
  }

  function showBorrow(msg) {
    ensureHost();
    if (borrowEl) closeBorrow('cancelled');
    borrowOutcome = null;

    borrowEl = document.createElement('div');
    borrowEl.className = 'borrow-overlay';
    borrowEl.setAttribute('role', 'dialog');
    borrowEl.setAttribute('aria-live', 'polite');

    const head = document.createElement('div'); head.className = 'head';
    const dot = document.createElement('span'); dot.className = 'dot';
    const t = document.createElement('span'); t.className = 't';
    t.textContent = '🤖 AI Agent 申请临时借用此标签页';
    head.append(dot, t);

    const body = document.createElement('div'); body.className = 'body';
    body.textContent = msg.reason || 'Agent 请求临时借用此标签页执行自动化任务。借用期间将在后台操作，任务完成后自动归还。';

    const foot = document.createElement('div'); foot.className = 'foot';
    const btnNo = document.createElement('button'); btnNo.className = 'no'; btnNo.textContent = '拒绝';
    const btnOk = document.createElement('button'); btnOk.className = 'ok'; btnOk.textContent = '同意借用';
    foot.append(btnNo, btnOk);

    borrowEl.append(head, body, foot);
    btnOk.addEventListener('click', () => closeBorrow('borrowed'));
    btnNo.addEventListener('click', () => closeBorrow('denied'));

    overlayHost.appendChild(borrowEl);
  }

  function showToast(message) {
    ensureHost();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    overlayHost.appendChild(t);
    setTimeout(() => { t.remove(); maybeTeardown(); }, 3000);
  }

  // 高亮：把用户的视线直接送到该操作的地方，省掉「在哪儿？」这一步。
  // 描边画在覆盖层上而不是改元素自己的 style——后者会污染页面，
  // 而且遇到 overflow:hidden 的容器会被裁掉。
  function flashTargets(els) {
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const ring = document.createElement('div');
      ring.style.cssText = `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;`
        + `width:${r.width + 8}px;height:${r.height + 8}px;border:2px solid #f97316;`
        + `border-radius:8px;pointer-events:none;z-index:2147483646;`
        + `box-shadow:0 0 0 9999px rgba(0,0,0,.04);transition:opacity .3s`;
      document.documentElement.appendChild(ring);
      let n = 0;
      const blink = setInterval(() => {
        ring.style.opacity = (++n % 2) ? '0.25' : '1';
        if (n > 7) { clearInterval(blink); ring.remove(); }
      }, 300);
    }
  }

  // ---------- 幕帘 ----------
  //
  // 光标、边框、驾驶舱、ask 全会被 agent 自己的 screenshot 拍进去——它会看到
  // 一个页面上并不存在的发光箭头，把它当页面元素去理解甚至去点。所以 background
  // 在截图前拉幕帘、拍完放下。样式改动在 sendMessage 的应答路径里同步生效，
  // ack 返回时 visibility 已应用；两条截图路径都是 ack 之后才合成新帧。

  let stealthed = false;
  function setStealth(on) {
    stealthed = !!on;
    if (host) host.style.visibility = stealthed ? 'hidden' : '';
  }

  // ---------- 消息 ----------

  // agent 刚刚做了什么。驾驶舱打出动作名（记完在下一次 render 里出现），
  // 5 秒后自动淡出回短码。
  function recordAct(sid, text) {
    const prev = actState.get(sid);
    if (prev) clearTimeout(prev.timer);
    actState.set(sid, {
      text: String(text).slice(0, 40),
      timer: setTimeout(() => { actState.delete(sid); if (owners.length) render(); }, 5000),
    });
  }

  // 边框亮一下——常驻的淡边框回答「有没有主」，这一下回答「它此刻在动」。
  // 两个问题都要有答案，否则用户看着一个静止的页面无从判断。
  function flashEdges() {
    if (!wrap) return;
    wrap.classList.add('lit');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => wrap?.classList.remove('lit'), 420);
  }
  // 消息入口：同时应答 __ab* 与 __hc* 协议动词，确保本扩展与姊妹扩展 huashu-chrome 调用方无缝互通
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    const markVerb = msg?.__abMark ?? msg?.__hcMark;
    if (markVerb !== undefined) {
      if (markVerb === 'ping') { sendResponse({ pong: true, top: TOP }); return true; }
      if (markVerb === 'set') {
        logs = msg.logs || {};
        intents = msg.intents || {};
        stats = msg.stats || {};
        plan = Array.isArray(msg.plan) ? msg.plan : [];
        tabLabel = typeof msg.tabLabel === 'string' ? msg.tabLabel : '';
        owners = Array.isArray(msg.owners) ? msg.owners.filter((o) => o && o.sid) : [];
        if (msg.act && msg.sid) recordAct(msg.sid, msg.act);
        if (TOP) { render(); if (msg.act) flashEdges(); }
        sendResponse({ ok: true });
        return true;
      }
      if (markVerb === 'clear' || msg.__hcMark === 'clear') { owners = []; lastOwners = []; plan = []; render(); sendResponse({ ok: true }); return true; }
      if (markVerb === 'stealth' || msg.__hcMark === 'stealth') { setStealth(msg.on); sendResponse({ ok: true }); return true; }
    }
    const askVerb = msg?.__abAsk ?? msg?.__hcAsk;
    if (askVerb !== undefined) {
      if (askVerb === 'show' || msg.__hcAsk === 'show') { showAsk(msg); sendResponse({ shown: true }); return true; }
      if (askVerb === 'poll' || msg.__hcAsk === 'poll') { sendResponse(askOutcome || { pending: true }); return true; }
      if (askVerb === 'borrow') { showBorrow(msg); sendResponse({ shown: true }); return true; }
      if (askVerb === 'pollBorrow') { sendResponse(borrowOutcome || { pending: true }); return true; }
      if (askVerb === 'toast') { showToast(msg.message || ''); sendResponse({ ok: true }); return true; }
      if (askVerb === 'flash' || msg.__hcAsk === 'flash') {
        const els = (msg.selectors || []).map((s) => {
          try { return document.querySelector(s); } catch { return null; }
        }).filter(Boolean);
        if (els[0]) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
        flashTargets(els);
        sendResponse({ matched: els.length });
        return true;
      }
      if (askVerb === 'abort' || msg.__hcAsk === 'abort') { closeAsk('cancelled', '被 agent 取消'); sendResponse({ ok: true }); return true; }
    }
  });

  // 展开/收起偏好跨页面记住。读取是异步的：先按收起画，偏好到了再重画一次，
  // 这个闪动只在「上一次是展开着的」且首条消息先到时可见，几乎察觉不到。
  try {
    chrome.storage.local.get('dockOpen').then((v) => {
      if (v?.dockOpen && !expanded) { expanded = true; if (owners.length) render(); }
    }).catch(() => {});
  } catch { /* context 正在失效 */ }
})();
