// npm run verify-pages-nolog: loads the live GitHub Pages site in Chrome and checks the title screen.
// It fails until the Pages deployment is live (first push to main + workflow run); that is expected.
import { writeFileSync } from 'node:fs';
import { fail, log } from './lib/run.mjs';
import { litPixels, openGame } from './lib/page.mjs';

const URL_PAGES = process.env.PAGES_URL ?? 'https://alessandroliscio.github.io/ric-pixel-game-story/';
const logFile = log('verify-pages', 'result');
let browser;
try {
    const r = await openGame(URL_PAGES);
    browser = r.browser;
    const lit = await litPixels(r.context, r.page);
    writeFileSync(logFile, `url: ${URL_PAGES}\nrequests: ${r.requests.length}\nerrors: ${r.errors.join(' | ') || 'none'}\nlit pixels: ${lit}\n`);
    if (r.errors.length) fail('pages', logFile, `console errors: ${r.errors.slice(0, 3).join(' | ')}`);
    if (lit < 200) fail('pages', logFile, `title screen looks blank (${lit} lit pixels)`);
} catch (e) {
    writeFileSync(logFile, String(e.stack ?? e));
    fail('pages', logFile, `${URL_PAGES}: ${String(e.message).split('\n')[0]}`);
} finally {
    await browser?.close();
}
console.log('PASS pages: title screen loaded');
