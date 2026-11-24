// Offline build: every binary asset under public/assets is inlined as a data: URI, so the single
// HTML file works from file:// with no other file and no network request.
// Same signature as assetUrl.pages.ts; the two are swapped by the `asset-url` alias in vite/shared.mjs.
const inlined = import.meta.glob('/public/assets/**/*.{png,jpg,jpeg,gif,webp,ttf,woff,woff2}', {
    query: '?inline',
    eager: true,
    import: 'default'
}) as Record<string, string>;

export function assetUrl(path: string): string {
    const url = inlined[`/public/assets/${path}`];
    if (!url) throw new Error(`assetUrl: ${path} is not inlined in the offline build`);
    return url;
}
