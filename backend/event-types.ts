import type { FastifyInstance } from 'fastify'
import type { RouteHandlers } from '../api/generated/sdk/fastify.gen.ts'
import type { EventType } from '../api/generated/sdk/index.ts'
import { invalidJsonResponse } from './invalid-json.ts'

export function isEventTypeId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)
}

function parseEventType(body: unknown): EventType | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined
  }

  const { id, title, description, durationMinutes } = body as Partial<Record<keyof EventType, unknown>>
  if (
    !isEventTypeId(id)
    || typeof title !== 'string' || !title.trim()
    || typeof description !== 'string' || !description.trim()
    || typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes)
    || durationMinutes < 1 || durationMinutes > 540
  ) {
    return undefined
  }

  return { id, title: title.trim(), description: description.trim(), durationMinutes }
}

export function registerEventTypeRoutes(app: FastifyInstance, eventTypes: Map<string, EventType>) {
  const createEventType: RouteHandlers['createEventType'] = (request, reply) => {
    const eventType = parseEventType(request.body)
    if (!eventType) {
      reply.code(400).send({
        code: 'validation_error',
        message: 'Проверьте идентификатор, название, описание и длительность от 1 до 540 минут.',
      })
      return
    }

    if (eventTypes.has(eventType.id)) {
      reply.code(409).send({
        code: 'event_type_exists',
        message: 'Тип встречи с таким идентификатором уже существует. Укажите другой идентификатор.',
      })
      return
    }

    eventTypes.set(eventType.id, eventType)
    reply.code(201).send(eventType)
  }

  const getEventTypes: RouteHandlers['getEventTypes'] = (_request, reply) => {
    reply.code(200).send([...eventTypes.values()])
  }

  app.post('/api/event-types', {
    errorHandler(error, _request, reply) {
      const body = invalidJsonResponse(error, 'Отправьте данные типа встречи в формате JSON.')
      reply.code(400).send(body)
    },
  }, createEventType)
  app.get('/api/event-types', getEventTypes)
}
