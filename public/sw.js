/*
 * Undead of Night: Last Round, service worker. Plain JavaScript on purpose: it is copied as is, and the build stamps two lines.
 *
 * - The app shell is precached, so solo play opens offline.
 * - A page navigation asks the network first and falls back to the cached page.
 * - Hashed build assets are cache first.
 * - Music is never precached: a track is kept the first time it plays, up to MUSIC_LIMIT tracks.
 *   A kept track is keyed by the build's hash of its file, so a replaced file is fetched again and an unchanged one is not.
 * - Only a URL without a query is kept in the shell cache, so changing queries never pile up copies.
 * - Only same-origin GET requests are touched. Analytics and co-op traffic go straight through.
 * - A new version waits until the page sends SKIP_WAITING, so a run is never reloaded under the player.
 */
const BUILD_ID = 'dev';
const SHELL_FILES = [];
const MUSIC_VERSIONS = {};

const SHELL_CACHE = 'uon-shell-' + BUILD_ID;
const MUSIC_CACHE = 'uon-music-v1';
const MUSIC_LIMIT = 12;
const NETWORK_WAIT_MS = 4000;

const SCOPE_PATH = new URL('./', self.location.href).pathname;
const ASSETS_PATH = SCOPE_PATH + 'assets/';
const MUSIC_PATH = SCOPE_PATH + 'music/';
const startingMusic = new Set();
// Music fetches that may still be streaming, so an update can let go of them (see the message handler).
const streamingMusic = new Set();
let keepingMusic = Promise.resolve();

// A worker's listeners live as long as the worker. The signal says so, and lets a test end them.
const workerLife = new AbortController();

function on(type, handler) {
  self.addEventListener(type, handler, { signal: workerLife.signal });
}

function scopedUrl(file) {
  return new URL(file, self.location.href).href;
}

on('install', (event) => {
  event.waitUntil(precacheShell());
});

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const urls = ['./', ...SHELL_FILES].map(scopedUrl);
  // Fresh from the network, so a shell never mixes files of two builds.
  await Promise.all(urls.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
}

on('activate', (event) => {
  event.waitUntil(removeOldCaches().then(() => self.clients.claim()));
});

async function removeOldCaches() {
  const keep = new Set([SHELL_CACHE, MUSIC_CACHE]);
  const names = await caches.keys();
  await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
  await removeStaleTracks();
}

/** Drops a kept track whose file this build replaced or removed. Nothing is dropped when the build listed no music. */
async function removeStaleTracks() {
  const listed = Object.keys(MUSIC_VERSIONS).length > 0;
  if (!listed) return;
  const cache = await caches.open(MUSIC_CACHE);
  const kept = await cache.keys();
  const stale = kept.filter((entry) => {
    const url = new URL(entry.url);
    const known = url.pathname.slice(SCOPE_PATH.length) in MUSIC_VERSIONS;
    return !known || entry.url !== musicKeyOf(url);
  });
  await Promise.all(stale.map((entry) => cache.delete(entry)));
}

on('message', (event) => {
  const data = event.data;
  const type = data && data.type;
  const releasing = type === 'RELEASE_MUSIC';
  const skipping = type === 'SKIP_WAITING';
  if (releasing) releaseMusic();
  if (skipping) self.skipWaiting();
});

/**
 * The page sends this to the worker in charge just before a new one takes over, and reloads once it has.
 * A track still streaming from the network is not needed then, and a paused stream would otherwise hold
 * this worker open, so the new one would wait for it for minutes.
 */
function releaseMusic() {
  for (const controller of streamingMusic) controller.abort();
  streamingMusic.clear();
}

on('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const ours = request.method === 'GET' && url.origin === self.location.origin;
  if (!ours) return;
  event.respondWith(responseFor(request, url, event));
});

/** Music streams from its own cache, built assets come cache first, and everything else tries the network. */
function responseFor(request, url, event) {
  if (url.pathname.startsWith(MUSIC_PATH)) return serveMusic(request, event);
  if (url.pathname.startsWith(ASSETS_PATH)) return cacheFirst(request);
  return networkFirst(request, request.mode === 'navigate');
}

/** A URL with a query is not kept: the same file under ever-changing queries would fill the cache. */
function hasNoQuery(request) {
  return new URL(request.url).search === '';
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: SHELL_CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  const worthKeeping = response.ok && hasNoQuery(request);
  if (worthKeeping) await keepCopy(request, response.clone());
  return response;
}

