# Toss

Anonymous file transfers: upload a file, pick how long it lives (24 hours or 7 days), get a shareable link. No accounts or authentication.

## Language

**Share**:
A single uploaded file exposed at one public link until its retention period ends.
_Avoid_: Send, package (product name is Toss; domain object remains **Share**)

**Share link**:
The public URL for a Share, identified by a CUID in the path.
_Avoid_: Download link, token

**Retention**:
How long a Share stays available before it is deleted. Exactly two options: 24 hours or 7 days.
_Avoid_: TTL, expiry (use in code; prefer Retention in product language)

**Size limit**:
Maximum file size per Share. Fixed at 2 GB; enforced when creating a Share, before presigned upload.
_Avoid_: Quota, cap (fine in API errors)

**API**:
The Hono backend in `apps/api` that owns uploads, downloads, Redis metadata, and bucket object lifecycle.
_Avoid_: Server, backend (fine in code comments)

**Upload**:
The client sends file bytes directly to object storage via a presigned URL; the API never proxies the file body.
_Avoid_: Direct upload (ambiguous — could mean browser-to-API)

**Expiry**:
When **Retention** ends, the Share metadata is removed from Redis and the object is deleted from the bucket.
_Avoid_: TTL cleanup (implementation detail)

**Expiry worker**:
Process that deletes bucket objects when Shares expire. Primary: Redis keyspace notifications on key expiry. Fallback: periodic sweeper over expiry index if keyspace events are unavailable.
_Avoid_: Cron job (fine in code comments)

**Download page**:
The public page at `/d/{cuid}` in the web app. Shows file name, size, time remaining, and a download action. Expired or unknown links show a clear empty/error state—not an instant browser download.
_Avoid_: Share page, landing page

**Upload limits (abuse)**:
None at launch. No per-IP rate limits or CAPTCHA; may add later if needed.
_Avoid_: Rate limiting (not applicable in v1)

**Post-upload**:
After a successful upload, the uploader is redirected to the **Download page** for that Share—the same view recipients will see.
_Avoid_: Success screen, confirmation page

**Allowed file types**:
All file types are allowed within the **Size limit**.
_Avoid_: Allowlist, MIME whitelist

**Web app** / **API** (deployment):
Separate Railway services on separate public hostnames (e.g. `app.*` and `api.*`). Share links live on the **Web app** origin (`/d/{cuid}`). The browser calls the **API** cross-origin with CORS.
_Avoid_: Frontend, backend (fine in repo paths)

**Download action**:
The presigned GET URL is created only when the user clicks Download—not when the **Download page** loads. URLs are short-lived (on the order of minutes).
_Avoid_: Download link, direct link

**Deletion**:
Shares are removed only when **Retention** ends. There is no manual delete in v1.
_Avoid_: Revoke, unpublish

## Relationships

- One **Share** has exactly one **Share link** and one file in object storage
- **Upload** is presigned: the API mints the URL and records metadata; the browser PUTs to the bucket
- **Expiry** removes both Redis metadata and the bucket object via the **Expiry worker**
- Opening a **Share link** goes to the **Download page** in the web app, not a raw file redirect
- After upload, the uploader gets **Post-upload** (redirect to that Share’s **Download page**)
- **Retention** is chosen at upload time and drives automatic deletion
- The Vite web app talks only to the **API**; it never holds bucket or Redis credentials

## Example dialogue

> **Dev:** "User uploads two files in one go — one link or two?"
> **Domain expert:** "One file, one Share link. They upload again if they want another link."
>
> **Dev:** "Should the link start downloading immediately?"
> **Domain expert:** "No—show a simple page with the file name and a Download button. If it's expired, say so clearly."
>
> **Dev:** "After upload, stay on the home page or send them to that download page?"
> **Domain expert:** "Send them to the download page so they see what they're sharing. Link to upload another from there."

## Flagged ambiguities

- (none)

## Resolved decisions

- One file per **Share**; a new upload always means a new **Share link**
- Each Share’s file must be ≤ **Size limit** (2 GB)
- **Expiry worker**: keyspace notifications first; ZSET + interval sweeper if Railway Redis blocks `notify-keyspace-events`
- Incomplete uploads use a short-lived pending key (e.g. 1 hour) so abandoned presigns do not fill the bucket
- No upload rate limits in v1
- All file types are allowed before presigned **Upload** is issued
- **Web app** and **API** are different origins in production; local dev uses Vite proxy to the API
- **Download action** mints a presigned URL on demand; metadata fetch does not include a download URL
- **Deletion** is automatic via **Expiry** only; no uploader delete in v1
