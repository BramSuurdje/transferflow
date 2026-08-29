<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/da0efa98-e470-4b30-a14a-b5b4d72fd4ff" />

# Toss

A small file-sharing app: upload a file, pick how long it should stay online, and share a link. No sign-up, no accounts, no file bytes through the API.

Built as a TypeScript monorepo to practice real-world patterns—presigned object storage, Redis-backed lifecycle, multipart uploads, and a split web/API deployment.

## What it does

Someone lands on the home page, drops a file (up to 2 GB), and chooses **24 hours** or **7 days** retention. The app uploads the file, then sends them to a download page—the same page recipients see when they open the share link.

Recipients get a simple page with the file name, size, and time left. They click **Download** to fetch the file; nothing auto-downloads on page load. When retention ends, the file and its metadata are removed automatically.

One upload = one share link. Upload again if you want another link.

## How it works (high level)

```mermaid
sequenceDiagram
  participant Browser
  participant API
  participant Redis
  participant Storage as S3-compatible storage

  Browser->>API: Create share (metadata, retention)
  API->>Redis: Store pending share
  API-->>Browser: Presigned upload URL(s)
  Browser->>Storage: PUT file (direct, not via API)
  Browser->>API: Complete upload
  API->>Redis: Mark share ready
  Note over Browser,Storage: Later: recipient opens share link
  Browser->>API: Request download URL
  API-->>Browser: Short-lived presigned GET
  Browser->>Storage: Download file
  Note over API,Storage: On expiry: worker deletes object + Redis keys
```

The API never proxies file bodies. It only issues presigned URLs, stores share metadata in Redis, and runs background cleanup when shares expire.

## Technical highlights

These are the parts worth calling out if you are evaluating the codebase:

| Area | Approach |
|------|----------|
| **Upload path** | Browser uploads directly to object storage via presigned URLs; the API stays out of the data plane |
| **Large files** | Multipart S3 uploads for files > 8 MB (8 MB parts, 4 concurrent); smaller files use a single PUT |
| **Lifecycle** | Redis holds share metadata and an expiry index; a keyspace listener plus a sweeper fallback delete bucket objects when retention ends |
| **Abandoned uploads** | Pending shares expire after one hour so half-finished uploads do not linger in storage |
| **Downloads** | Presigned GET URLs are minted only when the user clicks Download (short TTL), not when the page loads |
| **Safety** | Executable and installer-like extensions are blocked at share creation |
| **Deployment** | Separate web and API services (e.g. on Coolify), CORS between origins, bucket CORS for browser PUTs |

Shared constants and types (retention, size limits, multipart thresholds) live in `packages/shared` so the web app and API stay aligned.

## Stack

- **Monorepo** — Turborepo, Bun workspaces
- **Web** — React, Vite, React Router, Tailwind, shared UI package
- **API** — Hono on Bun
- **Data** — Redis (metadata + expiry), S3-compatible object storage (Railway bucket or MinIO locally)
- **Language** — TypeScript throughout

## Repository layout

```
apps/
  api/     Hono API: shares, presigning, expiry workers
  web/     React SPA: upload UI, download page (/d/:id)
  raycast/ Raycast extension: upload Finder selection, copy share link
packages/
  shared/  Shared types and limits
  ui/      Reusable UI components (shadcn-style)
```

Domain language and product decisions (what a “share” is, retention rules, etc.) are documented in [CONTEXT.md](./CONTEXT.md).

## Try it locally

Requires Docker (Redis + MinIO), Bun, and env files from the examples.

```bash
docker compose --profile storage up -d redis minio minio-init
cp apps/api/.env.example apps/api/.env
bun install
bun run dev
```

Open http://localhost:5173 — the Vite dev server proxies API routes to the backend on port 3001.

## Self-host with Docker

Runs the web app, API, Redis, and optional local MinIO from this repo.

```bash
cp .env.example .env
docker compose --profile storage up --build
```

The API container always connects to Redis at `redis://redis:6379`. `REDIS_PORT` in `.env` only changes the port exposed on your host — do not put that port in `REDIS_URL` for Docker.

Inside Docker the API always listens on **3001**; use `API_PORT` to choose the host-facing port. The browser talks to the API directly (`VITE_API_URL`, default `http://localhost:3001`), so CORS on the API (`WEB_ORIGIN`) must match the web origin.

