/* AI 面师 Service Worker —— 可安装 + 离线兜底（落地页）
 * 范围：/interview/。策略保守：只缓存静态资源与首页壳；API 全部网络直连，绝不缓存用户数据。 */
const VERSION = "aimianshi-v1";
const BASE = "/interview";
const CORE_CACHE = `${VERSION}-core`;
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CORE_CACHE)
      .then((cache) =>
        cache.addAll([
          `${BASE}/`, // 营销/落地页壳，作为离线兜底
          `${BASE}/manifest.webmanifest`,
          `${BASE}/icon-192.png`,
          `${BASE}/icon-512.png`,
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(req) {
  return new URL(req.url).origin === self.location.origin;
}

// 应用静态资源：/_next/static/ 与 public 图片/svg/字体等，内容带 hash 或稳定，cache-first
function isAppStatic(url) {
  return (
    url.pathname.startsWith(`${BASE}/_next/static/`) ||
    url.pathname.startsWith(`${BASE}/icon-`) ||
    url.pathname === `${BASE}/logo.svg` ||
    url.pathname.startsWith(`${BASE}/weapp-logo`)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只处理同源 GET；其余（API、跨域、非 GET）直接放行
  if (req.method !== "GET" || !isSameOrigin(req) || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.startsWith(`${BASE}/api/`)) return; // 接口绝不进缓存

  // 导航请求：network-first，失败回落到缓存的落地页（离线兜底）
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // 只缓存成功且同源的真实页面，避免把 302 登录跳转写进缓存
          if (res.ok) {
            const copy = res.clone();
            caches.open(CORE_CACHE).then((cache) => cache.put(`${BASE}/`, copy));
          }
          return res;
        })
        .catch(() => caches.match(`${BASE}/`).then((r) => r || caches.match(`${BASE}`)))
    );
    return;
  }

  // 静态资源：cache-first + 回源填充
  if (isAppStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // 其余 GET（普通页面子资源等）：网络优先，失败回退缓存
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || caches.match(`${BASE}/`)))
  );
});
