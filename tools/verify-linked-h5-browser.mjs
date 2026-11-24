import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const {chromium} = createRequire(process.env.PLAYWRIGHT_PACKAGE || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/package.json')('playwright');
const packagesRoot = path.resolve(process.argv[2] || 'output/textbook-linked-2026-11-24/H5-release');
const output = path.resolve('output/textbook-linked-2026-11-24/browser');
await mkdir(output, {recursive: true});
const manifest = JSON.parse(await readFile(path.join(packagesRoot, '入口清单.json'), 'utf8'));
const navonEntry = manifest.find(item => item.id === 'navon');
const relocated = path.join(output, '仅上传这一个文件-任意改名.html');
await copyFile(path.join(packagesRoot, navonEntry.html), relocated);
const html = await readFile(relocated);
const browser = await chromium.launch({headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files']});
const report = [];

async function accelerate(page) {
  await page.evaluate(() => {
    globalThis.__qaContexts = [];
    for (const task of Textbook.tasks.values()) {
      const run = task.run;
      task.run = async ctx => {
        globalThis.__qaContexts.push(ctx);
        const wait = ctx.wait;
        ctx.wait = ms => wait(Math.min(ms, 2));
        ctx.fixation = async () => { ctx.stage('<div class="fixation">+</div>'); await ctx.wait(2); };
        return run(ctx);
      };
    }
  });
}

async function openTask(page, id) {
  await page.locator('#catalog-link').click();
  await page.locator('#catalog-grid').waitFor();
  await page.locator('#catalog-reset').click();
  await page.locator(`.catalog-open[href="#experiment/${id}"]`).click();
  await page.locator('#begin').waitFor();
}

async function completeChoices(page) {
  await page.locator('#begin').click();
  for (let step = 0; step < 800; step++) {
    if (await page.locator('#download').count()) return;
    assert.equal(await page.locator('#restart').count(), 0, await page.locator('#stage').innerText());
    const choice = page.locator('.choices button:enabled').first();
    if (await choice.count()) await choice.click({timeout: 1500}).catch(() => {});
    else await page.waitForTimeout(15);
  }
  throw new Error('Choice task did not complete');
}

async function navigationChecks(page, mobile, downloadPage = page) {
  await page.locator('#begin').waitFor();
  assert.equal(await page.locator('h1').innerText(), navonEntry.name);
  assert.equal(await page.evaluate(() => Textbook.tasks.size), 27);
  assert.equal(await page.evaluate(() => Object.keys(TEXTBOOK_ASSETS).length), 16);
  await accelerate(page);
  await completeChoices(page);
  await page.locator('.linked-result-catalog').waitFor();
  assert.equal(await page.locator('.linked-result-catalog').count(), 1);
  assert.equal(await page.evaluate(() => __qaContexts.at(-1).rows.length), navonEntry.trials);
  const downloadPromise = downloadPage.waitForEvent('download');
  const url = await page.locator('#download').getAttribute('href');
  await page.locator('#download').click();
  const download = await downloadPromise;
  await download.saveAs(path.join(output, `navon-${mobile ? 'mobile' : 'desktop'}-${page === downloadPage ? 'file' : 'iframe'}.csv`));
  await downloadPage.screenshot({path: path.join(output, `result-${mobile ? 'mobile' : 'desktop'}-${page === downloadPage ? 'file' : 'iframe'}.png`), fullPage: true});
  await page.locator('.linked-result-catalog').click();
  await page.locator('#catalog-grid').waitFor();
  assert.equal(await page.evaluate(() => __qaContexts.at(-1).signal.aborted && __qaContexts.at(-1).rows.length === 0), true);
  assert.equal(await page.evaluate(async value => { try { await fetch(value); return false; } catch { return true; } }, url), true, 'old CSV Blob URL must be revoked');
  assert.equal(await page.locator('.catalog-card').count(), 27);
  await page.locator('#catalog-search').fill('麦格克');
  assert.equal(await page.locator('.catalog-card').count(), 1);
  await page.locator('#catalog-search').fill('不存在的范式xyz');
  await page.locator('.catalog-empty').waitFor();
  await page.locator('#catalog-reset').click();
  await page.locator('#catalog-category').selectOption('工作记忆');
  assert.equal(await page.locator('.catalog-card').count(), 1);
  await page.locator('#catalog-reset').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'catalogue overflow');
  if (page === downloadPage) await page.screenshot({path: path.join(output, `catalog-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: false});

  // Every registered task remains accessible from this one relocated file.
  for (const item of manifest.filter(item => item.id !== 'catalog')) {
    await page.locator(`.catalog-open[href="#experiment/${item.id}"]`).click();
    await page.locator('#begin').waitFor();
    assert.equal(await page.locator('h1').innerText(), item.name);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, item.id + ' overflow');
    await page.locator('#catalog-link').click();
    await page.locator('#catalog-grid').waitFor();
  }

  // Native video still decodes after switching from an unrelated entry; abort pauses it.
  await openTask(page, 'mcgurk');
  await page.locator('#begin').click();
  await page.getByRole('button', {name: '播放检查语音', exact: true}).click();
  await page.locator('[data-media-play]').click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0);
  const media = await page.evaluate(() => {
    globalThis.__qaVideo = document.querySelector('video');
    return {embedded: __qaVideo.src.startsWith('data:video/mp4;base64,'), readyState: __qaVideo.readyState, error: __qaVideo.error?.message || null};
  });
  assert.equal(media.embedded, true); assert.ok(media.readyState >= 2); assert.equal(media.error, null);
  await page.locator('#catalog-link').click();
  await page.locator('#catalog-grid').waitFor();
  assert.equal(await page.evaluate(() => __qaVideo.paused && __qaContexts.at(-1).signal.aborted), true);

  // Pending custom RAF/key handlers cannot overwrite the catalogue after leaving reading.
  await openTask(page, 'self-paced-reading');
  await page.locator('#begin').click();
  for (let i = 0; i < 10; i++) {
    await page.waitForFunction(() => document.querySelector('[data-spr-next]') || document.querySelector('.choices button:enabled'));
    if (await page.locator('[data-spr-next]').count()) break;
    await page.locator('.choices button:enabled').first().click();
  }
  await page.locator('[data-spr-next]:enabled').click();
  await page.locator('#catalog-link').click();
  await page.locator('#catalog-grid').waitFor();
  await page.locator('#stage').press('Space');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.catalog-card').count(), 27);
  assert.equal(await page.evaluate(() => __qaContexts.at(-1).signal.aborted), true);

  // A live timer is also cancelled; native restart/repeat rebinds exit without breaking routing.
  await openTask(page, 'flanker');
  await page.locator('#begin').click();
  await page.locator('.choices button').first().waitFor();
  await page.locator('#exit').click();
  await page.locator('#restart').click();
  await completeChoices(page);
  await page.locator('#repeat').click();
  await page.locator('#begin').click();
  await page.locator('#catalog-link').click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.catalog-card').count(), 27);
  assert.equal(await page.evaluate(() => __qaContexts.at(-1).signal.aborted && __qaContexts.at(-1).rows.length === 0), true);
  await page.evaluate(() => { location.hash = '#experiment/not-a-registered-task'; });
  await page.getByRole('heading', {name: '没有找到这个实验'}).waitFor();
  await page.locator('#catalog-link').click();
  await page.locator('#catalog-grid').waitFor();
  return {allTaskRoutes: 27, resultRows: navonEntry.trials, csvDownload: true, filters: true, video: media, cancellation: ['media', 'reading', 'timers', 'restart', 'repeat'], oldBlobRevoked: true, unknownRoute: true};
}

let server;
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1365, height: 900}, hasTouch: mobile, isMobile: mobile, offline: true, acceptDownloads: true});
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    // Default entry of every exported file must survive without any other file or network.
    for (const item of manifest) {
      await page.goto(pathToFileURL(path.join(packagesRoot, item.html)).href);
      if (item.id === 'catalog') assert.equal(await page.locator('.catalog-card').count(), 27);
      else { await page.locator('#begin').waitFor(); assert.equal(await page.locator('h1').innerText(), item.name); }
    }
    await page.goto(pathToFileURL(relocated).href);
    const checks = await navigationChecks(page, mobile);
    await page.goBack();
    await page.getByRole('heading', {name: '没有找到这个实验'}).waitFor();
    await page.goForward();
    await page.locator('#catalog-grid').waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    report.push({mode: 'offline-file', mobile, defaultEntries: manifest.length, ...checks, history: true, errors, externalRequests: requests});
    console.log(`${mobile ? 'mobile' : 'desktop'} file: all 28 entries, 27 routes, results/download, cleanup, media and history passed`);
    await context.close();
  }
  server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html;charset=utf-8');
    if (request.url === '/textbook') response.end('<!doctype html><title>教材嵌入测试</title><iframe title="教材实验" src="/arbitrary/storage/renamed.html" sandbox="allow-scripts allow-downloads" style="width:100%;height:900px;border:0"></iframe>');
    else if (request.url === '/arbitrary/storage/renamed.html') response.end(html);
    else {response.statusCode = 404; response.end('not found');}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({viewport: {width: 1365, height: 1000}, acceptDownloads: true});
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) requests.push(request.url()); });
  await page.goto(origin + '/textbook');
  const frame = page.frames().find(frame => frame.url().includes('/arbitrary/storage/'));
  await frame.locator('#begin').waitFor();
  await context.setOffline(true);
  const checks = await navigationChecks(frame, false, page);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  report.push({mode: 'opaque-sandbox-iframe', sandbox: 'allow-scripts allow-downloads', offlineAfterInitialLoad: true, ...checks, errors, externalRequests: requests});
  console.log('opaque sandbox iframe: renamed file, offline navigation, media, results and CSV download passed');
  await context.close();
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await browser.close();
}
await writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
console.log(`Linked H5 browser checks passed. Report: ${output}`);
