import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Availability, Booking } from '../api/generated/sdk/index.ts'
import { createApp } from './app.ts'
import { assertJsonResponse } from './openapi-response.ts'

const bookingsPath = '/api/bookings'

async function startApp(context: TestContext, clock = () => new Date('2026-11-20T20:59:59.999Z')) {
  const app = createApp({
    clock,
    eventTypes: [
      { id: 'intro', title: 'Знакомство', description: 'Вводный звонок', durationMinutes: 60 },
      { id: 'brief', title: 'Краткий звонок', description: 'Короткая встреча', durationMinutes: 30 },
    ],
  })
  context.after(() => app.close())
  return app.listen({ host: '127.0.0.1', port: 0 })
}

function book(url: string, eventTypeId: string, startsAt: string) {
  return postJson(url, JSON.stringify({ eventTypeId, startsAt }))
}

function postJson(url: string, body: string) {
  return fetch(new URL(bookingsPath, url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

async function listBookings(url: string) {
  const response = await fetch(new URL(bookingsPath, url))
  assert.equal(response.status, 200)
  return assertJsonResponse(response, 'get', bookingsPath)
}

test('the owner sees upcoming bookings of all types sorted by start', async (context) => {
  let now = '2026-11-20T20:59:59.999Z'
  const url = await startApp(context, () => new Date(now))
  assert.deepEqual(await listBookings(url), [])

  const later = await book(url, 'intro', '2026-11-21T08:30:00Z')
  const earlier = await book(url, 'brief', '2026-11-21T07:00:00Z')
  const past = await book(url, 'intro', '2026-11-21T06:00:00Z')
  assert.equal(later.status, 201)
  assert.equal(earlier.status, 201)
  assert.equal(past.status, 201)
  const laterBooking = await assertJsonResponse(later, 'post', bookingsPath)
  const earlierBooking = await assertJsonResponse(earlier, 'post', bookingsPath)
  await assertJsonResponse(past, 'post', bookingsPath)

  now = '2026-11-21T07:00:00.000Z'
  assert.deepEqual(await listBookings(url), [earlierBooking, laterBooking])

  now = '2026-11-21T07:00:00.001Z'
  assert.deepEqual(await listBookings(url), [laterBooking])
})

test('a guest confirms a slot and receives the meeting interval in UTC', async (context) => {
  const url = await startApp(context)
  const response = await book(url, 'intro', '2026-11-21T10:00:00+03:00')

  assert.equal(response.status, 201)
  const booking = await assertJsonResponse(response, 'post', bookingsPath) as Booking
  assert.ok(booking.id)
  assert.equal(booking.eventTypeId, 'intro')
  assert.equal(booking.eventTypeTitle, 'Знакомство')
  assert.equal(booking.startsAt, '2026-11-21T07:00:00.000Z')
  assert.equal(booking.endsAt, '2026-11-21T08:00:00.000Z')
})

test('bookings reject invalid fields, malformed JSON and starts outside the schedule', async (context) => {
  const url = await startApp(context)
  const valid = { eventTypeId: 'intro', startsAt: '2026-11-21T07:00:00Z' }
  const invalidBodies = [
    '{',
    '',
    'null',
    JSON.stringify({ startsAt: valid.startsAt }),
    JSON.stringify({ eventTypeId: 'Bad-ID', startsAt: valid.startsAt }),
    JSON.stringify({ eventTypeId: 'intro', startsAt: 1795244400000 }),
    ...[
      '2026-11-21 07:00:00Z', // Non-RFC 3339 separator
      '2026-11-21T07:00:00', // Missing offset
      '2026-11-21T07:00:00Z extra',
      '2026-11-31T07:00:00Z', // Invalid calendar date
      '2026-11-21T07:00:00.0001Z', // Fractional second
      '2026-11-20T24:00:00-07:00', // Hour 24 is not valid
      '2026-11-20T07:00:00Z', // Today in Moscow
      '2026-12-05T07:00:00Z', // Beyond the last available day
      '2026-11-21T05:30:00Z', // Before the workday
      '2026-11-21T07:15:00Z', // Off the 30-minute grid
      '2026-11-21T14:30:00Z', // Meeting ends after the workday
    ].map((startsAt) => JSON.stringify({ ...valid, startsAt })),
  ]

  for (const body of invalidBodies) {
    const response = await postJson(url, body)

    assert.equal(response.status, 400, body)
    const error = await assertJsonResponse(response, 'post', bookingsPath)
    assert.ok(error && typeof error === 'object' && 'code' in error)
    assert.equal(error.code, 'validation_error', body)
  }
})

test('bookings report an unknown event type', async (context) => {
  const url = await startApp(context)
  const response = await book(url, 'unknown', '2026-11-21T07:00:00Z')

  assert.equal(response.status, 404)
  const error = await assertJsonResponse(response, 'post', bookingsPath)
  assert.ok(error && typeof error === 'object' && 'code' in error)
  assert.equal(error.code, 'event_type_not_found')
})

test('bookings reject partial overlap across event types and allow adjacent slots', async (context) => {
  const url = await startApp(context)
  const first = await book(url, 'intro', '2026-11-21T07:00:00Z')
  assert.equal(first.status, 201)
  await assertJsonResponse(first, 'post', bookingsPath)

  const overlap = await book(url, 'brief', '2026-11-21T07:30:00Z')
  assert.equal(overlap.status, 409)
  const error = await assertJsonResponse(overlap, 'post', bookingsPath)
  assert.ok(error && typeof error === 'object' && 'code' in error)
  assert.equal(error.code, 'slot_taken')

  const availability = await fetch(new URL('/api/event-types/brief/slots', url))
  assert.equal(availability.status, 200)
  const { days } = await assertJsonResponse(availability, 'get', '/api/event-types/{id}/slots') as Availability
  const starts = days[0]!.slots.map(({ startsAt }) => startsAt)
  assert.ok(!starts.includes('2026-11-21T07:00:00.000Z'))
  assert.ok(!starts.includes('2026-11-21T07:30:00.000Z'))
  assert.ok(starts.includes('2026-11-21T08:00:00.000Z'))

  const adjacent = await book(url, 'brief', '2026-11-21T08:00:00Z')
  assert.equal(adjacent.status, 201)
  await assertJsonResponse(adjacent, 'post', bookingsPath)
})

test('bookings reject a repeat of a confirmed slot', async (context) => {
  const url = await startApp(context)
  const first = await book(url, 'intro', '2026-11-21T10:00:00+03:00')
  assert.equal(first.status, 201)
  await assertJsonResponse(first, 'post', bookingsPath)

  const repeat = await book(url, 'intro', '2026-11-21T07:00:00Z')
  assert.equal(repeat.status, 409)
  const error = await assertJsonResponse(repeat, 'post', bookingsPath)
  assert.ok(error && typeof error === 'object' && 'code' in error)
  assert.equal(error.code, 'slot_taken')
})

test('only one of two simultaneous overlapping booking requests across event types is saved', async (context) => {
  const url = await startApp(context)
  const responses = await Promise.all([
    book(url, 'intro', '2026-11-21T07:00:00Z'),
    book(url, 'brief', '2026-11-21T07:30:00Z'),
  ])

  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409])
  const winner = responses.find(({ status }) => status === 201)!
  const booking = await assertJsonResponse(winner, 'post', bookingsPath) as Booking
  const loser = responses.find(({ status }) => status === 409)!
  const error = await assertJsonResponse(loser, 'post', bookingsPath)
  assert.ok(error && typeof error === 'object' && 'code' in error)
  assert.equal(error.code, 'slot_taken')

  const availability = await fetch(new URL('/api/event-types/brief/slots', url))
  assert.equal(availability.status, 200)
  const { days } = await assertJsonResponse(availability, 'get', '/api/event-types/{id}/slots') as Availability
  const starts = days[0]!.slots.map(({ startsAt }) => startsAt)
  assert.ok(!starts.includes('2026-11-21T07:30:00.000Z'))
  assert.equal(starts.includes('2026-11-21T07:00:00.000Z'), booking.startsAt === '2026-11-21T07:30:00.000Z')
  assert.ok(starts.includes('2026-11-21T08:00:00.000Z'))
  assert.deepEqual(await listBookings(url), [booking])
})
