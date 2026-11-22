import assert from 'node:assert/strict'
import test from 'node:test'
import type { Availability } from '../api/generated/sdk/index.ts'
import { createApp } from './app.ts'
import { assertJsonResponse } from './openapi-response.ts'

const slotsPath = '/api/event-types/{id}/slots'

test('availability rolls over at Moscow midnight and offers half-hour starts that fit the meeting', async (context) => {
  let now = new Date('2026-11-20T20:59:59.999Z')
  const app = createApp({
    clock: () => now,
    eventTypes: [{
      id: 'intro',
      title: 'Знакомство',
      description: 'Вводный звонок',
      durationMinutes: 60,
    }],
  })
  context.after(() => app.close())
  const url = await app.listen({ host: '127.0.0.1', port: 0 })

  const firstResponse = await fetch(new URL('/api/event-types/intro/slots', url))
  assert.equal(firstResponse.status, 200)
  const first = await assertJsonResponse(firstResponse, 'get', slotsPath) as Availability
  assert.equal(first.timeZone, 'Europe/Moscow')
  assert.deepEqual(first.days.map(({ date }) => date), [
    '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24',
    '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28',
    '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02',
    '2026-12-03', '2026-12-04',
  ])
  const { slots } = first.days[0]!
  assert.equal(slots.length, 17)
  assert.deepEqual(slots.slice(0, 2), [
    { startsAt: '2026-11-21T06:00:00.000Z', endsAt: '2026-11-21T07:00:00.000Z' },
    { startsAt: '2026-11-21T06:30:00.000Z', endsAt: '2026-11-21T07:30:00.000Z' },
  ])
  assert.deepEqual(slots.at(-1), {
    startsAt: '2026-11-21T14:00:00.000Z',
    endsAt: '2026-11-21T15:00:00.000Z',
  })

  now = new Date('2026-11-20T21:00:00Z')
  const secondResponse = await fetch(new URL('/api/event-types/intro/slots', url))
  assert.equal(secondResponse.status, 200)
  const second = await assertJsonResponse(secondResponse, 'get', slotsPath) as Availability
  assert.equal(second.days.length, 14)
  assert.equal(second.days[0]?.date, '2026-11-22')
  assert.equal(second.days.at(-1)?.date, '2026-12-05')
})

test('availability reports an unknown event type', async (context) => {
  const app = createApp()
  context.after(() => app.close())
  const url = await app.listen({ host: '127.0.0.1', port: 0 })

  const response = await fetch(new URL('/api/event-types/unknown/slots', url))

  assert.equal(response.status, 404)
  const body = await assertJsonResponse(response, 'get', slotsPath)
  assert.ok(body && typeof body === 'object' && 'code' in body)
  assert.equal(body.code, 'event_type_not_found')
})
