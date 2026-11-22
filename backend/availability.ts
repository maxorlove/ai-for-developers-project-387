import type { FastifyInstance } from 'fastify'
import type { RouteHandlers } from '../api/generated/sdk/fastify.gen.ts'
import type { Availability, EventType, Slot } from '../api/generated/sdk/index.ts'

const timeZone = 'Europe/Moscow'
const windowDays: Availability['days']['length'] = 14
const workdayMinutes = 9 * 60
const slotStepMinutes = 30
const millisecondsPerMinute = 60_000

const moscowDate = new Intl.DateTimeFormat('en', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const moscowOffset = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })

export function getAvailability(now: Date, durationMinutes: number): Availability {
  const { year, month, day } = Object.fromEntries(
    moscowDate.formatToParts(now).map(({ type, value }) => [type, value]),
  )
  const calendarDay = new Date(`${year}-${month}-${day}T12:00:00Z`)

  const days = Array.from({ length: windowDays }, () => {
    calendarDay.setUTCDate(calendarDay.getUTCDate() + 1)
    const date = calendarDay.toISOString().slice(0, 10)
    const offset = moscowOffset.formatToParts(calendarDay)
      .find(({ type }) => type === 'timeZoneName')!.value.slice(3) || 'Z'
    const workdayStart = Date.parse(`${date}T09:00:00${offset}`)
    const slots: Slot[] = []

    for (let minutes = 0; minutes + durationMinutes <= workdayMinutes; minutes += slotStepMinutes) {
      const startsAt = new Date(workdayStart + minutes * millisecondsPerMinute)
      const endsAt = new Date(startsAt.getTime() + durationMinutes * millisecondsPerMinute)
      slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() })
    }

    return { date, slots }
  })

  return { timeZone, days: days as Availability['days'] }
}

export function overlapsBooking(slot: Slot, bookings: readonly Slot[]): boolean {
  return bookings.some(({ startsAt, endsAt }) => slot.startsAt < endsAt && startsAt < slot.endsAt)
}

export function registerAvailabilityRoutes(
  app: FastifyInstance,
  eventTypes: ReadonlyMap<string, EventType>,
  clock: () => Date,
  bookings: readonly Slot[],
) {
  const getEventTypeSlots: RouteHandlers['getEventTypeSlots'] = (request, reply) => {
    const eventType = eventTypes.get(request.params.id)
    if (!eventType) {
      reply.code(404).send({ code: 'event_type_not_found', message: 'Тип встречи не найден.' })
      return
    }

    const availability = getAvailability(clock(), eventType.durationMinutes)
    for (const day of availability.days) {
      day.slots = day.slots.filter((slot) => !overlapsBooking(slot, bookings))
    }

    reply.code(200).send(availability)
  }

  app.get('/api/event-types/:id/slots', getEventTypeSlots)
}
