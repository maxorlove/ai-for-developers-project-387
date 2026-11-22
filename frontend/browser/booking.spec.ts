import { resolve } from 'node:path'
import { expect, test as base } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { createServer } from 'vite'
import { createApp } from '../../backend/app.ts'

const test = base.extend({
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires object destructuring for fixture dependencies.
  async baseURL({}, use) {
    const backend = createApp({ clock: () => new Date('2026-11-20T20:59:59.999Z') })
    try {
      const backendURL = await backend.listen({ host: '127.0.0.1', port: 0 })
      const frontend = await createServer({
        root: resolve(import.meta.dirname, '..'),
        server: {
          host: '127.0.0.1',
          port: 0,
          hmr: false,
          proxy: { '/api': backendURL },
        },
      })
      try {
        await frontend.listen()
        const address = frontend.httpServer?.address()
        if (!address || typeof address === 'string') {
          throw new Error('Vite did not open a TCP port')
        }

        await use(`http://127.0.0.1:${address.port}`)
      } finally {
        await frontend.close()
      }
    } finally {
      await backend.close()
    }
  },
})

async function createEventType(request: APIRequestContext, id: string, title: string, durationMinutes: number) {
  const response = await request.post('/api/event-types', {
    data: { id, title, description: 'Встреча по записи', durationMinutes },
  })
  expect(response.status()).toBe(201)
}

test('a guest can return home from an empty catalogue', async ({ page }) => {
  await page.route('**/api/event-types', (route) => route.fulfill({ json: [] }))
  await page.goto('/')
  await page.getByRole('link', { name: 'Записаться на звонок' }).click()
  await expect(page.getByText('Типов встреч пока нет.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Типы встреч' })).toBeHidden()

  await page.getByRole('link', { name: 'На главную' }).click()
  await expect(page.getByRole('heading', { name: 'Календарь звонков' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Записаться на звонок' })).toBeVisible()
})

test('the three home actions share a button style and fit desktop and mobile screens', async ({ page }) => {
  await page.goto('/')
  const links = page.getByRole('navigation', { name: 'Разделы календаря' }).getByRole('link')
  await expect(links).toHaveText(['Записаться на звонок', 'Мои бронирования', 'Кабинет владельца'])
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 })
    const reference = await links.first().evaluate((link) => {
      const style = getComputedStyle(link)
      return { background: style.backgroundColor, radius: style.borderRadius }
    })
    expect(reference.background).not.toBe('rgba(0, 0, 0, 0)')
    for (const link of await links.all()) {
      await expect(link).toHaveCSS('background-color', reference.background)
      await expect(link).toHaveCSS('border-radius', reference.radius)
      const bounds = (await link.boundingBox())!
      expect(bounds.height).toBeGreaterThanOrEqual(44)
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    }
  }
})

test('both default consultations are visible to the owner and can be booked at their advertised length', async ({ page }) => {
  await page.goto('/owner/')
  const types = page.getByRole('region', { name: 'Типы встреч' })
  await expect(types.getByRole('listitem')).toHaveText(['Консультация 15 мин', 'Консультация 30 мин'])

  for (const [duration, start, end] of [[15, '09:00', '09:15'], [30, '09:30', '10:00']] as const) {
    await page.goto('/booking/')
    await page.getByRole('button', { name: `Выбрать «Консультация ${duration} мин»` }).click()
    await page.getByRole('button', { name: start, exact: true }).click()
    await page.getByRole('button', { name: 'Подтвердить запись' }).click()
    const confirmation = page.getByRole('region', { name: 'Запись подтверждена' })
    await expect(confirmation).toContainText(`Консультация ${duration} мин`)
    await expect(confirmation).toContainText(`${start}–${end}`)
  }
})

