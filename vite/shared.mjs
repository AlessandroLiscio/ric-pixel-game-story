import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// `asset-url` is a bare module name: the Pages build resolves it to plain relative URLs,
// the offline build resolves it to a module that inlines every file of public/assets as a data: URI.
export const pagesAlias = { 'asset-url': here('../src/game/assets/assetUrl.pages.ts') };
export const offlineAlias = { 'asset-url': here('../src/game/assets/assetUrl.offline.ts') };

// Only a test build (VITE_TEST_BUILD=1) may contain the test skip key; see src/game/testKey.ts.
export const baseBuild = {
    base: './',
    logLevel: 'warning',
    build: { chunkSizeWarningLimit: 2000 }
};