async function keepCopy(request, response) {
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(request, response);
}

function fetchWithin(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('slow network')), ms);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function networkFirst(request, isPage) {
  try {
    const response = await fetchWithin(request, NETWORK_WAIT_MS);
    // Every page is the same page, so an invite link's query never fills the cache with copies.
    const copyKey = isPage ? scopedUrl('./') : request;
    const worthKeeping = response.ok && (isPage || hasNoQuery(request));
    if (worthKeeping) await keepCopy(copyKey, response.clone());
    return response;
  } catch (error) {
    // An invite link carries a query, and the cached page is the same page.
    const cached = await caches.match(request, { cacheName: SHELL_CACHE, ignoreSearch: true });
    if (cached) return cached;
    const page = isPage ? await caches.match(scopedUrl('./'), { cacheName: SHELL_CACHE }) : undefined;
    if (page) return page;
    throw error;
  }
}

/** A range of a cached track, or the whole track when none is asked for. */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match) return null;
  const [, from, to] = match;
  const isNoRange = from === '' && to === '';
  if (isNoRange) return null;
  const isSuffixRange = from === '';
  if (isSuffixRange) {
    const length = Math.min(Number(to), size);
    return { start: size - length, end: size - 1 };
  }
  const start = Number(from);
  const end = to === '' ? size - 1 : Math.min(Number(to), size - 1);
  return { start, end };
}

async function sliceOf(cached, header) {
  const requested = header && header.startsWith('bytes=');
  if (!requested) return cached;
  // Several ranges at once is rare, and the whole file answers it. This must come before the body is read.
  const multiple = header.includes(',');
  if (multiple) return cached;
  const body = await cached.blob();
  const size = body.size;
  const range = parseRange(header, size);
  const unsatisfiable = !range || range.start >= size || range.start > range.end;
  if (unsatisfiable) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  const part = body.slice(range.start, range.end + 1);
  return new Response(part, {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': String(part.size),
      'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + size,
      'Accept-Ranges': 'bytes',
    },
  });
}

/** Where a track is kept: its URL, plus the hash of its file as this build lists it. */
function musicKeyOf(url) {
  const version = MUSIC_VERSIONS[url.pathname.slice(SCOPE_PATH.length)];
  return version ? url.origin + url.pathname + '?v=' + version : url.href;
}

function fetchMusic(request) {
  const controller = new AbortController();
  streamingMusic.add(controller);
  return fetch(request, { signal: controller.signal });
}

async function serveMusic(request, event) {
  const cache = await caches.open(MUSIC_CACHE);
  const key = musicKeyOf(new URL(request.url));
  const cached = await cache.match(key);
  if (cached) return sliceOf(cached, request.headers.get('range'));
  // Offline with nothing kept rejects here, and the game plays on without that track.
  const response = await fetchMusic(request);
  const worthKeeping = response.ok && !startingMusic.has(key);
  if (worthKeeping) {
    startingMusic.add(key);
    event.waitUntil(keepTrack(key, request.url, response.clone()).finally(() => startingMusic.delete(key)));
  }
  return response;
}

/** A 206 that starts at 0 and reaches the last byte is the whole file. */
function wholeFileOf(response) {
  const isWholeResponse = response.status === 200;
  if (isWholeResponse) return response;
  const spans = /^bytes 0-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
  const whole = spans && Number(spans[1]) + 1 === Number(spans[2]);
  if (!whole) return null;
  const headers = new Headers(response.headers);
  headers.delete('Content-Range');
  return new Response(response.body, { status: 200, headers });
}

/** One track is stored at a time, so tracks that first play together cannot each see room and overshoot the limit. */
function keepTrack(key, url, response) {
  const turn = keepingMusic.then(() => storeTrack(key, url, response));
  keepingMusic = turn;
  return turn;
}

async function storeTrack(key, url, response) {
  try {
    // A file this build replaced must not come from the browser's own cache.
    const whole = wholeFileOf(response) || (await fetchMusic(new Request(url, { cache: 'no-cache' })));
    const complete = whole.ok && whole.status === 200;
    if (!complete) return;
    const cache = await caches.open(MUSIC_CACHE);
    const kept = await cache.keys();
    // Oldest first, so the newest tracks stay.
    for (const old of kept.slice(0, Math.max(0, kept.length - MUSIC_LIMIT + 1))) await cache.delete(old);
    await cache.put(key, whole);
  } catch (error) {
    // chemx-allow: best-effort a failed copy only means the track streams again next time
  }
}
