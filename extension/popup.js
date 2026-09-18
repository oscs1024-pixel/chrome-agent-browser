const conn = document.getElementById('conn');
const state = document.getElementById('state');
const btn = document.getElementById('btn');
const conntip = document.getElementById('conntip');
const tabstatus = document.getElementById('tabstatus');
const tabstatusdot = document.getElementById('tabstatusdot');
const tabstatustext = document.getElementById('tabstatustext');
const copydoctor = document.getElementById('copydoctor');
const copyaudit = document.getElementById('copyaudit');

// 版本号：用户自查「扩展和 CLI 是不是同一版」的唯一入口。
document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;

function render(connected, r = {}) {
  conn.dataset.connected = String(connected);
  state.textContent = connected ? 'Chrome 已就绪' : '等待本地桥接';
  btn.hidden = connected;
  btn.disabled = false;
  btn.textContent = '重新连接';

  const age = r.lastRx ? Math.round((Date.now() - r.lastRx) / 1000) : null;
  const bits = [];
  if (r.bridge) {
    const mismatch = r.bridge !== chrome.runtime.getManifest().version;
    bits.push(mismatch ? `桥 v${r.bridge} · 版本不一致，请重载扩展` : `本地桥 v${r.bridge}`);
  }
  if (age !== null) bits.push(`心跳 ${age} 秒前`);
  if (!connected && r.offscreenError) bits.push(`后台连接失败：${r.offscreenError}`);
  if (!connected && age === null) bits.push('首次使用时，由 Agent 调用自动启动本地桥');
  conntip.textContent = bits.join(' · ');
  conntip.hidden = !bits.length;
}

chrome.runtime.sendMessage({ __abPopup: 'status' }, (r) => render(!!r?.connected, r || {}));

btn.onclick = () => {
  btn.hidden = false;
  btn.disabled = true;
  btn.textContent = '连接中…';
  chrome.runtime.sendMessage({ __abPopup: 'connect' }, (r) => render(!!r?.connected, r || {}));
};

// ---------- 当前激活标签页感知 ----------

function updateActiveTabSense(rows = []) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const cur = tabs && tabs[0];
    if (!cur) return;
    const hit = rows.find((r) => r.tabId === cur.id);
    if (hit) {
      tabstatus.dataset.controlled = 'true';
      tabstatusdot.className = `status-badge-dot on ${hit.shape === 'square' ? 'square' : 'circle'}`;
      tabstatusdot.style.background = hit.color || '#2563eb';
      tabstatustext.textContent = `当前页正被 ${hit.label || 'Agent'} 操控 (${hit.code || ''})`;
    } else {
      tabstatus.dataset.controlled = 'false';
      tabstatusdot.className = 'status-badge-dot safe';
      tabstatusdot.style.background = '';
      tabstatustext.textContent = '当前标签页未受控 · 处于安全浏览状态';
    }
  });
}

// ---------- 高保真模式 ----------

const l2dot = document.getElementById('l2dot');
const l2state = document.getElementById('l2state');
const l2btn = document.getElementById('l2btn');

function renderL2(on) {
  l2dot.classList.toggle('on', on);
  l2state.textContent = `原生事件通道 · ${on ? '已开启' : '已关闭'}`;
  l2btn.classList.toggle('on', on);
  l2btn.setAttribute('aria-checked', String(on));
  l2btn.setAttribute('aria-label', `${on ? '关闭' : '开启'}原生事件通道`);
  l2btn.title = on ? '关闭原生事件通道' : '开启原生事件通道';
}

chrome.storage.local.get('l2Disabled', ({ l2Disabled }) => renderL2(!l2Disabled));

// ---------- 控制标记 ----------

const markdot = document.getElementById('markdot');
const markstate = document.getElementById('markstate');
const markbtn = document.getElementById('markbtn');
const sess = document.getElementById('sess');
const sessioncount = document.getElementById('sessioncount');

function renderMark(on) {
  markdot.classList.toggle('on', on);
  markstate.textContent = `页面状态标识 · ${on ? '已开启' : '已关闭'}`;
  markbtn.classList.toggle('on', on);
  markbtn.setAttribute('aria-checked', String(on));
  markbtn.setAttribute('aria-label', `${on ? '关闭' : '开启'}页面状态标识`);
  markbtn.title = on ? '关闭页面状态标识' : '开启页面状态标识';
}

