import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from './app.ts'

test('the running backend responds to the health check', async (context) => {
  const app = createApp()
  context.after(() => app.close())

  const url = await app.listen({ host: '127.0.0.1', port: 0 })
  const response = await fetch(new URL('/api/health', url))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})
