// Pages build: assets are plain files copied from public/, referenced relative to index.html.
// `path` is relative to public/assets, e.g. assetUrl('fonts/PixelOperator.ttf').
export function assetUrl(path: string): string {
    return `assets/${path}`;
}
