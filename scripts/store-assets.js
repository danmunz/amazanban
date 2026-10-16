#!/usr/bin/env node
// Renders Chrome Web Store images with headless Chrome:
//   store/screenshots/*.png  1280x800, from the demo board (store/demo/)
//   store/promo/*.png        440x280 small tile, 1400x560 marquee
//
// Uses the Chrome DevTools Protocol directly (Node 22+ has a global WebSocket),
// so there is nothing to install. Set CHROME_PATH if Chrome isn't in the
// default macOS location.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const SCALE = 2; // render at 2x, then let Chrome downsample via clip scale

const demoUrl = pathToFileURL(path.join(root, "store/demo/index.html")).href;
const promoUrl = pathToFileURL(path.join(root, "store/promo/promo.html")).href;

// Runs inside the demo page before each screenshot.
const board = (body) => `(async () => {
  const sr = document.getElementById("amazanban-root").shadowRoot;
  const boardEl = sr.querySelector(".board");
  const search = sr.querySelector(".search");
  ${body}
  await new Promise((r) => setTimeout(r, 400));
})()`;

const SHOTS = [
  { file: "store/screenshots/1-board.png", url: demoUrl, w: 1280, h: 800, wait: board(`boardEl.scrollLeft = 0;`) },
  { file: "store/screenshots/2-delivered-and-returns.png", url: demoUrl, w: 1280, h: 800, wait: board(`boardEl.scrollLeft = boardEl.scrollWidth;`) },
  { file: "store/screenshots/3-dark-mode.png", url: demoUrl, w: 1280, h: 800, dark: true, wait: board(`boardEl.scrollLeft = 600;`) },
  {
    file: "store/screenshots/4-search.png",
    url: demoUrl,
    w: 1280,
    h: 800,
    wait: board(`search.value = "coffee"; search.dispatchEvent(new Event("input")); search.focus();`),
  },
  { file: "store/promo/small-440x280.png", url: `${promoUrl}?size=small`, w: 440, h: 280 },
  { file: "store/promo/marquee-1400x560.png", url: `${promoUrl}?size=marquee`, w: 1400, h: 560 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForChrome() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch (e) {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

async function openPage() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  const { webSocketDebuggerUrl } = await res.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((l) => l(msg));
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const once = (method) => new Promise((r) => listeners.push((m) => m.method === method && r(m)));
  return { send, once, close: () => ws.close() };
}

async function shoot(page, shot) {
  const { send, once } = page;
  await send("Emulation.setDeviceMetricsOverride", { width: shot.w, height: shot.h, deviceScaleFactor: SCALE, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: shot.dark ? "dark" : "light" }] });
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: shot.url });
  await loaded;
  await sleep(800); // board waits for "decryption", then renders; images decode
  if (shot.wait) await send("Runtime.evaluate", { expression: shot.wait, awaitPromise: true });
  await sleep(300);
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: shot.w, height: shot.h, scale: 1 / SCALE },
    captureBeyondViewport: false,
  });
  const out = path.join(root, shot.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`  ${shot.file}`);
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "amazanban-chrome-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { stdio: "ignore" }
  );
  try {
    await waitForChrome();
    const page = await openPage();
    await page.send("Page.enable");
    console.log("Rendering store images:");
    for (const shot of SHOTS) await shoot(page, shot);
    page.close();
  } finally {
    const exited = new Promise((r) => chrome.once("exit", r));
    chrome.kill();
    await exited;
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
