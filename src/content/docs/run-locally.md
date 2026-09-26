---
title: Run locally
description: Run Typeface Hub on your own machine with Docker, or with Node and Postgres.
---

# Run locally

## With Docker (recommended)

You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/). Make sure it is running (`docker info` should not show a connection error), then from the project folder:

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) and create an account. The first build takes a few minutes; later starts take seconds with `docker compose up`.

What you get:

- a Postgres 16 container, with the schema created automatically when the app starts
- the app on port 3000
- two volumes that survive restarts: `db-data` (database) and `font-files` (uploaded masters and generated files)

| Command | What it does |
| --- | --- |
| `docker compose up --build` | Build and start everything |
| `docker compose down` | Stop, keeping your data |
| `docker compose down -v` | Stop and **delete** the database and font files |
| `docker compose up db` | Run only Postgres (for `npm run dev`) |

To change settings, create a `.env` file next to `docker-compose.yml`:

```bash
AUTH_SECRET=a-long-random-string
GOOGLE_FONTS_API_KEY=optional
APP_URL=http://localhost:3000
```

## With Node and Postgres

Requirements: Node 20.9 or newer and a Postgres database.

```bash
npm install
cp .env.example .env        # set DATABASE_URL and AUTH_SECRET
npm run db:migrate          # create the schema
npm run dev                 # http://localhost:3000
```

Without `BLOB_READ_WRITE_TOKEN`, files are stored in `./.data/storage`.

To use Postgres from Docker with `npm run dev`, run `docker compose up db` and set:

```bash
DATABASE_URL=postgres://typeface:typeface@localhost:5432/typeface_hub
```

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | TypeScript type-check |
| `npm run build` | Run migrations, then a production build |
| `npm run db:generate` | Create a migration after editing `src/lib/db/schema.ts` |
| `npm run catalog:build` | Refresh the bundled Google Fonts catalogue |

## Troubleshooting

- **`failed to connect to the docker API`**: Docker Desktop is not running. Open it (`open -a Docker` on macOS) and wait until it has started.
- **Port 3000 or 5432 already in use**: stop the other process, or change the left-hand port in `docker-compose.yml`, for example `"3001:3000"`.
- More in [Troubleshooting](/docs/troubleshooting).
