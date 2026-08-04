import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    // UI tests need a DOM; they never talk to a real backend (fetch is mocked).
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Lab 1 tests all live under tests/lab-01/ (see docs/lab-01/tests.md).
    include: ['tests/lab-01/**/*.test.tsx'],
    // Issue 1 configures the runner before any test exists.
    passWithNoTests: true,
  },
})