test('a guest keeps the calendar and selected day when switching meeting types', async ({ page, request }) => {
  await createEventType(request, 'consultation', 'Консультация', 30)
  await createEventType(request, 'intro', 'Знакомство', 15)
  const slotRequests: string[] = []
  page.on('request', (browserRequest) => {
    const path = new URL(browserRequest.url()).pathname
    if (path.startsWith('/api/event-types/') && path.endsWith('/slots')) {
      slotRequests.push(path)
    }
  })

  await page.goto('/booking/')
  const consultation = page.getByRole('button', { name: 'Выбрать «Консультация»' })
  const intro = page.getByRole('button', { name: 'Выбрать «Знакомство»' })
  const calendar = page.locator('#booking-calendar')
  const day = page.getByLabel('День')
  const slot = page.getByRole('button', { name: '09:00', exact: true })

  await consultation.click()
  await expect(consultation).toHaveAttribute('aria-pressed', 'true')
  await day.selectOption('2026-11-23')
  await slot.click()
  await consultation.click()
  await expect(calendar).toBeVisible()
  await expect(slot).toHaveAttribute('aria-pressed', 'true')
  await expect(day).toHaveValue('2026-11-23')

  const { promise: waitForRelease, resolve: release } = Promise.withResolvers<void>()
  await page.route('**/api/event-types/intro/slots', async (route) => {
    await waitForRelease
    await route.continue()
  })
  try {
    await intro.click()
    await expect(calendar).toHaveAttribute('aria-busy', 'true')
    await expect(calendar).toBeVisible()
    await expect(calendar.locator('h2')).toHaveText('Свободное время — «Консультация»')
    await intro.click()
    await expect(calendar).toBeVisible()
  } finally {
    release()
  }

  await expect(intro).toHaveAttribute('aria-pressed', 'true')
  await expect(consultation).toHaveAttribute('aria-pressed', 'false')
  await expect(calendar.getByRole('heading')).toHaveText('Свободное время — «Знакомство»')
  await expect(day).toHaveValue('2026-11-23')
  await expect(slot).toHaveAttribute('aria-pressed', 'false')
  expect(slotRequests).toEqual(['/api/event-types/consultation/slots', '/api/event-types/intro/slots'])
})

test('a guest can retry a failed switch without losing the current meeting type', async ({ page, request }) => {
  await createEventType(request, 'consultation', 'Консультация', 30)
  await createEventType(request, 'intro', 'Знакомство', 15)
  await page.route('**/api/event-types/intro/slots', (route) => route.fulfill({
    status: 503,
    json: { message: 'Temporarily unavailable' },
  }), { times: 1 })

  await page.goto('/booking/')
  const consultation = page.getByRole('button', { name: 'Выбрать «Консультация»' })
  const intro = page.getByRole('button', { name: 'Выбрать «Знакомство»' })
  const slot = page.getByRole('button', { name: '09:00', exact: true })
  await consultation.click()
  await slot.click()

  await intro.click()
  await expect(page.getByText('Не удалось загрузить свободное время.')).toBeVisible()
  await expect(consultation).toHaveAttribute('aria-pressed', 'true')
  await expect(slot).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Подтвердить запись' })).toBeEnabled()

  await intro.click()
  await expect(intro).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Не удалось загрузить свободное время.')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Подтвердить запись' })).toBeHidden()
})

test('a guest can choose another day when all slots are taken', async ({ page, request }) => {
  await createEventType(request, 'full-day', 'Встреча на весь день', 540)
  const booking = await request.post('/api/bookings', {
    data: { eventTypeId: 'full-day', startsAt: '2026-11-22T09:00:00+03:00' },
  })
  expect(booking.status()).toBe(201)

  await page.goto('/booking/')
  await page.getByRole('button', { name: 'Выбрать «Встреча на весь день»' }).click()
  const day = page.getByLabel('День')
  await day.selectOption('2026-11-22')
  await expect(page.getByText('На этот день нет свободных слотов.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Свободные слоты' })).toBeHidden()

  await day.selectOption('2026-11-23')
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toBeVisible()
  await expect(page.getByText('На этот день нет свободных слотов.')).toBeHidden()
})

test('an owner can correct a duplicate meeting type id', async ({ page, request }) => {
  await createEventType(request, 'intro', 'Знакомство', 15)
  await page.goto('/owner/')
  const id = page.getByLabel('Идентификатор')
  const create = page.getByRole('button', { name: 'Создать тип встречи' })
  await id.fill('intro')
  await page.getByLabel('Название').fill('Консультация')
  await page.getByLabel('Описание').fill('Звонок по записи')
  await page.getByLabel('Длительность, мин.').fill('30')
  await create.click()
  await expect(page.getByText('Тип встречи с таким идентификатором уже существует.')).toBeVisible()

  await id.fill('consultation')
  await create.click()
  await expect(page.getByText('Тип встречи «Консультация» создан.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Типы встреч' }).getByRole('listitem')).toHaveText([
    'Консультация 15 мин', 'Консультация 30 мин', 'Знакомство', 'Консультация',
  ])
})

