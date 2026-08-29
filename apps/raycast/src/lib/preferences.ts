import { getPreferenceValues } from "@raycast/api"

import {
  INTERNAL_API_KEY_QUERY_PARAM,
  type Retention,
} from "@transferflow/shared"

interface PreferenceValues {
  webUrl: string
  retention: Retention
}

export interface Preferences {
  apiUrl: string
  webUrl: string
  retention: Retention
  internalApiKey?: string
}

export function parseWebAppUrl(raw: string): {
  webUrl: string
  internalApiKey?: string
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { webUrl: "" }
  }

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    )
    const internalApiKey =
      url.searchParams.get(INTERNAL_API_KEY_QUERY_PARAM) ?? undefined
    url.searchParams.delete(INTERNAL_API_KEY_QUERY_PARAM)

    let webUrl = url.origin
    const path = url.pathname.replace(/\/$/, "")
    if (path && path !== "/") {
      webUrl += path
    }

    const search = url.searchParams.toString()
    if (search) {
      webUrl += `?${search}`
    }

    return { webUrl, internalApiKey: internalApiKey || undefined }
  } catch {
    return { webUrl: trimmed.replace(/\/$/, "") }
  }
}

export function apiUrlForWebOrigin(webUrl: string): string {
  const origin = webUrl.replace(/\/$/, "")

  try {
    const url = new URL(origin)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return "http://localhost:3001"
    }
    return `${url.protocol}//api.${url.host}`
  } catch {
    return origin
  }
}

export function getPreferences(): Preferences {
  const values = getPreferenceValues<PreferenceValues>()
  const { webUrl, internalApiKey } = parseWebAppUrl(values.webUrl)

  return {
    webUrl,
    apiUrl: apiUrlForWebOrigin(webUrl),
    retention: values.retention,
    internalApiKey,
  }
}

export function sharePageUrl(webUrl: string, id: string): string {
  return `${webUrl}/d/${id}`
}
