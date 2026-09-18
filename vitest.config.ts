import react from '@vitejs/plugin-react'
// defineConfig comes from "vitest/config", not "vite" — the plain vite export
// has no `test` key and fails to typecheck.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // tests/e2e is Playwright's; its *.spec.ts files match vitest's default
    // include glob and blow up under jsdom if not excluded here.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
})
