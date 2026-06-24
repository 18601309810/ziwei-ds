/* ===================================================================
 * 紫微 DS · 埋点上报 SDK (tracker.js)
 * 平台无关的埋点层：内置事件队列 / 公共参数 / sendBeacon 兜底 / 隐私脱敏
 * 第三方分析平台通过 CONFIG.provider 切换，默认 GA4。
 * 接入：在 CONFIG 填入自己的 ID 即可上线；切换方案 B 只需改 provider。
 * 暴露全局：window.ZT.track(name, props)
 * =================================================================== */
(function () {
  'use strict';

  // ============ 配置区（接入时只改这里） ============
  var CONFIG = {
    // 'ga4'    : Google Analytics 4（填 measurementId，形如 G-XXXXXXX）
    // 'umami'  : Umami（填 umami.scriptUrl + websiteId）
    // 'custom' : 自有后端 / Serverless（填 endpoint，方案 B 用）
    // 'none'   : 关闭上报（仅本地 DEBUG 打印）
    provider: 'umami',

    ga4: {
      measurementId: '',          // ← 填你的 GA4 衡量 ID，例如 'G-ABC123XYZ'
    },
    umami: {
      scriptUrl: 'https://cloud.umami.is/script.js',  // 官方云默认地址；自托管则改为你的域名
      websiteId: 'b7ecfaac-607b-4a0c-8cce-e7b1ac780ffd',  // Umami Website ID
    },
    custom: {
      endpoint: '',               // 方案 B 的上报接口，例如 'https://xxx/api/collect'
    },

    debug: false,                 // 控制台打印每条事件，便于本地验证；上线可设 false
    sampleRate: 1.0,              // 采样率 0~1，流量大时可降采样
    batchSize: 10,                // 攒批阈值：满 N 条 flush（custom 用）
    flushIntervalMs: 5000,        // 定时 flush 间隔（custom 用）
    sessionTtlMs: 30 * 60 * 1000, // 会话过期：30 分钟无活动重开会话
  };

  // ============ 工具 ============
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function now() { return Date.now(); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  // ============ 身份：匿名设备ID + 会话ID ============
  function clientId() {
    var id = lsGet('zt_cid');
    if (!id) { id = uuid(); lsSet('zt_cid', id); }
    return id;
  }
  function sessionId() {
    var id = ssGet('zt_sid');
    var last = parseInt(ssGet('zt_sid_ts') || '0', 10);
    var fresh = id && (now() - last) < CONFIG.sessionTtlMs;
    if (!fresh) { id = uuid(); ssSet('zt_sid', id); _newSession = true; }
    ssSet('zt_sid_ts', String(now()));
    return id;
  }
  var _newSession = false;

  // ============ 公共参数 ============
  function commonParams() {
    return {
      session_id: sessionId(),
      client_id: clientId(),
      page_path: location.pathname + location.search,
      referrer: document.referrer || '',
      ua: navigator.userAgent,
      screen: (window.screen ? screen.width + 'x' + screen.height : ''),
      lang: navigator.language || '',
    };
  }

  // ============ 各平台适配器 ============
  var adapters = {
    ga4: {
      ready: false,
      init: function () {
        var id = CONFIG.ga4.measurementId;
        if (!id) return; // 未配置则不加载，事件仅进 DEBUG
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', id, { send_page_view: false });
        this.ready = true;
      },
      send: function (evt) {
        if (!this.ready || !window.gtag) return;
        // GA4 事件参数需为标量；对象/数组转为短字符串（<=100 字符）
        var flat = {};
        Object.keys(evt).forEach(function (k) {
          if (k === 'event_name') return;
          var v = evt[k];
          if (v === null || v === undefined) return;
          if (typeof v === 'object') v = JSON.stringify(v);
          if (typeof v === 'string' && v.length > 100) v = v.slice(0, 100);
          flat[k] = v;
        });
        window.gtag('event', evt.event_name, flat);
      },
    },
    umami: {
      ready: false,
      _pending: [],      // umami 脚本就绪前暂存的事件
      _polling: false,
      init: function () {
        var c = CONFIG.umami;
        if (!c.scriptUrl || !c.websiteId) return;
        var s = document.createElement('script');
        s.async = true; s.defer = true;
        s.src = c.scriptUrl;
        s.setAttribute('data-website-id', c.websiteId);
        document.head.appendChild(s);
        this.ready = true;
        this._poll();   // 启动就绪轮询，准备补发暂存事件
      },
      _isUp: function () {
        return window.umami && typeof window.umami.track === 'function';
      },
      _drain: function () {
        var p = this._pending; this._pending = [];
        for (var i = 0; i < p.length; i++) {
          try { window.umami.track(p[i].event_name, p[i]); } catch (e) {}
        }
      },
      _poll: function () {
        var self = this;
        if (self._polling) return;
        self._polling = true;
        var tries = 0;
        var timer = setInterval(function () {
          tries++;
          if (self._isUp()) { clearInterval(timer); self._polling = false; self._drain(); }
          else if (tries > 100) { clearInterval(timer); self._polling = false; } // 最长约 20s 放弃
        }, 200);
      },
      send: function (evt) {
        if (this._isUp()) {
          try { window.umami.track(evt.event_name, evt); } catch (e) {}
        } else {
          this._pending.push(evt);   // 未就绪：先暂存，就绪后补发
          this._poll();
        }
      },
    },
    custom: {
      init: function () {},
      // 方案 B：攒批 POST；这里只实现入队，flush 在外层统一处理
      send: function () {},
    },
    none: { init: function () {}, send: function () {} },
  };

  // ============ 队列 + flush（custom 攒批 / sendBeacon 兜底） ============
  var queue = [];
  function flush(useBeacon) {
    if (CONFIG.provider !== 'custom') { queue.length = 0; return; }
    if (!queue.length) return;
    var ep = CONFIG.custom.endpoint;
    if (!ep) { queue.length = 0; return; }
    var batch = queue.splice(0, queue.length);
    var body = JSON.stringify({ events: batch });
    var ok = false;
    if (useBeacon && navigator.sendBeacon) {
      try { ok = navigator.sendBeacon(ep, new Blob([body], { type: 'application/json' })); } catch (e) {}
    }
    if (!ok) {
      try {
        fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
          .catch(function () { cacheFailed(batch); });
      } catch (e) { cacheFailed(batch); }
    }
  }
  function cacheFailed(batch) {
    try {
      var prev = JSON.parse(lsGet('zt_failed') || '[]');
      lsSet('zt_failed', JSON.stringify(prev.concat(batch).slice(-200)));
    } catch (e) {}
  }
  function retryFailed() {
    if (CONFIG.provider !== 'custom') return;
    var prev;
    try { prev = JSON.parse(lsGet('zt_failed') || '[]'); } catch (e) { prev = []; }
    if (!prev.length) return;
    lsSet('zt_failed', '[]');
    queue = queue.concat(prev);
    flush(false);
  }

  // ============ 核心 track ============
  function track(name, props) {
    if (Math.random() > CONFIG.sampleRate) return; // 采样
    var evt = Object.assign({
      event_id: uuid(),
      event_name: name,
      ts: now(),
    }, commonParams(), { props: props || {} });

    // GA4 / Umami：把 props 平铺进事件，便于平台直接看
    var flatEvt = Object.assign({}, evt);
    if (props) Object.keys(props).forEach(function (k) { flatEvt[k] = props[k]; });
    delete flatEvt.props;

    if (CONFIG.debug) {
      try { console.debug('[ZT]', name, props || {}); } catch (e) {}
    }

    var ad = adapters[CONFIG.provider] || adapters.none;
    if (CONFIG.provider === 'custom') {
      queue.push(evt);
      if (queue.length >= CONFIG.batchSize) flush(false);
    } else {
      ad.send(flatEvt);
    }
  }

  // ============ 自动事件：page_view / session_start / error ============
  function autoEvents() {
    // 先触发 sessionId 以判定是否新会话
    var sid = sessionId();
    if (_newSession) track('session_start', {});
    track('page_view', { title: document.title });
  }
  window.addEventListener('error', function (e) {
    track('error', {
      msg: (e && e.message) ? String(e.message).slice(0, 200) : 'unknown',
      stack_top: (e && e.error && e.error.stack) ? String(e.error.stack).split('\n')[0].slice(0, 200) : '',
      page_path: location.pathname,
    });
  });
  window.addEventListener('pagehide', function () { flush(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });

  // ============ 启动 ============
  (adapters[CONFIG.provider] || adapters.none).init();
  setInterval(function () { flush(false); }, CONFIG.flushIntervalMs);

  // 暴露 API
  window.ZT = {
    track: track,
    flush: function () { flush(false); },
    config: CONFIG,
    clientId: clientId,
    sessionId: sessionId,
    // 隐私脱敏小工具
    yearBucket: function (y) { y = parseInt(y, 10); return isNaN(y) ? '' : (Math.floor(y / 10) * 10) + 's'; },
  };

  // DOM 就绪后发自动事件
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoEvents);
  } else {
    autoEvents();
  }
  retryFailed();
})();
