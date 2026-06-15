import { Clipboard, showHUD, showToast, Toast } from "@raycast/api"
import { lookup } from "mime-types"
import { basename } from "path"

import { createApiClient } from "./lib/api"
import {
  INTERNAL_MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
} from "@transferflow/shared"
import { getFinderSelection } from "./lib/finder"
import { getPreferences, sharePageUrl } from "./lib/preferences"
import { uploadFile } from "./lib/upload"

function contentTypeFor(filename: string): string {
  return lookup(filename) || "application/octet-stream"
}

export default async function Command() {
  const { apiUrl, webUrl, retention, internalApiKey } = getPreferences()
  const api = createApiClient(apiUrl, internalApiKey)
  const maxFileSize = internalApiKey
    ? INTERNAL_MAX_FILE_SIZE_BYTES
    : MAX_FILE_SIZE_BYTES

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Reading Finder selection…",
  })

  try {
    const files = await getFinderSelection()

    if (files.length === 0) {
      throw new Error(
        "Select a file in Finder (with Finder focused), then run this command again"
      )
    }

    if (files.length > 1) {
      throw new Error("Select only one file in Finder")
    }

    const file = files[0]
    const contentType = contentTypeFor(file.name)

    if (file.size > maxFileSize) {
      throw new Error(
        internalApiKey
          ? "File exceeds the maximum upload size"
          : "File exceeds the 2 GB limit"
      )
    }

    toast.title = `Uploading ${basename(file.path)}…`

    const { id, upload } = await api.createShare({
      filename: file.name,
      contentType,
      size: file.size,
      retention,
    })

    const parts = await uploadFile(file.path, upload, contentType)
    await api.completeShare(id, parts)

    const link = sharePageUrl(webUrl, id)
    await Clipboard.copy(link)

    toast.style = Toast.Style.Success
    toast.title = "Link copied"
    toast.message = file.name

    await showHUD(`Copied link for ${file.name}`)
  } catch (error) {
    toast.style = Toast.Style.Failure
    toast.title = "Upload failed"
    toast.message =
      error instanceof Error ? error.message : "Unknown error occurred"
  }
}
