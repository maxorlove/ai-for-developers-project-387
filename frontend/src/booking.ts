import { createBooking, getEventTypeSlots, getEventTypes } from '../../api/generated/sdk/index.ts'
import type { Availability, EventType, Slot } from '../../api/generated/sdk/index.ts'
import { dateOptions, formatInterval, timeOptions } from './booking-time.ts'
import { rememberBooking } from './guest-bookings.ts'

const status = document.querySelector<HTMLParagraphElement>('#catalog-status')!
const list = document.querySelector<HTMLUListElement>('#event-types')!
const calendar = document.querySelector<HTMLElement>('#booking-calendar')!
const calendarHeading = document.querySelector<HTMLHeadingElement>('#calendar-heading')!
const calendarStatus = document.querySelector<HTMLParagraphElement>('#calendar-status')!
const timeZoneLabel = document.querySelector<HTMLParagraphElement>('#booking-time-zone')!
const daySelect = document.querySelector<HTMLSelectElement>('#booking-day')!
const slotsStatus = document.querySelector<HTMLParagraphElement>('#slots-status')!
const slotsList = document.querySelector<HTMLUListElement>('#booking-slots')!
const bookingStatus = document.querySelector<HTMLParagraphElement>('#booking-status')!
const selection = document.querySelector<HTMLElement>('#booking-selection')!
const selectionDetails = document.querySelector<HTMLParagraphElement>('#booking-selection-details')!
const confirmButton = document.querySelector<HTMLButtonElement>('#confirm-booking')!
const confirmation = document.querySelector<HTMLElement>('#booking-confirmation')!
const confirmationDetails = document.querySelector<HTMLParagraphElement>('#booking-confirmation-details')!

const formatCalendarDate = new Intl.DateTimeFormat('ru', { ...dateOptions, timeZone: 'UTC' })

type CalendarView = {
  eventType: EventType
  availability?: Availability
}

let activeCalendar: CalendarView | undefined
let availabilityRequest: { eventType: EventType; controller: AbortController } | undefined
let selectedSlot: Slot | undefined
let bookingPending = false

function updateSelection(slot?: Slot) {
  selectedSlot = slot
  selection.hidden = !slot
  confirmButton.disabled = bookingPending || !!availabilityRequest

  for (const button of slotsList.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.value === slot?.startsAt))
  }

  if (slot && activeCalendar?.availability) {
    selectionDetails.textContent = formatInterval(slot, activeCalendar.availability.timeZone)
  }
}

function renderSlots({ days, timeZone }: Availability, selectedStart?: string) {
  const slots = days.find(({ date }) => date === daySelect.value)?.slots ?? []
  const formatTime = new Intl.DateTimeFormat('ru', { ...timeOptions, timeZone })
  const focusedStart = slotsList.querySelector<HTMLButtonElement>('button:focus')?.value

  slotsList.replaceChildren()
  slotsStatus.textContent = slots.length ? '' : 'На этот день нет свободных слотов.'
  slotsList.hidden = !slots.length
  for (const slot of slots) {
    const item = document.createElement('li')
    const button = document.createElement('button')
    const time = document.createElement('time')

    button.type = 'button'
    button.value = slot.startsAt
    time.dateTime = slot.startsAt
    time.textContent = formatTime.format(new Date(slot.startsAt))
    button.append(time)
    button.addEventListener('click', () => {
      bookingStatus.textContent = ''
      updateSelection(slot)
    })

    item.append(button)
    slotsList.append(item)
    if (slot.startsAt === focusedStart) {
      button.focus({ preventScroll: true })
    }
  }

  updateSelection(slots.find(({ startsAt }) => startsAt === selectedStart))
}

function clearAvailabilityRequest() {
  availabilityRequest = undefined
  calendar.inert = false
  calendar.removeAttribute('aria-busy')
  calendarStatus.textContent = ''
}

