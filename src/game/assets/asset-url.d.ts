declare module 'asset-url' {
    /** URL of a file under public/assets (path relative to public/assets). Data: URI in the offline build. */
    export function assetUrl(path: string): string;
}