function renderSessions(rows) {
  sess.textContent = '';
  sessioncount.textContent = `${rows.length} 个`;
  updateActiveTabSense(rows);

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '暂无活动会话 · Agent 发起自动化时将自动接管';
    sess.appendChild(empty);
    return;
  }

  for (const r of rows) {
    const line = document.createElement('div');
    line.className = 's';
    line.title = r.title || '尚未认领页面';

    const sw = document.createElement('span');
    sw.className = `swatch ${r.shape === 'square' ? 'square' : 'circle'}`;
    sw.style.setProperty('--session', r.color);

    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = r.label;

    const code = document.createElement('span');
    code.className = 'code';
    code.textContent = r.code || '';

    const page = document.createElement('span');
    page.className = 'page';
    page.textContent = r.title || '尚未认领页面';

    line.append(sw, who, code, page);
    sess.appendChild(line);
  }
}

function refreshMark() {
  chrome.runtime.sendMessage({ __abPopup: 'sessions' }, (r) => {
    renderMark(r?.enabled !== false);
    renderSessions(r?.sessions || []);
  });
  refreshAudit();
}
refreshMark();

// ---------- 近期审计轨迹 ----------

const auditlist = document.getElementById('auditlist');
const auditcount = document.getElementById('auditcount');

function relTime(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 5) return '刚刚';
  if (s < 60) return `${s}秒前`;
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  return `${Math.floor(s / 3600)}时前`;
}

function renderAudit(entries = []) {
  if (!auditlist) return;
  auditlist.textContent = '';
  if (auditcount) auditcount.textContent = entries.length ? `${entries.length} 条` : '暂无记录';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '暂无操作记录 · Agent 执行操作后将在此展示真实轨迹';
    auditlist.appendChild(empty);
    return;
  }
  for (const it of entries) {
    const item = document.createElement('div');
    item.className = 'audit-item';
    item.title = `${it.who || 'Agent'} ${it.summary || it.text || ''}${typeof it.ms === 'number' ? ` (${it.ms}ms)` : ''}`;

    const dot = document.createElement('span');
    dot.className = `audit-dot ${it.shape === 'square' ? 'square' : 'circle'}${it.ok === false ? ' fail' : ''}`;
    dot.style.setProperty('--session', it.color || '#2563eb');

    const who = document.createElement('span');
    who.className = 'audit-who';
    who.textContent = it.who || 'Agent';

    const sum = document.createElement('span');
    sum.className = 'audit-summary';
    sum.textContent = it.summary || it.text || '';

    const time = document.createElement('span');
    time.className = 'audit-time';
    const dur = typeof it.ms === 'number' ? ` (${it.ms >= 1000 ? (it.ms / 1000).toFixed(1) + 's' : it.ms + 'ms'})` : '';
    time.textContent = relTime(it.t) + dur;

    item.append(dot, who, sum, time);
    auditlist.appendChild(item);
  }
}

function refreshAudit() {
  chrome.runtime.sendMessage({ __abPopup: 'audit' }, (r) => {
    renderAudit(r?.entries || []);
  });
}

markbtn.onclick = () => {
  chrome.storage.local.get('markDisabled', ({ markDisabled }) => {
    chrome.storage.local.set({ markDisabled: !markDisabled }, () => {
      chrome.runtime.sendMessage({ __abPopup: 'markSync' }, () => refreshMark());
    });
  });
};

l2btn.onclick = () => {
  chrome.storage.local.get('l2Disabled', ({ l2Disabled }) => {
    const turningOff = !l2Disabled;
    if (turningOff) {
      chrome.runtime.sendMessage({ __abPopup: 'detachAll' }, () => {
        chrome.storage.local.set({ l2Disabled: true }, () => renderL2(false));
      });
    } else {
      chrome.storage.local.set({ l2Disabled: false }, () => renderL2(true));
    }
  });
};

// ---------- 底部快速操作闭环 ----------

function wireCopyBtn(el, cmd, label) {
  if (!el) return;
  el.onclick = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      const span = el.querySelector('span') || el;
      const prev = span.textContent;
      span.textContent = '✓ 已复制!';
      span.style.color = 'var(--green)';
      setTimeout(() => {
        span.textContent = prev;
        span.style.color = '';
      }, 1500);
    } catch {
      alert(`请手动运行命令：${cmd}`);
    }
  };
}

wireCopyBtn(copydoctor, 'chrome-agent-browser doctor', '复制体检命令');
wireCopyBtn(copyaudit, 'chrome-agent-browser audit', '复制审计命令');
