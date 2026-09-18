// 网络记录 hook —— 注入到页面的 MAIN world，document_start 执行。
//
// 必须赶在页面自己的 JS 之前跑，否则首屏那批 XHR 全漏掉，
// 而恰恰是首屏那批带着列表数据。
//
// 只往 window.__abNet 里堆记录，不上报、不外发。读取由扩展按需拉。
(() => {
  if (window.__abNet) return;
  window.__abNet = [];

  const MAX_ENTRIES = 300;
  const MAX_BODY = 400000;

  const push = (r) => {
    window.__abNet.push(r);
    if (window.__abNet.length > MAX_ENTRIES) window.__abNet.shift();
  };

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = async function (...a) {
      const res = await origFetch.apply(this, a);
      // 网络审计走非阻塞旁路，绝不 await 阻塞页面自身对 Response 的流式消费
      (async () => {
        try {
          const url = typeof a[0] === 'string' ? a[0] : (a[0]?.url || String(a[0] || ''));
          const method = a[1]?.method || a[0]?.method || 'GET';
          const ct = res.headers.get('content-type') || '';
          // 显式跳过流式 SSE 长连接，这类连接的 clone().text() 会一直挂起直到流结束
          if (ct.includes('event-stream')) {
            push({ t: Date.now(), method, url, status: res.status, ct, body: '<stream>' });
            return;
          }
          const body = /json|text|javascript/.test(ct) ? (await res.clone().text()).slice(0, MAX_BODY) : '';
          push({ t: Date.now(), method, url, status: res.status, ct, body });
        } catch { /* 记录失败绝不能影响页面本身 */ }
      })();
      return res;
    };
  }

  const oOpen = XMLHttpRequest.prototype.open;
  const oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...rest) {
    this.__ab = { method: m, url: String(u) };
    return oOpen.call(this, m, u, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener('load', () => {
      try {
        let body = '';
        const rt = this.responseType;
        if (!rt || rt === 'text') {
          body = String(this.responseText || '');
        } else if (rt === 'json' && this.response != null) {
          body = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
        }
        push({
          t: Date.now(),
          ...this.__ab,
          status: this.status,
          ct: this.getResponseHeader('content-type') || '',
          body: body.slice(0, MAX_BODY),
        });
      } catch {}
    });
    return oSend.apply(this, a);
  };
})();
