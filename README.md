# Календарь звонков (продолжение)

[Открыть календарь звонков на Render](https://maxorlove-call-calendar.onrender.com/)

[![hexlet-check](https://github.com/maxorlove/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/maxorlove/ai-for-developers-project-387/actions)

Во второй части проекта автоматизируем работу над календарём в GitHub. Правила бронирования описаны в [исходной спецификации](https://github.com/maxorlove/ai-for-developers-project-386/issues/1). Выбор отдельной страницы записи зафиксирован в [архитектурном решении первого проекта](https://github.com/maxorlove/ai-for-developers-project-386/blob/09d9574b7145d01a2c6e97935a63e5b2fea8d86c/docs/adr/0001-booking-entrypoint.md).

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

- Бэкенд — Fastify и TypeScript.
- Фронтенд — Vite и TypeScript.

## Установка

Установите Node.js версии из `.node-version` и pnpm версии из поля `packageManager` в `package.json`.

```bash
git clone https://github.com/maxorlove/ai-for-developers-project-387.git
cd ai-for-developers-project-387
pnpm install --frozen-lockfile
pnpm api:generate
```

## Использование

Запустите команды в двух терминалах.

```bash
pnpm dev:backend
```

```bash
pnpm dev:frontend
```

Фронтенд доступен на http://localhost:5173. Бэкенд отвечает на http://127.0.0.1:3000/api/health.

Владелец календаря создаёт типы встреч и видит предстоящие записи на http://localhost:5173/owner/. Типы встреч появляются в гостевом каталоге на http://localhost:5173/booking/. При запуске доступны консультации на 15 и 30 минут. Добавленные владельцем типы встреч и записи хранятся в памяти до перезапуска бэкенда.

После подтверждения гость может открыть «Мои бронирования» из сообщения о записи или с главной страницы. На `/my-bookings/` видны предстоящие записи, подтверждённые в этом браузере. Если очистить данные сайта, гость потеряет свой список, а у владельца записи сохранятся до перезапуска сервера.

## Docker

```bash
docker build -t call-calendar .
docker run --rm -e PORT=8080 -p 8080:8080 call-calendar
```

В контейнере Fastify отдаёт страницы и API на одном порту. Откройте http://localhost:8080 для гостя или http://localhost:8080/owner/ для владельца. Проверка готовности — `GET /api/health`.

## Деплой на Render

Опубликованная версия первого проекта на Render использует `render.yaml` из ветки `codex/booking-day-picker`. Сервис собирается из корневого Dockerfile, слушает порт из `PORT` и отвечает на `/api/health`.

Для работы через Codex используйте шаблон `.codex/config.toml.example`. Скопируйте его в `.codex/config.toml` или добавьте из него блок в существующий файл. Из корня проекта запустите `codex mcp login render` и завершите вход через OAuth в браузере. Данные OAuth остаются в локальном хранилище Codex.

## Проверки

Перед первым запуском проверок установите Chromium для Playwright.

```bash
pnpm exec playwright install --only-shell chromium
pnpm check
```

Команда `pnpm check` генерирует контракт API и SDK, затем запускает линтер, проверку типов, HTTP-тесты и браузерные сценарии. GitHub Actions устанавливает Chromium и выполняет ту же команду при каждом push.

<!-- Добавьте запись asciinema после реализации сценария бронирования -->

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
