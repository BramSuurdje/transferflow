export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024

/** S3 multipart object maximum; used when internal API key bypass is active. */
export const INTERNAL_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024 * 1024

export const INTERNAL_API_KEY_QUERY_PARAM = "k"
export const INTERNAL_API_KEY_HEADER = "x-toss-key"

export const RETENTION_OPTIONS = [
  "15m",
  "30m",
  "1h",
  "3h",
  "12h",
  "24h",
  "3d",
  "7d",
] as const
export type Retention = (typeof RETENTION_OPTIONS)[number]

export const RETENTION_LABELS: Record<Retention, string> = {
  "15m": "15 min",
  "30m": "30 min",
  "1h": "1 hour",
  "3h": "3 hours",
  "12h": "12 hours",
  "24h": "24 hours",
  "3d": "3 days",
  "7d": "7 days",
}

export const RETENTION_SECONDS: Record<Retention, number> = {
  "15m": 15 * 60,
  "30m": 30 * 60,
  "1h": 60 * 60,
  "3h": 3 * 60 * 60,
  "12h": 12 * 60 * 60,
  "24h": 24 * 60 * 60,
  "3d": 3 * 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
}

export const GITHUB_URL = "https://github.com/BramSuurdje/transferflow"
export const BRAM_SUURD_URL =
  "https://bramsuurd.nl?utm_source=toss&utm_medium=footer&utm_campaign=attribution"

export const PENDING_UPLOAD_TTL_SECONDS = 60 * 60
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60

export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024
export const MULTIPART_UPLOAD_CONCURRENCY = 4

export type ShareStatus = "pending" | "ready"
export type UploadMode = "single" | "multipart"

export type CompletedPart = {
  partNumber: number
  etag: string
}

export type ShareRecord = {
  id: string
  status: ShareStatus
  filename: string
  contentType: string
  size: number
  objectKey: string
  retention: Retention
  createdAt: number
  expiresAt: number
  uploadMode: UploadMode
  multipartUploadId?: string
}

/** Multipart when the file spans more than one part (parallel uploads). */
export function shouldUseMultipartUpload(size: number): boolean {
  return size > MULTIPART_PART_SIZE_BYTES
}

export function getMultipartPartCount(size: number): number {
  return Math.ceil(size / MULTIPART_PART_SIZE_BYTES)
}

export type SharePublic = {
  id: string
  filename: string
  contentType: string
  size: number
  retention: Retention
  createdAt: number
  expiresAt: number
}

export function objectKeyForShare(id: string): string {
  return `shares/${id}`
}

export function shareRedisKey(id: string): string {
  return `share:${id}`
}

export function retentionExpiresAt(
  retention: Retention,
  fromMs = Date.now()
): number {
  return fromMs + RETENTION_SECONDS[retention] * 1000
}

export function toPublicShare(record: ShareRecord): SharePublic {
  return {
    id: record.id,
    filename: record.filename,
    contentType: record.contentType,
    size: record.size,
    retention: record.retention,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  }
}
