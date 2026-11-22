FROM node:24.22.3-bookworm-slim AS base
WORKDIR /app

FROM base AS tooling
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./

FROM tooling AS frontend
RUN pnpm install --frozen-lockfile
COPY api ./api
COPY frontend ./frontend
COPY openapi-ts.config.ts tsconfig.json ./
RUN pnpm api:generate && pnpm build

FROM tooling AS production-dependencies
RUN pnpm install --prod --frozen-lockfile

FROM base AS production
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY backend ./backend
COPY --from=frontend /app/frontend/dist ./frontend/dist
USER node
EXPOSE 3000
CMD ["node", "backend/production.ts"]
