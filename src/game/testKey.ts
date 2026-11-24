// The test skip key: a hook that lets automated tests jump past scenes and minigames.
// It exists ONLY in a test build (`VITE_TEST_BUILD=1 vite build ...`). Production builds (Pages and the
// offline zip) must not contain this string anywhere; `npm run verify-production-nolog` greps for it.
// scripts/verify-production.mjs reads the value from the line below, so keep this single definition.
export const TEST_SKIP_KEY = '__RIC_TEST_SKIP__';

/** Registers the hook on window. A no-op (and dead code) unless the build is a test build. */
export function installTestSkip(skip: () => void): void {
    if (import.meta.env.VITE_TEST_BUILD === '1') {
        (window as unknown as Record<string, unknown>)[TEST_SKIP_KEY] = skip;
    }
}
