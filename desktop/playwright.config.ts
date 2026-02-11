import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BACKEND_PORT = 8000
const FRONTEND_PORT = 5173
const FRONTEND_HOST = 'localhost'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: `http://${FRONTEND_HOST}:${FRONTEND_PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      cwd: path.resolve(__dirname, '../backend'),
      port: BACKEND_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'pipe',
    },
    {
      command: `npx vite --host ${FRONTEND_HOST} --port 5173`,
      cwd: __dirname,
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      timeout: 30_000,
      stdout: 'pipe',
    },
  ],
})
