import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './frontend/browser',
  ...(process.env.PR_BROWSER_REPORT && {
    reporter: [['list'], ['html', { open: 'never' }]],
    use: { trace: 'on' },
  }),
})
