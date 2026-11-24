import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { baseBuild, offlineAlias } from './shared.mjs';

// Offline build -> dist-offline/index.html: one self-contained file (JS, CSS, fonts, images inlined).
export default defineConfig({
    ...baseBuild,
    resolve: { alias: offlineAlias },
    plugins: [viteSingleFile()],
    build: { ...baseBuild.build, outDir: 'dist-offline', emptyOutDir: true, copyPublicDir: false }
});
