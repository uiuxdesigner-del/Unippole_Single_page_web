import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const browser = 'http://127.0.0.1:9225';
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
});
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout: ${method}`));
    }, 60000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__draws = {};
  let canvasId = 0;
  for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Constructor) continue;
    for (const key of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = Constructor.prototype[key];
      if (!original) continue;
      Constructor.prototype[key] = function(...args) {
        const id = this.canvas.dataset.perfCanvas ||= String(++canvasId);
        window.__draws[id] = (window.__draws[id] || 0) + 1;
        return original.apply(this, args);
      };
    }
  }
` });
await send('Page.navigate', { url: process.env.PERF_URL || 'http://127.0.0.1:3000' });
await delay(10000);
const status = () => evaluate(`({
  title: document.title, ready: document.readyState,
  scrollY: window.scrollY,
  width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
  canvases: [...document.querySelectorAll('canvas')].map(c => ({id:c.dataset.perfCanvas, width:c.width, height:c.height, top:Math.round(c.getBoundingClientRect().top)})),
  imageRequests: performance.getEntriesByType('resource').filter(r => r.initiatorType === 'img' || r.name.includes('/models/')).map(r => ({url:r.name,bytes:r.encodedBodySize})),
  draws: {...window.__draws}
})`);
console.log('INITIAL', JSON.stringify(await status()));
assert.equal((await status()).canvases.length, 1, 'Only hero WebGL should load at startup');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Plan Campaign')).click()`);
await delay(500);
assert.equal(await evaluate(`!!document.querySelector('[role="dialog"]')`), true, 'Campaign drawer opens');
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
await delay(600);
assert.equal(await evaluate(`document.body.style.overflow`), '', 'Campaign drawer releases scroll lock');
const heroShot = await send('Page.captureScreenshot', { format: 'png' });
await writeFile('tools/performance-desktop.png', Buffer.from(heroShot.data, 'base64'));
await evaluate(`document.querySelector('#inventory').scrollIntoView({behavior:'instant'})`);
await delay(2500);
console.log('INVENTORY', JSON.stringify(await status()));
await evaluate(`document.querySelector('#inventory button[aria-label^="View "]').click()`);
await delay(500);
assert.equal(await evaluate(`!!document.querySelector('[role="dialog"]')`), true, 'Module modal opens');
await evaluate(`document.querySelector('[aria-label="Close module details"]').click()`);
await delay(500);
assert.equal(await evaluate(`!!document.querySelector('[role="dialog"]')`), false, 'Module modal closes');
console.log('INTERACTIONS', 'Campaign and inventory dialogs passed');
await evaluate(`document.querySelector('[aria-label="Switch to night mode"]').closest('section').scrollIntoView({behavior:'instant'})`);
await delay(15000);
console.log('CITY', JSON.stringify(await status()));
await evaluate(`document.querySelector('[aria-label="Switch to night mode"]').click()`);
await delay(3000);
console.log('NIGHT', await evaluate(`document.querySelector('[aria-label="Switch to day mode"]') !== null`));
await evaluate(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`);
await delay(6000);
const before = await status();
await delay(2500);
const after = await status();
console.log('OFFSCREEN', JSON.stringify({scrollY:after.scrollY,canvases:after.canvases,before:before.draws,after:after.draws}));
assert.deepEqual(after.draws, before.draws, 'Offscreen canvases should stop drawing');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] });
await evaluate(`window.scrollTo({top:0,behavior:'instant'})`);
await delay(2000);
const mobileBefore = await status();
await delay(1200);
const mobileAfter = await status();
console.log('MOBILE_REDUCED', JSON.stringify({width:mobileAfter.width,scrollWidth:mobileAfter.scrollWidth,before:mobileBefore.draws,after:mobileAfter.draws}));
assert.ok(mobileAfter.scrollWidth <= mobileAfter.width, 'Mobile must not overflow horizontally');
assert.deepEqual(mobileAfter.draws, mobileBefore.draws, 'Reduced-motion hero should be still');
const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
await writeFile('tools/performance-mobile.png', Buffer.from(mobileShot.data, 'base64'));
console.log('ERRORS', JSON.stringify(errors));
assert.equal(errors.length, 0, 'No browser runtime errors');
socket.close();
await fetch(`${browser}/json/close/${target.id}`);
