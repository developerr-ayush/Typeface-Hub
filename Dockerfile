# Typeface Hub: production image for running locally or on any Docker host.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# No database at build time: the migrate step skips itself and runs when the container starts.
RUN npx next build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
# Markdown for /docs, /about, /privacy, /terms and /changelog is read at runtime.
COPY --from=build /app/src/content ./src/content
COPY --from=build /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/.data && chown -R node:node /app/.data
USER node
EXPOSE 3000
# Apply database migrations, then start the server.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node_modules/.bin/next start"]
