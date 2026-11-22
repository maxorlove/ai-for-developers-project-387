import type { Availability, Slot } from '../../api/generated/sdk/index.ts'

export const dateOptions = { weekday: 'short', day: 'numeric', month: 'long' } as const
export const timeOptions = { hour: '2-digit', minute: '2-digit' } as const

export function formatInterval({ startsAt, endsAt }: Slot, timeZone: Availability['timeZone']) {
  const formatDate = new Intl.DateTimeFormat('ru', { ...dateOptions, timeZone })
  const formatTime = new Intl.DateTimeFormat('ru', { ...timeOptions, timeZone })
  const start = new Date(startsAt)
  return `${formatDate.format(start)}, ${formatTime.format(start)}–${formatTime.format(new Date(endsAt))}`
}
