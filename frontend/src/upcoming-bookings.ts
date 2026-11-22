import { getBookings } from '../../api/generated/sdk/index.ts'
import { formatInterval } from './booking-time.ts'

export async function showUpcomingBookings(include?: (id: string) => boolean) {
  const status = document.querySelector<HTMLParagraphElement>('#upcoming-bookings-status')!
  const list = document.querySelector<HTMLUListElement>('#upcoming-bookings-list')!
  try {
    const { data } = await getBookings({ throwOnError: true })
    const bookings = include ? data.filter(({ id }) => include(id)) : data
    if (!bookings.length) {
      status.textContent = 'Предстоящих записей пока нет.'
      return
    }

    for (const booking of bookings) {
      const item = document.createElement('li')
      item.textContent = `«${booking.eventTypeTitle}» — ${formatInterval(booking, 'Europe/Moscow')}, Москва.`
      if (!include && booking.topic) {
        item.append(` Тема звонка — ${booking.topic}`)
      }

      list.append(item)
    }

    status.hidden = true
    list.hidden = false
  } catch {
    status.textContent = 'Не удалось загрузить записи.'
  }
}