Open http://localhost:8080.

### Caddy (public HTTPS, two hostnames)

Run Caddy on the host. If Caddy is on the same machine, set `WEB_HOST` / `API_HOST` to `127.0.0.1` in `.env`; leave `0.0.0.0` if Caddy is on another host. Build the web image with the public API origin:

```bash
# in .env
VITE_API_URL=https://api.toss.bramsuurd.nl
WEB_ORIGIN=https://toss.bramsuurd.nl

docker compose --profile storage up -d --build
```

See [deploy/Caddyfile.example](./deploy/Caddyfile.example) — one site block per hostname. Reload Caddy after editing.

`minio-init` creates the bucket. Community MinIO CORS is global — set `MINIO_API_CORS_ALLOW_ORIGIN` in `.env` (defaults include :8080 and :5173). For Railway, Coolify MinIO, or other S3 providers, run `cd apps/api && bun run configure-cors` after deploy.

For local dev, only infrastructure: `docker compose --profile storage up -d redis minio minio-init` (same as above without building `web` / `api`).

## Deploy on Coolify

Two applications from the same Git repo, plus Redis and S3-compatible storage. Coolify assigns the domains and TLS; the browser calls the API cross-origin.

DNS: `toss.bramsuurd.nl` and `api.toss.bramsuurd.nl` should both point at the Coolify server (A/AAAA or CNAME).

### 1. Redis

Add a Redis database in the same Coolify project. Copy its internal URL for `REDIS_URL` on the API.

### 2. API application

- **Build pack:** Dockerfile
- **Base directory:** `/`
- **Dockerfile location:** `/apps/api/Dockerfile`
- **Port:** `3001`
- **Domain:** `https://api.toss.bramsuurd.nl`
- **Health check path:** `/health`

Nixpacks equivalent (if you skip the Dockerfile):

| Step | Command |
|------|---------|
| Install | `bun install` |
| Build | `bun run --filter=api build` |
| Start | `bun run --filter=api start` |

Environment (runtime):

```bash
PORT=3001
WEB_ORIGIN=https://toss.bramsuurd.nl
REDIS_URL=redis://<coolify-redis-host>:6379
S3_ENDPOINT=https://<your-s3-endpoint>
S3_PUBLIC_ENDPOINT=https://<browser-reachable-s3-endpoint>
S3_REGION=auto
S3_BUCKET=file-shares
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
# S3_FORCE_PATH_STYLE=true   # MinIO; omit for virtual-hosted (Railway buckets)
ENABLE_KEYSPACE_EXPIRY=true
EXPIRY_SWEEPER_INTERVAL_MS=60000
# INTERNAL_API_KEY=          # optional
```

Enable Redis keyspace notifications (`notify-keyspace-events Ex`) if the expiry worker should delete objects immediately. Otherwise the sweeper interval is the fallback.

### 3. Web application

- **Build pack:** Dockerfile
- **Base directory:** `/`
- **Dockerfile location:** `/apps/web/Dockerfile`
- **Port:** `8080`
- **Domain:** `https://toss.bramsuurd.nl`
- **Health check path:** `/health`

Nixpacks / static equivalent:

| Step | Command |
|------|---------|
| Install | `bun install` |
| Build | `bun run --filter=web build` |
| Start | `bunx serve apps/web/dist -s -l 8080` |

Or Coolify **static** build pack: publish directory `/apps/web/dist`, SPA mode on.

Build-time environment (Coolify: mark **Available at Buildtime** — Vite inlines this):

```bash
VITE_API_URL=https://api.toss.bramsuurd.nl
```

Rebuild the web app whenever `VITE_API_URL` changes.

### 4. Bucket CORS

After the API is up, from a machine that can reach the bucket:

```bash
cd apps/api
# WEB_ORIGIN and S3_* in apps/api/.env
bun run configure-cors
```

Community MinIO has no per-bucket CORS — set `MINIO_API_CORS_ALLOW_ORIGIN=https://toss.bramsuurd.nl` instead.

### 5. Raycast

Web App URL: `https://toss.bramsuurd.nl`. The extension derives `https://api.toss.bramsuurd.nl` automatically. Locally, `http://localhost:5173` still maps to `http://localhost:3001`.
