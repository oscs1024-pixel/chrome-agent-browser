// 网络记录 hook —— 注入到页面的 MAIN world，document_start 执行。
//
// 必须赶在页面自己的 JS 之前跑，否则首屏那批 XHR 全漏掉，
// 而恰恰是首屏那批带着列表数据。
//
// 只往 window.__abNet 里堆记录，不上报、不外发。读取由扩展按需拉。
(() => {
  try {
    Object.defineProperty(window, '__abNet', {
      value: [],
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } catch {
    window.__abNet = [];
  }

  const MAX_ENTRIES = 300;
  const MAX_BODY = 400000;

  const push = (r) => {
    const arr = window.__abNet;
    if (!Array.isArray(arr)) return;
    arr.push(r);
    if (arr.length > MAX_ENTRIES) arr.shift();
  };

  // 防反爬探测：覆盖 toString 伪装成原生函数 [native code]
  const nativeMap = new WeakMap();
  const origToString = Function.prototype.toString;
  try {
    Function.prototype.toString = function () {
      if (nativeMap.has(this)) return nativeMap.get(this);
      return origToString.call(this);
    };
    nativeMap.set(Function.prototype.toString, 'function toString() { [native code] }');
  } catch {}

  const protect = (fn, name) => {
    try { nativeMap.set(fn, `function ${name}() { [native code] }`); } catch {}
    return fn;
  };

  const origFetch = window.fetch;
  if (origFetch) {
    const wrappedFetch = async function (...a) {
      const res = await origFetch.apply(this, a);
      (async () => {
        try {
          const url = typeof a[0] === 'string' ? a[0] : (a[0]?.url || String(a[0] || ''));
          const method = a[1]?.method || a[0]?.method || 'GET';
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('event-stream')) {
            push({ t: Date.now(), method, url, status: res.status, ct, body: '<stream>' });
            return;
          }
          const body = /json|text|javascript/.test(ct) ? (await res.clone().text()).slice(0, MAX_BODY) : '';
          push({ t: Date.now(), method, url, status: res.status, ct, body });
        } catch {}
      })();
      return res;
    };
    window.fetch = protect(wrappedFetch, 'fetch');
  }

  const xhrMeta = new WeakMap();
  const oOpen = XMLHttpRequest.prototype.open;
  const oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = protect(function (m, u, ...rest) {
    xhrMeta.set(this, { method: m, url: String(u) });
    return oOpen.call(this, m, u, ...rest);
  }, 'open');
  XMLHttpRequest.prototype.send = protect(function (...a) {
    this.addEventListener('load', () => {
      try {
        const meta = xhrMeta.get(this);
        if (!meta) return;
        let body = '';
        const rt = this.responseType;
        if (!rt || rt === 'text') {
          body = String(this.responseText || '');
        } else if (rt === 'json' && this.response != null) {
          body = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
        }
        push({
          t: Date.now(),
          ...meta,
          status: this.status,
          ct: this.getResponseHeader('content-type') || '',
          body: body.slice(0, MAX_BODY),
        });
      } catch {}
    });
    return oSend.apply(this, a);
  }, 'send');
})();