async function loadAvailability(eventType: EventType) {
  availabilityRequest?.controller.abort()
  const controller = new AbortController()
  availabilityRequest = { eventType, controller }
  confirmButton.disabled = true
  calendar.inert = !calendar.hidden && activeCalendar?.eventType !== eventType
  calendar.setAttribute('aria-busy', 'true')
  calendarStatus.textContent = calendar.hidden ? 'Загружаем свободное время…' : ''

  const { data } = await getEventTypeSlots({ path: { id: eventType.id }, signal: controller.signal })
  if (controller.signal.aborted) {
    return
  }

  clearAvailabilityRequest()
  if (!data) {
    if (activeCalendar?.eventType === eventType) {
      activeCalendar.availability = undefined
      slotsList.replaceChildren()
      slotsList.hidden = true
      slotsStatus.textContent = ''
      updateSelection()
    } else {
      updateSelection(selectedSlot)
    }

    calendarStatus.textContent = 'Не удалось загрузить свободное время.'
    return
  }

  const previousDay = daySelect.value
  const selectedStart = activeCalendar?.eventType === eventType ? selectedSlot?.startsAt : undefined
  activeCalendar = { eventType, availability: data }
  for (const button of list.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.value === eventType.id))
  }

  calendarHeading.textContent = `Свободное время — «${eventType.title}»`
  timeZoneLabel.textContent = `Часовой пояс — Москва (${data.timeZone}).`
  daySelect.replaceChildren(...data.days.map(({ date }) => {
    return new Option(formatCalendarDate.format(new Date(date)), date)
  }))
  if (previousDay && data.days.some(({ date }) => date === previousDay)) {
    daySelect.value = previousDay
  }

  renderSlots(data, selectedStart)
  calendar.hidden = false
}

daySelect.addEventListener('change', () => {
  bookingStatus.textContent = ''
  if (activeCalendar?.availability) {
    renderSlots(activeCalendar.availability)
  }
})

confirmButton.addEventListener('click', async () => {
  const view = activeCalendar
  const slot = selectedSlot
  if (!view?.availability || !slot || bookingPending) {
    return
  }

  const day = daySelect.value
  const { timeZone } = view.availability
  bookingPending = true
  confirmButton.disabled = true
  confirmation.hidden = true
  bookingStatus.textContent = ''

  const { data, error, response } = await createBooking({
    body: { eventTypeId: view.eventType.id, startsAt: slot.startsAt },
  })
  bookingPending = false

  const requestedType = availabilityRequest?.eventType ?? activeCalendar?.eventType
  const sameDay = activeCalendar === view && requestedType === view.eventType && daySelect.value === day
  const confirmed = response?.status === 201 && data
  const conflict = response?.status === 409 && error?.code === 'slot_taken'
  if (confirmed) {
    confirmationDetails.textContent = `«${data.eventTypeTitle}» — ${formatInterval(data, timeZone)}, Москва.`
    if (!rememberBooking(data.id)) {
      confirmationDetails.append(' Браузер не смог сохранить запись в разделе «Мои бронирования».')
    }

    confirmation.hidden = false
  }

  if (confirmed || conflict) {
    if (sameDay && selectedSlot === slot) {
      updateSelection()
    }

    if (conflict) {
      bookingStatus.textContent = sameDay
        ? error.message
        : `«${view.eventType.title}» — ${formatInterval(slot, timeZone)}, Москва. ${error.message}`
    }

    if (requestedType) {
      await loadAvailability(requestedType)
    }

    return
  }

  if (sameDay) {
    bookingStatus.textContent = 'Не удалось подтвердить запись. Попробуйте ещё раз.'
  }

  updateSelection(selectedSlot)
})

const { data: eventTypes } = await getEventTypes()

if (!eventTypes) {
  status.textContent = 'Не удалось загрузить типы встреч.'
} else if (!eventTypes.length) {
  status.textContent = 'Типов встреч пока нет.'
} else {
  for (const eventType of eventTypes) {
    const item = document.createElement('li')
    const title = document.createElement('h2')
    const description = document.createElement('p')
    const duration = document.createElement('p')
    const choose = document.createElement('button')

    title.textContent = eventType.title
    description.textContent = eventType.description
    duration.textContent = `${eventType.durationMinutes} мин.`
    choose.type = 'button'
    choose.value = eventType.id
    choose.setAttribute('aria-pressed', 'false')
    choose.textContent = `Выбрать «${eventType.title}»`
    choose.addEventListener('click', () => {
      if (availabilityRequest?.eventType === eventType) {
        return
      }

      if (activeCalendar?.eventType === eventType && activeCalendar.availability) {
        if (availabilityRequest) {
          availabilityRequest.controller.abort()
          clearAvailabilityRequest()
          updateSelection(selectedSlot)
        }

        return
      }

      bookingStatus.textContent = ''
      void loadAvailability(eventType)
    })
    item.append(title, description, duration, choose)
    list.append(item)
  }

  list.hidden = false
}
