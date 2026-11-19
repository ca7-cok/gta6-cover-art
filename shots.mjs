// Takes the entry's screenshots from the running app over CDP: loads each
// ?shot= scene from shots.json, waits for window.__shotReady, captures a PNG.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 9228;
const shots = JSON.parse(readFileSync(new URL('./shots.json', import.meta.url)));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
};
await new Promise((r) => { ws.onopen = r; });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

for (const shot of shots) {
  await send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://localhost:8080/${shot.query}` });
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const ev = await send('Runtime.evaluate', { expression: '!!window.__shotReady', returnByValue: true });
    ready = ev.result?.value === true;
  }
  if (!ready) console.log(`WARN ${shot.name}: __shotReady never set`);
  const cap = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`/tmp/shot-${shot.name.replace('.jpg', '.png')}`, Buffer.from(cap.data, 'base64'));
  console.log(`captured ${shot.name} ready=${ready}`);
}
chrome.kill();
process.exit(0);
