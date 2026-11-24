import { defineConfig } from 'vite';
import { baseBuild, pagesAlias } from './shared.mjs';

// GitHub Pages build -> dist/ (base './', so it works from any sub-path).
// The build script adds the offline zip to dist/ afterwards.
export default defineConfig({
    ...baseBuild,
    resolve: { alias: pagesAlias },
    build: { ...baseBuild.build, outDir: 'dist', emptyOutDir: true }
});
