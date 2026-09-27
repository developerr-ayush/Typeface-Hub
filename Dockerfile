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
# Icon sets for the icon font editor are also read at runtime.
COPY --from=build /app/src/data/icons ./src/data/icons
COPY --from=build /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/.data && chown -R node:node /app/.data
USER node
EXPOSE 3000
# Migrations, a generated AUTH_SECRET if none is set, then the server.
CMD ["node", "scripts/start.mjs"]