test('a guest books a call and the owner sees the same meeting', async ({ page, context }) => {
  const owner = await context.newPage()
  await owner.goto('/')
  await owner.getByRole('link', { name: 'Кабинет владельца' }).click()
  const upcoming = owner.getByRole('region', { name: 'Предстоящие записи' })
  await expect(upcoming.getByRole('status')).toHaveText('Предстоящих записей пока нет.')
  await owner.getByLabel('Идентификатор').fill('intro')
  await owner.getByLabel('Название').fill('Знакомство')
  await owner.getByLabel('Описание').fill('Вводный звонок')
  await owner.getByLabel('Длительность, мин.').fill('30')
  await owner.getByRole('button', { name: 'Создать тип встречи' }).click()
  await expect(owner.getByText('Тип встречи «Знакомство» создан.')).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'Записаться на звонок' }).click()
  await expect(page).toHaveURL(/\/booking\/$/)
  await page.getByRole('button', { name: 'Выбрать «Знакомство»' }).click()
  await page.getByLabel('День').selectOption('2026-11-22')
  await page.getByRole('button', { name: '10:00', exact: true }).click()
  const topic = '📞'.repeat(200)
  const topicInput = page.getByLabel('Тема звонка')
  await expect(page.getByText('До 200 символов', { exact: true })).toBeVisible()
  await expect(topicInput).toHaveAccessibleDescription('До 200 символов')
  await topicInput.fill(topic + 'я')
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(topicInput).toBeFocused()
  await expect(page.getByRole('region', { name: 'Запись подтверждена' })).toBeHidden()
  await topicInput.fill(topic)
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  const details = /Знакомство.*22 ноября.*10:00–10:30.*Москва/
  const confirmation = page.getByRole('region', { name: 'Запись подтверждена' })
  await expect(confirmation).toContainText(details)
  await expect(confirmation).not.toContainText(topic)

  await owner.reload()
  await expect(upcoming.getByRole('listitem')).toHaveText(details)
  await expect(upcoming.getByRole('listitem')).toContainText(topic)

  await confirmation.getByRole('link', { name: 'Мои бронирования' }).click()
  await expect(page.getByRole('listitem')).toHaveText(details)
  await expect(page.getByRole('listitem')).toContainText(topic)
  await page.getByRole('link', { name: 'Записаться на звонок' }).click()
  await page.getByRole('button', { name: 'Выбрать «Знакомство»' }).click()
  await page.getByLabel('День').selectOption('2026-11-21')
  await page.getByRole('button', { name: '09:00', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()
  const earlier = /Знакомство.*21 ноября.*09:00–09:30.*Москва/
  await expect(confirmation).toContainText(earlier)
  await page.getByRole('link', { name: 'На главную' }).click()
  await page.getByRole('link', { name: 'Мои бронирования' }).click()
  await expect(page.getByRole('listitem')).toHaveText([earlier, details])
})

test('the guest can distinguish a failed booking list request from an empty list', async ({ page }) => {
  await page.route('**/api/bookings', (route) => route.fulfill({ status: 503 }), { times: 1 })
  await page.goto('/my-bookings/')
  await expect(page.getByRole('status')).toHaveText('Не удалось загрузить записи.')
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('Предстоящих записей пока нет.')
})

test('a confirmed booking survives a failure to save it in the guest browser', async ({ page, request }) => {
  await createEventType(request, 'intro', 'Знакомство', 30)
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable', 'QuotaExceededError') }
  })
  await page.goto('/booking/')
  await page.getByRole('button', { name: 'Выбрать «Знакомство»' }).click()
  await page.getByRole('button', { name: '09:00', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  const confirmation = page.getByRole('region', { name: 'Запись подтверждена' })
  await expect(confirmation).toContainText('Браузер не смог сохранить запись')
  await confirmation.getByRole('link', { name: 'Мои бронирования' }).click()
  await expect(page.getByRole('status')).toHaveText('Предстоящих записей пока нет.')
  await page.goto('/owner/')
  await expect(page.getByRole('region', { name: 'Предстоящие записи' }).getByRole('listitem')).toHaveText(/Знакомство.*09:00–09:30/)
})

test('an offline booking appears in both lists only after a successful retry', async ({ page, context }) => {
  await page.goto('/booking/')
  await page.getByRole('button', { name: 'Выбрать «Консультация 15 мин»' }).click()
  await page.getByRole('button', { name: '09:00', exact: true }).click()
  const confirm = page.getByRole('button', { name: 'Подтвердить запись' })
  const confirmation = page.getByRole('region', { name: 'Запись подтверждена' })
  await context.setOffline(true)
  try {
    await confirm.click()
    await expect(page.getByRole('alert')).toHaveText('Не удалось подтвердить запись. Попробуйте ещё раз.')
    await expect(confirmation).toBeHidden()
  } finally {
    await context.setOffline(false)
  }

  const guest = await context.newPage()
  await guest.goto('/my-bookings/')
  const owner = await context.newPage()
  await owner.goto('/owner/')
  const upcoming = owner.getByRole('region', { name: 'Предстоящие записи' })
  await expect(guest.getByRole('status')).toHaveText('Предстоящих записей пока нет.')
  await expect(upcoming.getByRole('status')).toHaveText('Предстоящих записей пока нет.')

  await confirm.click()
  const details = /Консультация 15 мин.*21 ноября.*09:00–09:15.*Москва/
  await expect(confirmation).toContainText(details)
  await guest.reload()
  await owner.reload()
  await expect(guest.getByRole('listitem')).toHaveText([details])
  await expect(upcoming.getByRole('listitem')).toHaveText([details])
})

