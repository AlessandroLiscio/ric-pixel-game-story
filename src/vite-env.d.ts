/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** '1' only in a test build (VITE_TEST_BUILD=1); enables the test skip key. Never set for Pages or the offline zip. */
    readonly VITE_TEST_BUILD?: string;
}
