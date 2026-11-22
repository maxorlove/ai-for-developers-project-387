import { createApp } from './app.ts'

await createApp().listen({ host: '127.0.0.1', port: 3000 })
