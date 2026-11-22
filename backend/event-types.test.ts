import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from './app.ts'
import { assertJsonResponse } from './openapi-response.ts'

function postEventType(url: URL, body: string) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

test('the event type catalog returns an empty JSON array when no types exist', async (context) => {
  const app = createApp({ eventTypes: [] })
  context.after(() => app.close())
  const url = await app.listen({ host: '127.0.0.1', port: 0 })

  const response = await fetch(new URL('/api/event-types', url))

  assert.equal(response.status, 200)
  assert.deepEqual(await assertJsonResponse(response, 'get', '/api/event-types'), [])
})

test('the event type catalog returns all details of an existing type', async (context) => {
  const app = createApp({
    eventTypes: [{
      id: 'intro',
      title: 'Знакомство',
      description: 'Короткий вводный звонок',
      durationMinutes: 30,
    }],
  })
  context.after(() => app.close())
  const url = await app.listen({ host: '127.0.0.1', port: 0 })

  const response = await fetch(new URL('/api/event-types', url))

  assert.equal(response.status, 200)
  assert.deepEqual(await assertJsonResponse(response, 'get', '/api/event-types'), [{
    id: 'intro',
    title: 'Знакомство',
    description: 'Короткий вводный звонок',
    durationMinutes: 30,
  }])
})

test('creating an event type adds it to the guest catalog', async (context) => {
  const app = createApp({ eventTypes: [] })
  context.after(() => app.close())
  const url = await app.listen({ host: '127.0.0.1', port: 0 })
  const eventTypesUrl = new URL('/api/event-types', url)

  const eventType = {
    id: 'intro-1',
    title: 'Знакомство',
    description: 'Вводный звонок',
    durationMinutes: 30,
  }
  const created = await postEventType(eventTypesUrl, JSON.stringify({
    ...eventType,
    title: ' Знакомство ',
    description: ' Вводный звонок ',
  }))

  assert.equal(created.status, 201)
  assert.deepEqual(await assertJsonResponse(created, 'post', '/api/event-types'), eventType)

  const catalog = await fetch(eventTypesUrl)
  assert.equal(catalog.status, 200)
  assert.deepEqual(await assertJsonResponse(catalog, 'get', '/api/event-types'), [eventType])
})

test('the API rejects invalid event types without adding them to the catalog', async (context) => {
  const app = createApp({ eventTypes: [] })
  context.after(() => app.close())
  const url = await app.listen({ host: '127.0.0.1', port: 0 })
  const eventTypesUrl = new URL('/api/event-types', url)
  const validEventType = {
    id: 'intro',
    title: 'Знакомство',
    description: 'Вводный звонок',
    durationMinutes: 30,
  }

  const invalidBodies = {
    'uppercase identifier': JSON.stringify({ ...validEventType, id: 'Intro' }),
    'repeated hyphens in the identifier': JSON.stringify({ ...validEventType, id: 'intro--1' }),
    'numeric identifier': JSON.stringify({ ...validEventType, id: 123 }),
    'blank title': JSON.stringify({ ...validEventType, title: ' \t ' }),
    'missing description': JSON.stringify({ ...validEventType, description: undefined }),
    'blank description': JSON.stringify({ ...validEventType, description: ' ' }),
    'duration below the minimum': JSON.stringify({ ...validEventType, durationMinutes: 0 }),
    'duration above the maximum': JSON.stringify({ ...validEventType, durationMinutes: 541 }),
    'fractional duration': JSON.stringify({ ...validEventType, durationMinutes: 1.5 }),
    'duration supplied as a string': JSON.stringify({ ...validEventType, durationMinutes: '30' }),
    'non-object body': 'null',
    'malformed JSON': '{',
  }

  for (const [name, body] of Object.entries(invalidBodies)) {
    await context.test(name, async () => {
      const response = await postEventType(eventTypesUrl, body)
      assert.equal(response.status, 400)
      assert.partialDeepStrictEqual(await assertJsonResponse(response, 'post', '/api/event-types'), {
        code: 'validation_error',
      })
    })
  }

  const catalog = await fetch(eventTypesUrl)
  assert.equal(catalog.status, 200)
  assert.deepEqual(await assertJsonResponse(catalog, 'get', '/api/event-types'), [])
})

test('a duplicate identifier does not replace the existing event type', async (context) => {
  const original = {
    id: 'intro',
    title: 'Знакомство',
    description: 'Вводный звонок',
    durationMinutes: 30,
  }
  const app = createApp({ eventTypes: [original] })
  context.after(() => app.close())
  const url = await app.listen({ host: '127.0.0.1', port: 0 })
  const eventTypesUrl = new URL('/api/event-types', url)

  const response = await postEventType(eventTypesUrl, JSON.stringify({
    ...original,
    title: 'Новая встреча',
  }))

  assert.equal(response.status, 409)
  assert.partialDeepStrictEqual(await assertJsonResponse(response, 'post', '/api/event-types'), {
    code: 'event_type_exists',
  })

  const catalog = await fetch(eventTypesUrl)
  assert.equal(catalog.status, 200)
  assert.deepEqual(await assertJsonResponse(catalog, 'get', '/api/event-types'), [original])
})
