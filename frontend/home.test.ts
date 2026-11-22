import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('a guest can follow the booking link from the home page', async (context) => {
  const server = await createServer({
    root: import.meta.dirname,
    server: { host: '127.0.0.1', port: 0, hmr: false },
  })
  context.after(() => server.close())
  await server.listen()

  const address = server.httpServer?.address()
  assert.ok(address && typeof address === 'object')
  const home = await fetch('http://127.0.0.1:' + address.port + '/')
  assert.equal(home.status, 200)

  const html = await home.text()
  assert.match(html, /<h1>\s*Календарь звонков\s*<\/h1>/u)
  const bookingLink = html.match(/<a\b[^>]*\shref="([^"]+)"[^>]*>\s*Записаться на звонок\s*<\/a>/u)
  assert.ok(bookingLink, 'The home page has a link to book a call')
  assert.equal(bookingLink[1], '/booking/')

  const booking = await fetch(new URL(bookingLink[1], home.url))
  assert.equal(booking.status, 200)
  assert.match(await booking.text(), /<h1>\s*Запись на звонок\s*<\/h1>/u)
})
