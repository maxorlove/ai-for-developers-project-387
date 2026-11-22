import { resolve } from 'node:path'
import fastifyStatic from '@fastify/static'
import { createApp } from './app.ts'

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer from 1 to 65535')
}

const app = createApp()
await app.register(fastifyStatic, {
  root: resolve(import.meta.dirname, '../frontend/dist'),
})
await app.listen({ host: '0.0.0.0', port })
