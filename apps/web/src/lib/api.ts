import type { CompletedPart, Retention, SharePublic } from "@transferflow/shared"
import { INTERNAL_API_KEY_HEADER } from "@transferflow/shared"

import { getInternalKey } from "@/lib/internal-key"

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")

function apiHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const key = getInternalKey()
  if (key) {
    headers.set(INTERNAL_API_KEY_HEADER, key)
  }
  return headers
}

type ApiError = {
  error: string
}

export type ShareCreateUpload =
  | { mode: "single"; uploadUrl: string }
  | {
      mode: "multipart"
      partSize: number
      parts: { partNumber: number; url: string }[]
    }

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T | ApiError
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as ApiError).error)
        : response.statusText
    throw new Error(message)
  }
  return data as T
}

export async function createShare(input: {
  filename: string
  contentType: string
  size: number
  retention: Retention
}): Promise<{ id: string; upload: ShareCreateUpload }> {
  const response = await fetch(`${API_BASE}/shares`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(input),
  })
  return parseJson(response)
}

export async function completeShare(
  id: string,
  parts?: CompletedPart[]
): Promise<{ share: SharePublic }> {
  const response = await fetch(`${API_BASE}/shares/${id}/complete`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(parts?.length ? { parts } : {}),
  })
  return parseJson(response)
}

export async function checkUploadAccess(): Promise<{ unlimited: boolean }> {
  const key = getInternalKey()
  if (!key) {
    return { unlimited: false }
  }

  const response = await fetch(`${API_BASE}/shares/upload-access`, {
    headers: apiHeaders(),
  })
  return parseJson(response)
}

export async function getShare(id: string): Promise<SharePublic> {
  const response = await fetch(`${API_BASE}/shares/${id}`)
  const data = await parseJson<{ share: SharePublic }>(response)
  return data.share
}

export async function getDownloadUrl(
  id: string
): Promise<{ url: string; expiresIn: number }> {
  const response = await fetch(`${API_BASE}/shares/${id}/download`, {
    method: "POST",
  })
  return parseJson(response)
}

export function sharePageUrl(id: string): string {
  return `${window.location.origin}/d/${id}`
}
