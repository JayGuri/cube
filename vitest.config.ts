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
  },
})
