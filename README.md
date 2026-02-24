# Komorebi

[English](./README.md) | [简体中文](./README.zh-CN.md)

A modern blog system built on **Next.js + Cloudflare Workers**, with **D1 / R2 / KV** as core infrastructure.

> Production-style architecture, editor-first workflow, and built-in Notion bidirectional sync + backup.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Cloudflare Deployment](#cloudflare-deployment)
- [Database & Migrations](#database--migrations)
- [Notion Sync](#notion-sync)
- [Backup & Restore](#backup--restore)
- [Observability](#observability)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- ✅ Next.js App Router + OpenNext for Cloudflare Workers
- ✅ D1-backed blog data layer
- ✅ R2 media storage and asset delivery
- ✅ KV cache for hot endpoints (search + version invalidation)
- ✅ Rich editor (TipTap) with publish/preview pipeline
- ✅ Structured logging + web vitals endpoint
- ✅ Notion bidirectional sync (blog → notion / notion → blog)
- ✅ Conflict detection + manual conflict resolution API
- ✅ R2 snapshot backup and restore API

---

## Tech Stack

- **Frontend / API**: Next.js 15 (App Router), React 18
- **Runtime**: Cloudflare Workers (OpenNext)
- **Database**: Cloudflare D1
- **Object Storage**: Cloudflare R2
- **Cache**: Cloudflare KV
- **Auth**: NextAuth (Google + credentials)
- **Editor**: TipTap
- **Validation**: Zod

---

## Architecture

```text
Browser
  │
  ▼
Cloudflare Worker (Next.js App + API)
  ├─ D1 (users/posts/tags/comments/sync tables)
  ├─ R2 (media + backup snapshots)
  ├─ KV (search cache + cache version)
  └─ Notion API (bidirectional sync)
```

Core flows:

1. **Publish flow**: editor -> write API -> D1 -> KV invalidation -> Notion sync
2. **Search flow**: API -> KV hit/miss -> D1 fallback -> cache write-back
3. **Notion inbound flow**: webhook -> sync_events (pending) -> consume -> blog update/conflict
4. **Backup flow**: admin API -> export published posts -> R2 snapshot

---

## Project Structure

```text
app/
  api/
    write/           # draft/publish pipeline
    notion/          # webhook + consumer
    admin/           # audit, conflicts, backup APIs
lib/
  prisma.ts          # D1 access layer
  post-service.ts    # post/tag write logic
  cf-cache.ts        # KV cache helper
  notion-sync.ts     # notion sync core
  backup.ts          # R2 backup/restore
  security.ts        # sanitization
  rate-limit.ts      # rate limiting
  obs.ts             # structured logging
d1/
  schema.sql
  migrations/
wrangler.jsonc       # cloudflare deployment config
```

---

## Quick Start

### 1) Install

```bash
cd /data/sinon_blog
pnpm install --frozen-lockfile
```

### 2) Configure env

```bash
cp .env.example .env
```

### 3) Run locally (Next dev)

```bash
pnpm dev
```

### 4) Run Worker preview

```bash
pnpm preview
# or dev env preview
pnpm preview:dev
```

---

## Environment Variables

Required:

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`
- `GOOGLE_ID`
- `GOOGLE_SECRET`

Notion sync:

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `NOTION_SYNC_TOKEN`

---

## Cloudflare Deployment

Deploy production:

```bash
pnpm deploy
```

Deploy dev environment:

```bash
pnpm deploy:dev
```

> `wrangler.jsonc` is the source of truth. Dashboard manual toggles may be overwritten on next deploy.

---

## Database & Migrations

Initialize schema:

```bash
# prod
wrangler d1 execute 1acc05d4-49bb-4306-8115-5646a945dc9c --remote --file=./d1/schema.sql

# dev
wrangler d1 execute b188ca51-b44e-48c5-8463-baf3091fc279 --remote --file=./d1/schema.sql
```

Apply migration:

```bash
wrangler d1 execute <DB_ID> --remote --file=./d1/migrations/<migration>.sql
```

---

## Notion Sync

### Blog -> Notion

Triggered by save/publish/toggle publish/delete flows.

### Notion -> Blog

1. Webhook ingest:

```http
POST /api/notion/webhook
```

2. Consume pending events:

```http
POST /api/notion/consume
x-sync-token: <NOTION_SYNC_TOKEN>
```

### Conflict Management (Admin)

- `GET /api/admin/sync/conflicts`
- `POST /api/admin/sync/conflicts`

Body:

```json
{ "postId": "<id>", "keep": "blog" }
```

or

```json
{ "postId": "<id>", "keep": "notion" }
```

---

## Backup & Restore

Backup (admin):

```http
POST /api/admin/backup/posts
```

List backups:

```http
GET /api/admin/backup/posts?limit=20
```

Restore:

```http
POST /api/admin/backup/posts
Content-Type: application/json

{ "action": "restore", "key": "backups/posts/YYYY-MM-DD/snapshot-xxx.json" }
```

---

## Observability

- Structured logs via `lib/obs.ts`
- Web vitals collector endpoint: `/api/metrics/web-vitals`
- Cloudflare observability should be enabled in `wrangler.jsonc` (`logs` + `traces`)

Useful commands:

```bash
pnpm exec wrangler tail --env dev
pnpm exec wrangler versions list --env dev
```

---

## Troubleshooting

### Publish fails with D1 transaction error

If you see `D1_ERROR ... BEGIN TRANSACTION`, ensure code does **not** issue manual `BEGIN/COMMIT/ROLLBACK`.

### Notion not syncing

Check in order:

1. `NOTION_TOKEN / NOTION_DATABASE_ID / NOTION_SYNC_TOKEN`
2. Database shared with integration
3. `sync_events` latest errors in D1
4. `sync_map.sync_state` (`ok` / `conflict` / `error`)

---

## Contributing

- Use `pnpm` only
- Keep migrations additive and explicit
- Update docs when API/contracts/ops flow changes
- Validate with `pnpm build` before merge

---

## License

Private project (no public OSS license declared yet).
