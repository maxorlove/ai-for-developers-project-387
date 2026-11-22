# Правила проекта

- Бэкенд Fastify — `backend/`. Фронтенд Vite — `frontend/`.
- Установка зависимостей — `pnpm install --frozen-lockfile`.
- Локальный запуск в двух терминалах — `pnpm dev:backend` и `pnpm dev:frontend`.
- Все проверки локально и в GitHub Actions — `pnpm check`. По отдельности — `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Сборка фронтенда — `pnpm build`, только по явной просьбе пользователя. Новые тесты добавляйте только по явной просьбе пользователя.
- Используйте Conventional Commits. В коммите реализации указывайте номер тикета, например `feat: add booking form (#12)`.
- Перед слиянием проверьте весь дифф ветки относительно основной ветки и результаты CI.

## Контракт API

- Меняйте модели и операции в `api/main.tsp`, затем запускайте `pnpm api:generate`.
- Команда создаёт `api/generated/openapi.json` и TypeScript SDK в `api/generated/sdk/`, включая типы обработчиков Fastify из `fastify.gen.ts`. Маршруты регистрирует приложение Fastify. HTTP-тесты сверяют JSON-ответы с OpenAPI.
- Не редактируйте генерируемые файлы вручную. `pnpm check` запускает её до проверок, в том числе в GitHub Actions.

## Agent skills

The Matt Pocock skill set is installed in `.agents/skills/` for this project.

### Issue tracker

Use GitHub Issues for `maxorlove/ai-for-developers-project-387`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use the root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.
