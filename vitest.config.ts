import { defineConfig } from 'vitest/config'
import { aliases } from './aliases.ts'

// Standalone test config. Deliberately does NOT load the app's Vite plugins
// (tailwind, basic-ssl, the dev CORS proxy) — they aren't needed for tests and
// break under Vitest's config resolution. esbuild transforms TS/TSX/JSX for us.
//
// Path aliases are mirrored here from vite.config.ts so test imports can use
// `@forms`/`@bpmn`/`@shared` once the codebase adopts them (see ALIASES below).
export default defineConfig({
  resolve: { alias: aliases },
  test: {
    // describe/it/expect available without imports.
    globals: true,
    // Default to the fast node env. DOM-needing suites opt in per-file with a
    // `// @vitest-environment jsdom` docblock (e.g. the BPMN round-trip suite,
    // which uses DOMParser).
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