test('a guest sees updated slots when another guest books the selected time', async ({ page, request }) => {
  const eventType = await request.post('/api/event-types', {
    data: { id: 'brief', title: 'Краткий звонок', description: 'Короткая встреча', durationMinutes: 30 },
  })
  expect(eventType.status()).toBe(201)

  await page.goto('/booking/')
  await page.getByRole('button', { name: 'Выбрать «Краткий звонок»' }).click()
  const day = page.getByLabel('День')
  await day.selectOption('2026-11-22')
  const slots = page.getByRole('list', { name: 'Свободные слоты' })
  const selected = slots.getByRole('button', { name: '10:00', exact: true })
  await selected.click()

  const booking = await request.post('/api/bookings', {
    data: { eventTypeId: 'brief', startsAt: '2026-11-22T10:00:00+03:00' },
  })
  expect(booking.status()).toBe(201)
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  await expect(page.getByRole('alert')).toHaveText('Это время уже занято. Выберите другой слот.')
  await expect(selected).toHaveCount(0)
  await expect(day).toHaveValue('2026-11-22')
  await expect(slots.getByRole('button', { name: '10:30', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Запись подтверждена' })).toBeHidden()
})

test('guests see their own bookings after a conflict and the owner sees both', async ({ page, context, browser, baseURL }) => {
  const owner = await context.newPage()
  const guestContext = await browser.newContext({ baseURL })
  const secondGuest = await guestContext.newPage()
  await owner.goto('/owner/')
  for (const meeting of [
    { id: 'consultation', title: 'Консультация', minutes: '60' },
    { id: 'intro', title: 'Знакомство', minutes: '30' },
  ]) {
    await owner.getByLabel('Идентификатор').fill(meeting.id)
    await owner.getByLabel('Название').fill(meeting.title)
    await owner.getByLabel('Описание').fill('Звонок по записи')
    await owner.getByLabel('Длительность, мин.').fill(meeting.minutes)
    await owner.getByRole('button', { name: 'Создать тип встречи' }).click()
    await expect(owner.getByText(`Тип встречи «${meeting.title}» создан.`)).toBeVisible()
  }

  await page.goto('/')
  await page.getByRole('link', { name: 'Записаться на звонок' }).click()
  await page.getByRole('button', { name: 'Выбрать «Консультация»' }).click()
  await page.getByLabel('День').selectOption('2026-11-23')
  await page.getByRole('button', { name: '10:00', exact: true }).click()

  await secondGuest.goto('/booking/')
  await secondGuest.getByRole('button', { name: 'Выбрать «Знакомство»' }).click()
  const day = secondGuest.getByLabel('День')
  await day.selectOption('2026-11-23')
  const overlappingSlot = secondGuest.getByRole('button', { name: '10:30', exact: true })
  await overlappingSlot.click()
  await page.getByLabel('Тема звонка').fill('Первая тема')
  await secondGuest.getByLabel('Тема звонка').fill('Вторая тема')

  const consultation = /Консультация.*23 ноября.*10:00–11:00.*Москва/
  const intro = /Знакомство.*23 ноября.*11:00–11:30.*Москва/
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(page.getByRole('region', { name: 'Запись подтверждена' })).toContainText(consultation)

  const confirm = secondGuest.getByRole('button', { name: 'Подтвердить запись' })
  await confirm.click()
  await expect(secondGuest.getByRole('alert')).toHaveText('Это время уже занято. Выберите другой слот.')
  await expect(overlappingSlot).toHaveCount(0)
  await owner.reload()
  const ownerRows = owner.getByRole('region', { name: 'Предстоящие записи' }).getByRole('listitem')
  await expect(ownerRows).toHaveCount(1)
  await expect(ownerRows).toContainText('Первая тема')
  await expect(ownerRows).not.toContainText('Вторая тема')
  await expect(day).toHaveValue('2026-11-23')

  const secondGuestBookings = await guestContext.newPage()
  await secondGuestBookings.goto('/my-bookings/')
  await expect(secondGuestBookings.getByRole('status')).toHaveText('Предстоящих записей пока нет.')

  await secondGuest.getByRole('button', { name: '11:00', exact: true }).click()
  await confirm.click()
  await expect(secondGuest.getByRole('region', { name: 'Запись подтверждена' })).toContainText(intro)

  await owner.reload()
  const bookings = owner.getByRole('region', { name: 'Предстоящие записи' }).getByRole('listitem')
  await expect(bookings).toHaveText([consultation, intro])

  await page.getByRole('link', { name: 'Мои бронирования' }).click()
  await expect(page.getByRole('listitem')).toHaveText([consultation])
  await secondGuestBookings.reload()
  await expect(secondGuestBookings.getByRole('listitem')).toHaveText([intro])
  await guestContext.close()
})
