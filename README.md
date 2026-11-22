# Календарь звонков (продолжение)

[Открыть календарь звонков на Render](https://maxorlove-call-calendar.onrender.com/)

[![hexlet-check](https://github.com/maxorlove/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/maxorlove/ai-for-developers-project-387/actions)

Во второй части проекта автоматизируем работу над календарём в GitHub. Правила бронирования описаны в [исходной спецификации](https://github.com/maxorlove/ai-for-developers-project-386/issues/1). Принятые решения собраны в [карте первого проекта](https://github.com/maxorlove/ai-for-developers-project-386/issues/14). Выбор отдельной страницы записи зафиксирован в [архитектурном решении первого проекта](https://github.com/maxorlove/ai-for-developers-project-386/blob/09d9574b7145d01a2c6e97935a63e5b2fea8d86c/docs/adr/0001-booking-entrypoint.md).

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

## OpenCode в GitHub

Чтобы вызвать агента, начните новый комментарий в issue, обсуждении PR или у строки diff с `/oc` или `/opencode`. Например, `/oc explain this issue`. Workflow принимает команды владельца, участников организации и соавторов репозитория. Комментарии ботов и PR из форков пропускаются.

Установите [OpenCode GitHub App](https://github.com/apps/opencode-agent) для этого репозитория и добавьте ключ OpenAI в [Actions Secrets](https://github.com/maxorlove/ai-for-developers-project-387/settings/secrets/actions) под именем `OPEN_API_KEY`. Все модельные воркфлоу используют GPT-6.2 Sol. Интерактивные команды и триаж вызывают OpenCode, независимое ревью и аудит обращаются к OpenAI Responses API. Публикация сессий отключена (`share: false`). Агент читает правила из `AGENTS.md`, настройки трекера из `docs/agents/` и проектные скиллы из `.agents/skills/`.

Ответ появится в обсуждении. Ход выполнения и результат видны в [Actions → OpenCode](https://github.com/maxorlove/ai-for-developers-project-387/actions/workflows/opencode.yml). На одну задачу или PR одновременно работает один агент, до 15 минут.

### Автоматический разбор обращений

Когда владелец, участник организации или соавтор открывает issue, OpenCode сверяет обращение с кодом календаря и оставляет в обсуждении вопросы и следующий шаг. Для запуска достаточно открыть задачу. Workflow пропускает обращения ботов и тикеты, созданные с меткой `ready-for-agent` или `ready-for-human`. История запусков доступна в [Actions → Issue triage](https://github.com/maxorlove/ai-for-developers-project-387/actions/workflows/issue-triage.yml).

### Ревью pull request

В одном PR доступны два интерактивных вызова OpenCode суммарно в обсуждении и у строк диффа. Workflow считает начатые шаги модели по истории Actions, включая повторные запуски. Третий вызов оставляет комментарий с причиной `limit_exhausted`, SHA и журналом. При сбое проверьте причину `timeout`, `infra` или `agent_failed` и решите, как продолжить вручную.

При открытии и обновлении PR из этого репозитория отдельный workflow сверяет дифф с [правилами ревью](REVIEW.md). В описании PR укажите ссылки на обращение, решение владельца, спецификацию и тикеты. Ревьюер читает материалы с GitHub, публикует результат для head SHA и не расходует интерактивный лимит.

Перед слиянием откройте запуск **Project checks** с событием `pull_request` и скачайте артефакт `browser-<SHA>`. Сверьте `head-sha.txt` с последним коммитом PR. Откройте `index.html` для просмотра сценариев и трассировок. Слияние подтверждает владелец после проверки последней версии.

### Ежедневный аудит страницы записи

[Booking page audit](https://github.com/maxorlove/ai-for-developers-project-387/actions/workflows/calendar-audit.yml) запускается в 06:17 по Москве. Lighthouse открывает опубликованную страницу `/booking/`, проверяет успешный HTTP-ответ и наличие метаописания. Адрес по умолчанию ведёт на Render, его можно задать переменной Actions `APP_URL`.

В **Run workflow** выберите `main`. Без параметров workflow измерит страницу заново. Для повтора с теми же данными укажите ID успешного запуска в `report_run`. JSON Lighthouse доступен в артефакте `lighthouse` 14 дней. Вывод модели и ссылка на issue находятся в сводке запуска. Первая находка становится входящей задачей, а чистый результат оформляется как учебная задача. Повтор того же результата для той же страницы указывает на существующую задачу. При недоступности страницы запуск завершается ошибкой.

## Проверки

Перед первым запуском проверок установите Chromium для Playwright.

```bash
pnpm exec playwright install --only-shell chromium
pnpm check
```

Команда `pnpm check` генерирует контракт API и SDK, затем запускает линтер, проверку типов, HTTP-тесты и браузерные сценарии. GitHub Actions устанавливает Chromium и выполняет ту же команду при каждом push и в pull request.

## Самооценка работы с GitHub-агентом

- Короткий запрос с одним ожидаемым ответом позволил проверить подключение отдельно от реализации. По журналу отличили лимит бесплатной модели от пустого баланса API. После активации кредитов OpenCode ответил в задаче. [Первый запуск](https://github.com/maxorlove/ai-for-developers-project-387/actions/runs/45025842119) · [Успешный ответ](https://github.com/maxorlove/ai-for-developers-project-387/issues/3#issuecomment-7079707954)
- В отзыве на первый вариант аудита заметили, что модель могла сослаться на постороннюю задачу. Модель теперь объясняет наблюдение, а скрипт проверяет совпадение страницы и результата Lighthouse. Ручной запуск создал задачу о метаописании. Повтор с тем же отчётом сослался на неё. [Обсуждение](https://github.com/maxorlove/ai-for-developers-project-387/pull/14) · [Находка](https://github.com/maxorlove/ai-for-developers-project-387/issues/19) · [Повтор](https://github.com/maxorlove/ai-for-developers-project-387/actions/runs/45027437622)
- Для самостоятельной правки агенту нужен согласованный результат и способ его проверить. Разбили изменение формы на проверку и реализацию, чтобы увидеть ожидаемое падение перед исправлением. Сверку браузерного отчёта с последним коммитом и решение о слиянии оставили владельцу. [Спецификация](https://github.com/maxorlove/ai-for-developers-project-387/issues/20) · [Согласование](https://github.com/maxorlove/ai-for-developers-project-387/issues/17#issuecomment-7079803128)

<!-- Добавьте запись asciinema после реализации сценария бронирования -->

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
