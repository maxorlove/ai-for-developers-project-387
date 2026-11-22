import { createEventType, getEventTypes } from '../../api/generated/sdk/index.ts'
import { showUpcomingBookings } from './upcoming-bookings.ts'

const form = document.querySelector<HTMLFormElement>('#event-type-form')!
const status = document.querySelector<HTMLParagraphElement>('#event-type-status')!
const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
const catalog = document.querySelector<HTMLUListElement>('#owner-event-types')!
const catalogStatus = document.querySelector<HTMLParagraphElement>('#owner-catalog-status')!

async function showEventTypes() {
  const { data } = await getEventTypes()
  catalog.replaceChildren(...(data ?? []).map(({ title }) => {
    const item = document.createElement('li')
    item.textContent = title
    return item
  }))
  catalog.hidden = !data?.length
  catalogStatus.hidden = !catalog.hidden
  catalogStatus.textContent = data ? 'Типов встреч пока нет.' : 'Не удалось загрузить типы встреч.'
}

const initialCatalog = showEventTypes()

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const fields = new FormData(form)
  status.textContent = ''
  submit.disabled = true

  try {
    const { data, error } = await createEventType({
      body: {
        id: String(fields.get('id')),
        title: String(fields.get('title')),
        description: String(fields.get('description')),
        durationMinutes: Number(fields.get('durationMinutes')),
      },
    })

    if (!data) {
      status.textContent = error?.code === 'validation_error' || error?.code === 'event_type_exists'
        ? error.message
        : 'Не удалось создать тип встречи. Попробуйте ещё раз.'
      return
    }

    form.reset()
    status.textContent = `Тип встречи «${data.title}» создан.`
    await initialCatalog
    await showEventTypes()
  } finally {
    submit.disabled = false
  }
})

await showUpcomingBookings()
