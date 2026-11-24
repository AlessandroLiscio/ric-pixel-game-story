// Playwright helpers shared by spike / verify-offline / verify-pages. Uses the installed Chrome
// (channel 'chrome'); no browser is downloaded.
import { chromium } from 'playwright';

export async function openGame(url, { viewport = { width: 1920, height: 1080 }, initScript, timeout = 20000 } = {}) {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url().slice(0, 120)}`));
    if (initScript) await page.addInitScript(initScript);
    await page.goto(url, { timeout });
    await page.waitForFunction(() => window.__ricReady === true, null, { timeout });
    return { browser, context, page, requests, errors };
}

/**
 * Number of non-black pixels in a screenshot of the page (0 for a blank game). The screenshot is
 * decoded in a second, blank tab, because a WebGL canvas cannot be read back reliably.
 */
export async function litPixels(context, page) {
    const png = (await page.screenshot()).toString('base64');
    const other = await context.newPage();
    try {
        return await other.evaluate(async (b64) => {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const x = c.getContext('2d');
            x.drawImage(img, 0, 0);
            const d = x.getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) n++;
            return n;
        }, png);
    } finally {
        await other.close();
    }
}
