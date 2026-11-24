import { defineConfig } from 'vite';
import { pagesAlias } from './shared.mjs';

export default defineConfig({
    base: './',
    resolve: { alias: pagesAlias },
    server: { port: 8080 }
});
