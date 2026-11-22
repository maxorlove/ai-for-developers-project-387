import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { RouteHandlers } from '../api/generated/sdk/fastify.gen.ts'
import type { Booking, BookingRequest, EventType } from '../api/generated/sdk/index.ts'
import { getAvailability, overlapsBooking } from './availability.ts'
import { isEventTypeId } from './event-types.ts'
import { invalidJsonResponse } from './invalid-json.ts'

const rfc3339 = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.(\d+))?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i

function parseBookingRequest(body: unknown): BookingRequest | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined
  }

  const { eventTypeId, startsAt } = body as Partial<Record<keyof BookingRequest, unknown>>
  if (!isEventTypeId(eventTypeId) || typeof startsAt !== 'string') {
    return undefined
  }

  const match = rfc3339.exec(startsAt)
  if (!match) {
    return undefined
  }

  const [, date, fraction = ''] = match
  const calendarDay = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== date) {
    return undefined
  }

  // A nonzero sub-millisecond fraction would be truncated by Date.
  if (/[1-9]/.test(fraction.slice(3))) {
    return undefined
  }

  return { eventTypeId, startsAt: new Date(startsAt).toISOString() }
}

export function registerBookingRoutes(
  app: FastifyInstance,
  eventTypes: ReadonlyMap<string, EventType>,
  clock: () => Date,
  bookings: Booking[],
) {
  const createBooking: RouteHandlers['createBooking'] = (request, reply) => {
    const input = parseBookingRequest(request.body)
    if (!input) {
      reply.code(400).send({ code: 'validation_error', message: 'Проверьте идентификатор типа встречи и время начала.' })
      return
    }

    const eventType = eventTypes.get(input.eventTypeId)
    if (!eventType) {
      reply.code(404).send({ code: 'event_type_not_found', message: 'Тип встречи не найден.' })
      return
    }

    const { days } = getAvailability(clock(), eventType.durationMinutes)
    const slot = days.flatMap(({ slots }) => slots)
      .find(({ startsAt: candidate }) => candidate === input.startsAt)
    if (!slot) {
      reply.code(400).send({ code: 'validation_error', message: 'Выберите время в пределах доступного расписания.' })
      return
    }

    if (overlapsBooking(slot, bookings)) {
      reply.code(409).send({ code: 'slot_taken', message: 'Это время уже занято. Выберите другой слот.' })
      return
    }

    const booking: Booking = {
      id: randomUUID(),
      eventTypeId: eventType.id,
      eventTypeTitle: eventType.title,
      ...slot,
    }
    bookings.push(booking)
    reply.code(201).send(booking)
  }

  const getBookings: RouteHandlers['getBookings'] = (_request, reply) => {
    const now = clock().getTime()
    const upcoming = bookings
      .filter(({ startsAt }) => Date.parse(startsAt) >= now)
      .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt))
    reply.code(200).send(upcoming)
  }

  app.post('/api/bookings', {
    errorHandler(error, _request, reply) {
      const body = invalidJsonResponse(error, 'Отправьте данные записи в формате JSON.')
      reply.code(400).send(body)
    },
  }, createBooking)
  app.get('/api/bookings', getBookings)
}
